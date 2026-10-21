"""
FireCal — near-real-time (NRT) early-warning update.

Needs only the compact state written by export.py (data/state/nrt_state.npz, ~3 MB),
not the 7 GB archive, so it can run daily in CI:

    python pipeline/nrt.py --download      # fetch the global 7-day VIIRS file, then update
    python pipeline/nrt.py                 # use data/raw/nrt/viirs-snpp_global_7d.csv

It rewrites app/public/data/overview.bin (NRT columns + fire cells with no history),
nrt_points.bin (every VIIRS detection of the window, for the vector point layer),
nrt.json and the NRT/overview fields of meta.json.

Method: fire cell-days (0.1° cells that burned on a day, summed to 0.25°) over the
last complete days of the file, compared with the harmonized 2001–2025 climatology
for the same calendar days. The archive is on the VIIRS S-NPP scale, so VIIRS NRT is
directly comparable. One-sided Poisson test for "more fire than usual".
"""
import argparse
import calendar
import datetime as dt
import json
import math
import urllib.request

import duckdb
import numpy as np

from config import CELL, FIRMS_NRT, NRT, PUBLIC, ROOT, VIIRS_CONF

STATE = ROOT / "data" / "state" / "nrt_state.npz"
NX = int(360 / CELL)
FINE_NY = 1800


def norm_sf(z):
    return 0.5 * math.erfc(z / math.sqrt(2))


def poisson_upper(obs, lam):
    """P(X >= obs | Poisson(lam)); exact for small lam, normal approximation otherwise."""
    if obs <= 0:
        return 1.0
    if lam <= 0:
        return 0.0
    if lam > 50:
        return norm_sf((obs - 0.5 - lam) / math.sqrt(lam))
    term, cdf = math.exp(-lam), 0.0
    for x in range(int(obs)):
        cdf += term
        term *= lam / (x + 1)
    return max(0.0, 1.0 - cdf)


def compute(state, csv_path):
    """Observed vs expected fire cell-days per archive cell for the last complete NRT days."""
    ids, clim = state["ids"], state["clim"].astype(np.float64)
    static = state["static_fine"]                      # 0.1° cells (ix * 1800 + iy) with static sources
    con = duckdb.connect()
    conf = ",".join(f"'{c}'" for c in VIIRS_CONF)
    con.execute(f"""
        CREATE TEMP TABLE d AS
        SELECT CAST(floor((longitude + 180) / 0.1) AS INTEGER) ix,
               CAST(floor((latitude + 90) / 0.1) AS INTEGER) iy,
               CAST(acq_date AS DATE) d, longitude AS lon, latitude AS lat
        FROM read_csv('{csv_path.as_posix()}', header=true)
        WHERE lower(CAST(confidence AS VARCHAR)) IN ({conf})
    """)
    per_day = dict(con.execute("SELECT d, count(*) FROM d GROUP BY d ORDER BY d").fetchall())
    med = float(np.median(list(per_day.values())))
    days = sorted(d for d, n in per_day.items() if n >= 0.6 * med)   # drop partial first/last days
    con.register("static_tbl", {"k": static.astype(np.int64)})
    dl = ",".join(f"DATE '{d}'" for d in days)
    rows = con.execute(f"""
        SELECT CAST(floor((iy + 0.5) * 0.4) AS INTEGER) * {NX} + CAST(floor((ix + 0.5) * 0.4) AS INTEGER) AS id,
               count(*) AS n
        FROM (SELECT DISTINCT ix, iy, d FROM d WHERE d IN ({dl})) x
        WHERE CAST(ix AS BIGINT) * {FINE_NY} + iy NOT IN (SELECT k FROM static_tbl)
        GROUP BY id
    """).fetchnumpy()
    pts = con.execute(f"""
        SELECT lon, lat, date_diff('day', DATE '{days[0]}', d) AS day FROM d
        WHERE d IN ({dl}) AND CAST(ix AS BIGINT) * {FINE_NY} + iy NOT IN (SELECT k FROM static_tbl)
    """).fetchnumpy()
    points = (pts["lon"].astype(np.float32), pts["lat"].astype(np.float32), pts["day"].astype(np.uint8))
    expected = np.zeros(ids.size)
    for d in days:
        expected += clim[:, d.month - 1] / calendar.monthrange(d.year, d.month)[1]
    pos = {int(x): i for i, x in enumerate(ids)}
    obs = np.zeros(ids.size, np.int64)
    new = []
    for cid, n in zip(rows["id"], rows["n"]):
        i = pos.get(int(cid))
        if i is None:
            new.append((int(cid), int(n)))
        else:
            obs[i] = n
    return days, obs, expected, new, points


