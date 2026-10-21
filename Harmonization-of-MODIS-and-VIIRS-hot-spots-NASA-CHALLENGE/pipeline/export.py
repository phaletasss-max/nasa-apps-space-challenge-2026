"""
FireCal — analytics + web export.

Reads data/interim/calib.npz and produces app/public/data:
  meta.json                 grid, calendar, calibration summary, overview layout, countries, biomes
  overview.bin              per fire cell (SoA): id, mean, trend, NRT obs/exp, peak month, …
  tiles/{tx}_{ty}.bin       10° tiles: calibration units + sparse monthly MODIS/VIIRS per cell
  series/{key}.json         precomputed monthly series for WORLD, every country (ISO a3) and biome (B{n})
  nrt.json                  this week's anomaly ranking (countries, biomes)   [via nrt.py]
and data/state/nrt_state.npz, the compact state nrt.py needs for daily updates.
  countries.geojson         Natural Earth 1:110m outlines (a3, names)
  validation.json           cross-validation results

Harmonized series (VIIRS S-NPP-equivalent fire cell-days, 0.1° cells summed to 0.25°):
  H[m] = MODIS[m] · r[moy] · k[moy]   for m ≤ 2002-06  (Terra-only period)
       = MODIS[m] · k[moy]            for 2002-07 ≤ m < 2012-02
       = VIIRS[m]                     for m ≥ 2012-02
"""
import json
import math
import shutil
import struct
import time

import duckdb
import numpy as np

import nrt as nrt_mod
from config import CELL, CLIM_YEARS, FIRST_MONTH, INTERIM, NRT, PUBLIC, REF, ROOT, SWITCH_MONTH

NX = int(360 / CELL)
NM = 26 * 12
TERRA_ONLY_LAST = (2002 - 2000) * 12 + 5
TILE_CELLS = 40           # 10° / 0.25°
Y0 = CLIM_YEARS[0]
NY_CLIM = len(CLIM_YEARS)


# --------------------------------------------------------------------------- helpers
def harmonize(M, V, kc, rc):
    """M, V: [n, NM]; kc, rc: [n, 12] -> H [n, NM] float32."""
    moy = np.arange(NM) % 12
    f = kc[:, moy].astype(np.float32)
    terra = np.arange(NM) <= TERRA_ONLY_LAST
    f[:, terra] *= rc[:, moy[terra]]
    H = np.where(np.arange(NM) < SWITCH_MONTH, M * f, V.astype(np.float32))
    H[:, :FIRST_MONTH] = 0
    return H.astype(np.float32)


def norm_cdf(z):
    return 0.5 * (1 + np.vectorize(math.erf)(z / math.sqrt(2)))


def mann_kendall_sen(A):
    """A: [n, T] annual series. Returns Sen slope [n], two-sided MK p-value [n]."""
    n, T = A.shape
    i, j = np.triu_indices(T, 1)
    d = A[:, j] - A[:, i]
    slope = np.median(d / (j - i), axis=1)
    S = np.sign(d).sum(1)
    var = T * (T - 1) * (2 * T + 5) / 18.0
    z = np.where(S > 0, (S - 1) / math.sqrt(var), np.where(S < 0, (S + 1) / math.sqrt(var), 0.0))
    p = 2 * (1 - norm_cdf(np.abs(z)))
    return slope.astype(np.float32), p


def bh_fdr(p, q=0.05):
    """Benjamini–Hochberg: boolean mask of discoveries."""
    m = p.size
    order = np.argsort(p)
    thresh = q * np.arange(1, m + 1) / m
    passed = p[order] <= thresh
    out = np.zeros(m, bool)
    if passed.any():
        out[order[: np.max(np.where(passed)[0]) + 1]] = True
    return out


def r1(a):
    return [round(float(x), 1) for x in a]


def series_payload(rows, H, Hlo, Hhi, M, V):
    h, lo, hi = H[rows].sum(0), Hlo[rows].sum(0), Hhi[rows].sum(0)
    m, v = M[rows].sum(0, dtype=np.int64), V[rows].sum(0, dtype=np.int64)
    sl = slice(FIRST_MONTH, NM)
    return {"first": FIRST_MONTH, "H": r1(h[sl]), "lo": r1(lo[sl]), "hi": r1(hi[sl]),
            "M": m[sl].tolist(), "V": v[sl].tolist(), "cells": int(len(rows) if not isinstance(rows, slice) else H.shape[0])}


# --------------------------------------------------------------------------- tiles
def write_tile(path, cells, unit_local, units, k, lo, hi, r, ids, country, M, V):
    nnz_idx = [np.nonzero((M[c] > 0) | (V[c] > 0))[0] for c in cells]
    offs = np.zeros(len(cells) + 1, np.uint32)
    offs[1:] = np.cumsum([len(x) for x in nnz_idx])
    months = np.concatenate(nnz_idx).astype(np.uint16) if cells.size else np.zeros(0, np.uint16)
    mv = np.concatenate([M[c, x] for c, x in zip(cells, nnz_idx)]).astype(np.uint16)
    vv = np.concatenate([V[c, x] for c, x in zip(cells, nnz_idx)]).astype(np.uint16)
    utab = np.concatenate([k[units], lo[units], hi[units], r[units]], axis=1).astype("<f4")  # [nU, 48]
    with open(path, "wb") as fh:
        fh.write(b"FCT2")
        fh.write(struct.pack("<III", len(units), len(cells), int(offs[-1])))
        fh.write(utab.tobytes())
        fh.write(ids[cells].astype("<u4").tobytes())
        fh.write(unit_local.astype("<u4").tobytes())
        fh.write(country[cells].astype("<i4").tobytes())
        fh.write(offs.astype("<u4").tobytes())
        fh.write(months.astype("<u2").tobytes())
        fh.write(mv.astype("<u2").tobytes())
        fh.write(vv.astype("<u2").tobytes())