def write_points(points):
    """nrt_points.bin: float32 lon[n], float32 lat[n], uint8 day[n] (days since window start)."""
    lon, lat, day = points
    with open(PUBLIC / "nrt_points.bin", "wb") as fh:
        fh.write(lon.astype("<f4").tobytes())
        fh.write(lat.astype("<f4").tobytes())
        fh.write(day.astype("u1").tobytes())
    return int(lon.size)


def write_outputs(state, days, obs, expected, new, points=None, meta_extra=None):
    """overview.bin + nrt.json + meta.json (overview layout, nrt window)."""
    ids = state["ids"]
    new_ids = np.array([x for x, _ in new], np.int64)
    pad = new_ids.size
    sc, sb = state["strata_country"], state["strata_biome"]
    cols = [
        ("id", np.concatenate([ids, new_ids]).astype("<u4")),
        ("mean", np.concatenate([state["mean"], np.zeros(pad)]).astype("<f4")),
        ("trend", np.concatenate([state["trend"], np.zeros(pad)]).astype("<f4")),
        ("nrtExp", np.concatenate([expected, np.zeros(pad)]).astype("<f4")),
        ("nrtObs", np.minimum(np.concatenate([obs, [n for _, n in new]]), 65535).astype("<u2")),
        ("country", np.concatenate([state["country"], sc[new_ids] if pad else []]).astype("<i2")),
        ("peak", np.concatenate([state["peak"], np.full(pad, 255)]).astype("u1")),
        ("conc", np.concatenate([state["conc"], np.zeros(pad)]).astype("u1")),
        ("sig", np.concatenate([state["sig"], np.zeros(pad)]).astype("i1")),
        ("biome", np.concatenate([state["biome"], sb[new_ids] if pad else []]).astype("i1")),
    ]
    layout, off = {}, 0
    with open(PUBLIC / "overview.bin", "wb") as fh:
        for name, arr in cols:
            layout[name] = {"offset": off, "type": arr.dtype.str.lstrip("<|"), "length": int(arr.size)}
            b = arr.tobytes()
            fh.write(b)
            off += len(b)
            if off % 4:
                fh.write(b"\0" * (4 - off % 4))
                off += 4 - off % 4

    country, biome = state["country"], state["biome"]
    a3 = [str(x) for x in state["country_a3"]]

    def row(mask):
        o, e = int(obs[mask].sum()), float(expected[mask].sum())
        return {"obs": o, "exp": round(e, 1), "ratio": round(o / e, 2) if e > 0 else None, "p": poisson_upper(o, e)}

    generated = dt.datetime.now(dt.timezone.utc).isoformat(timespec="minutes")
    nrt = {
        "window": [str(days[0]), str(days[-1])], "days": len(days), "source": "VIIRS S-NPP NRT (FIRMS, 375 m)",
        "world": row(slice(None)),
        "countries": [{"a3": a3[c], **row(country == c)} for c in np.unique(country[country >= 0])],
        "biomes": [{"key": f"B{int(b)}", **row(biome == b)} for b in np.unique(biome[biome > 0])],
        "generated": generated,
    }
    if points is not None:
        nrt["points"] = write_points(points)
    (PUBLIC / "nrt.json").write_text(json.dumps(nrt, separators=(",", ":")))

    meta_path = PUBLIC / "meta.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    meta.update(meta_extra or {})
    meta["overview"] = {"count": int(cols[0][1].size), "fields": layout}
    meta["nrt"] = {"window": nrt["window"], "days": len(days), "points": nrt.get("points", 0)}
    meta["generated"] = generated
    meta_path.write_text(json.dumps(meta, separators=(",", ":")))
    return nrt


def download(dest):
    req = urllib.request.Request(FIRMS_NRT["viirs-snpp"], headers={"User-Agent": "FireCal/2.0 (NASA Space Apps 2026)"})
    with urllib.request.urlopen(req, timeout=300) as r, open(dest, "wb") as fh:
        while chunk := r.read(1 << 20):
            fh.write(chunk)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--download", action="store_true", help="fetch the latest global 7-day VIIRS NRT file first")
    args = ap.parse_args()
    csv = NRT / "viirs-snpp_global_7d.csv"
    if args.download:
        NRT.mkdir(parents=True, exist_ok=True)
        download(csv)
    state = dict(np.load(STATE, allow_pickle=False))
    days, obs, exp, new, points = compute(state, csv)
    nrt = write_outputs(state, days, obs, exp, new, points)
    print(f"NRT {nrt['window'][0]}..{nrt['window'][1]}: {nrt['world']['obs']:,} observed vs "
          f"{nrt['world']['exp']:,.0f} expected; {len(new)} cells with no history")


if __name__ == "__main__":
    main()