# --------------------------------------------------------------------------- main
def main():
    t0 = time.time()
    c = np.load(INTERIM / "calib.npz")
    ids, M, V, unit = c["ids"], c["M"], c["V"], c["unit"]
    k, k_lo, k_hi, r = c["k"], c["k_lo"], c["k_hi"], c["r"]
    country, biome = c["country"], c["biome"]
    s = np.load(INTERIM / "strata.npz")
    cmeta = json.loads(str(s["countries"]))
    bmeta = json.loads(str(s["biomes"]))
    n = ids.size
    print(f"{n:,} cells", flush=True)

    H = harmonize(M, V, k[unit], r[unit])
    Hlo = harmonize(M, V, k_lo[unit], r[unit])
    Hhi = harmonize(M, V, k_hi[unit], r[unit])
    print(f"harmonized ({time.time() - t0:.0f}s)", flush=True)

    # ---- per-cell analytics (2001–2025)
    yr = slice((Y0 - 2000) * 12, (CLIM_YEARS[-1] - 2000 + 1) * 12)
    H3 = H[:, yr].reshape(n, NY_CLIM, 12)
    A = H3.sum(2)                                   # [n, 25] annual totals
    mean = A.mean(1)
    clim = H3.mean(1)                               # [n, 12]
    peak = clim.argmax(1).astype(np.uint8)
    roll3 = clim + np.roll(clim, -1, 1) + np.roll(clim, -2, 1)
    conc = np.where(clim.sum(1) > 0, roll3.max(1) / np.maximum(clim.sum(1), 1e-9), 0)
    slope, p = mann_kendall_sen(A)
    eligible = mean >= 2.0
    sig = np.zeros(n, np.int8)
    disc = np.zeros(n, bool)
    disc[eligible] = bh_fdr(p[eligible], 0.05)
    sig[disc & (slope > 0)] = 1
    sig[disc & (slope < 0)] = -1
    trend_pct = np.where(mean > 0, slope * 10 / np.maximum(mean, 1e-9) * 100, 0).astype(np.float32)
    print(f"trends: {eligible.sum():,} eligible, {np.sum(sig > 0):,} increasing, {np.sum(sig < 0):,} decreasing (FDR 5%) "
          f"({time.time() - t0:.0f}s)", flush=True)

    # ---- output dirs
    if PUBLIC.exists():
        shutil.rmtree(PUBLIC)
    (PUBLIC / "tiles").mkdir(parents=True)
    (PUBLIC / "series").mkdir()

    # ---- tiles
    cy, cx = ids // NX, ids % NX
    tkey = (cy // TILE_CELLS) * 1000 + (cx // TILE_CELLS)
    tiles = []
    for tk in np.unique(tkey):
        cells = np.where(tkey == tk)[0]
        units, local = np.unique(unit[cells], return_inverse=True)
        ty, tx = int(tk // 1000), int(tk % 1000)
        write_tile(PUBLIC / "tiles" / f"{tx}_{ty}.bin", cells, local, units, k, k_lo, k_hi, r, ids, country, M, V)
        tiles.append(f"{tx}_{ty}")
    print(f"{len(tiles)} tiles ({time.time() - t0:.0f}s)", flush=True)

    # ---- series: world, countries, biomes
    world = series_payload(slice(None), H, Hlo, Hhi, M, V)
    world.update({"key": "WORLD", "name": "World", "name_es": "Mundo", "mean": round(float(mean.sum()), 1)})
    (PUBLIC / "series" / "WORLD.json").write_text(json.dumps(world, separators=(",", ":")))
    countries = []
    for ci in np.unique(country[country >= 0]):
        rows = np.where(country == ci)[0]
        meta = cmeta[ci]
        pay = series_payload(rows, H, Hlo, Hhi, M, V)
        pay.update({"key": meta["a3"], "name": meta["name"], "name_es": meta["name_es"]})
        (PUBLIC / "series" / f"{meta['a3']}.json").write_text(json.dumps(pay, separators=(",", ":")))
        lat = -90 + (cy[rows] + 0.5) * CELL
        lon = -180 + (cx[rows] + 0.5) * CELL
        row = {"a3": meta["a3"], "idx": int(ci), "name": meta["name"], "name_es": meta["name_es"], "continent": meta["continent"],
               "cells": int(rows.size), "mean": round(float(mean[rows].sum()), 1),
               "bbox": [round(float(lon.min()) - 0.125, 3), round(float(lat.min()) - 0.125, 3),
                        round(float(lon.max()) + 0.125, 3), round(float(lat.max()) + 0.125, 3)]}
        countries.append(row)
    biomes = []
    for b in np.unique(biome[biome > 0]):
        rows = np.where(biome == b)[0]
        info = bmeta.get(str(int(b)), {"name": f"Biome {b}", "color": "#888"})
        pay = series_payload(rows, H, Hlo, Hhi, M, V)
        pay.update({"key": f"B{int(b)}", "name": info["name"], "name_es": info["name"]})
        (PUBLIC / "series" / f"B{int(b)}.json").write_text(json.dumps(pay, separators=(",", ":")))
        biomes.append({"id": int(b), "key": f"B{int(b)}", "name": info["name"], "color": info["color"],
                       "cells": int(rows.size), "mean": round(float(mean[rows].sum()), 1)})
    print(f"series: {len(countries)} countries, {len(biomes)} biomes ({time.time() - t0:.0f}s)", flush=True)

    # ---- countries geojson (1:110m), trimmed
    gj = json.loads((REF / "ne_110m_admin_0_countries.geojson").read_text(encoding="utf-8"))

    def rnd(x):
        return [rnd(v) for v in x] if isinstance(x[0], list) else [round(x[0], 3), round(x[1], 3)]

    feats = [{"type": "Feature", "properties": {"a3": f["properties"]["ADM0_A3"], "name": f["properties"]["NAME"],
                                                "name_es": f["properties"].get("NAME_ES") or f["properties"]["NAME"]},
              "geometry": {"type": f["geometry"]["type"], "coordinates": rnd(f["geometry"]["coordinates"])}}
             for f in gj["features"]]
    (PUBLIC / "countries.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}, separators=(",", ":")))

    # ---- validation + meta
    val = json.loads((INTERIM / "validation.json").read_text(encoding="utf-8"))
    (PUBLIC / "validation.json").write_text(json.dumps(val, separators=(",", ":")))
    meta = {
        "version": "2.0.0",
        "grid": {"cell": CELL, "nx": NX, "tileCells": TILE_CELLS},
        "months": {"first": FIRST_MONTH, "last": NM - 1, "switch": SWITCH_MONTH, "terraOnlyLast": TERRA_ONLY_LAST,
                   "climYears": [CLIM_YEARS[0], CLIM_YEARS[-1]]},
        "calibration": {"years": val["calibration_years"], "alpha": val["alpha"], "bootstrap": val["bootstrap"]},
        "tiles": tiles, "countries": sorted(countries, key=lambda x: x["name"]), "biomes": biomes,
        "stats": {"cells": int(n), "world_mean_annual": round(float(mean.sum()), 1),
                  "increasing": int(np.sum(sig > 0)), "decreasing": int(np.sum(sig < 0)), "eligible": int(eligible.sum())},
    }
    # detections processed, from the ingest log
    det = {"modis": 0, "viirs-snpp": 0}
    log = INTERIM / "ingest.log"
    if log.exists():
        for line in log.read_text(encoding="utf-8").splitlines():
            parts = line.split()
            if len(parts) > 3 and parts[0] == "ok" and parts[1] in det:
                det[parts[1]] += int(parts[3].replace(",", ""))
    meta["stats"]["detections"] = det
    (PUBLIC / "meta.json").write_text(json.dumps(meta, separators=(",", ":")))

    # ---- compact state for daily NRT updates (no archive needed) + this week's NRT
    static = duckdb.sql(f"""
        SELECT CAST(ix AS BIGINT) * {nrt_mod.FINE_NY} + iy AS k FROM '{(INTERIM / "static_*.parquet").as_posix()}'
        GROUP BY ix, iy HAVING sum(n) >= 2
    """).fetchnumpy()["k"]
    state = {
        "ids": ids.astype(np.uint32), "clim": clim.astype(np.float16), "static_fine": static.astype(np.int64),
        "mean": mean.astype(np.float32), "trend": trend_pct, "peak": peak, "conc": np.round(conc * 100).astype(np.uint8),
        "sig": sig, "country": country.astype(np.int16), "biome": biome.astype(np.int8),
        "strata_country": s["country"].ravel().astype(np.int16), "strata_biome": s["biome"].ravel().astype(np.int8),
        "country_a3": np.array([c["a3"] for c in cmeta], dtype="<U3"),
    }
    (ROOT / "data" / "state").mkdir(parents=True, exist_ok=True)
    np.savez_compressed(ROOT / "data" / "state" / "nrt_state.npz", **state)
    days, nrt_obs, nrt_exp, new_ids, points = nrt_mod.compute(state, NRT / "viirs-snpp_global_7d.csv")
    nrt = nrt_mod.write_outputs(state, days, nrt_obs, nrt_exp, new_ids, points)
    print(f"NRT window {nrt['window'][0]}..{nrt['window'][1]}: {nrt['world']['obs']:,} observed vs "
          f"{nrt['world']['exp']:,.0f} expected; {len(new_ids)} cells without history ({time.time() - t0:.0f}s)", flush=True)
    total = sum(f.stat().st_size for f in PUBLIC.rglob("*") if f.is_file())
    print(f"export done: {total / 1e6:.1f} MB ({time.time() - t0:.0f}s)")


if __name__ == "__main__":
    main()
