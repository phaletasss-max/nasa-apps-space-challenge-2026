"""
FireCal — global MODIS -> VIIRS-equivalent harmonization.

Two-stage, hierarchical empirical-Bayes calibration on 0.25° cells:

  Stage A (Terra -> Terra+Aqua). Before 2002-07 only Terra MODIS existed. For
      2003–2011 we know both, so r = Σ(Terra+Aqua) / Σ(Terra) per stratum × month
      bridges the first 20 months onto the Terra+Aqua scale.
  Stage B (MODIS -> VIIRS S-NPP). In the overlap window, k = ΣVIIRS / ΣMODIS per
      stratum × month-of-year. MODIS 2000-11..2012-01 × (r) × k gives a series
      on the VIIRS scale; from 2012-02 the VIIRS record is used directly.

Both ratios are estimated with the same hierarchy, each level shrunk to its parent:
      global(m) -> biome(m) -> biome×realm(m) -> 2.5° block × biome×realm (m)
      k_child = (ΣV_child + α · k_parent) / (ΣM_child + α)
α is chosen by leave-one-year-out cross-validation; uncertainty comes from a
bootstrap over years. Outputs data/interim/calib.npz and validation.json.
"""
import json
import time

import duckdb
import numpy as np

from config import CELL, INTERIM

NX, NY = int(360 / CELL), int(180 / CELL)
NYEARS = 26                      # 2000..2025
TERRA_ONLY_LAST = (2002 - 2000) * 12 + 5   # 2002-06
CALIB_YEARS = list(range(2012, 2020))       # overlap window before Terra/Aqua orbit drift (see validation)
STAGE_A_YEARS = list(range(2003, 2012))     # Terra and Aqua both nominal, pre-VIIRS
ALPHAS = [3, 10, 30, 100, 300, 1000]
N_BOOT = 200
BLOCK = 10                       # 10 × 0.25° = 2.5° blocks
rng = np.random.default_rng(42)


# --------------------------------------------------------------------------- data
def load_cells():
    """Aggregate 0.1° fire cell-days to 0.25° cell × month (dense, uint16)."""
    t0 = time.time()
    q = f"""
        SELECT CAST(floor((iy + 0.5) * 0.4) AS INTEGER) AS cy,
               CAST(floor((ix + 0.5) * 0.4) AS INTEGER) AS cx,
               month, sensor, sum(days) AS d, sum(days_terra) AS dt
        FROM (
          SELECT ix, iy, month, days, days_terra, 'M' AS sensor FROM '{(INTERIM / "fires_modis_*.parquet").as_posix()}'
          UNION ALL
          SELECT ix, iy, month, days, 0, 'V' FROM '{(INTERIM / "fires_viirs-snpp_*.parquet").as_posix()}'
        ) GROUP BY ALL
    """
    df = duckdb.sql(q).fetchnumpy()
    cid = df["cy"].astype(np.int64) * NX + df["cx"]
    ids, inv = np.unique(cid, return_inverse=True)
    n = ids.size
    M = np.zeros((n, NYEARS * 12), np.uint16)
    T = np.zeros((n, NYEARS * 12), np.uint16)
    V = np.zeros((n, NYEARS * 12), np.uint16)
    m = df["month"].astype(np.int64)
    ok = (m >= 0) & (m < NYEARS * 12)
    isM = (df["sensor"] == "M") & ok
    isV = (df["sensor"] == "V") & ok
    M[inv[isM], m[isM]] = df["d"][isM]
    T[inv[isM], m[isM]] = df["dt"][isM]
    V[inv[isV], m[isV]] = df["d"][isV]
    print(f"cells with fire: {n:,}  MODIS cell-days {M.sum():,}  VIIRS {V.sum():,} ({time.time() - t0:.0f}s)", flush=True)
    return ids, M, T, V


def load_strata(ids):
    s = np.load(INTERIM / "strata.npz")
    flat = {k: s[k].ravel()[ids] for k in ("country", "biome", "realm")}
    meta = {k: json.loads(str(s[k])) for k in ("countries", "realms", "biomes")}
    print(f"strata: country miss {np.mean(flat['country'] < 0):.2%}, biome miss {np.mean(flat['biome'] < 0):.2%}", flush=True)
    return flat, meta


# --------------------------------------------------------------------------- hierarchy
class Hierarchy:
    """Unit ids for each level and parent links."""

    def __init__(self, ids, biome, realm):
        b = np.where(biome < 0, 0, biome).astype(np.int64)         # 0 = unknown biome
        r = np.where(realm < 0, 99, realm).astype(np.int64)
        cy, cx = ids // NX, ids % NX
        key1 = b
        key2 = b * 100 + r
        key3 = key2 * 10_000_000 + (cy // BLOCK) * 1000 + (cx // BLOCK)
        self.u1, self.i1 = np.unique(key1, return_inverse=True)
        self.u2, self.i2 = np.unique(key2, return_inverse=True)
        self.u3, self.i3 = np.unique(key3, return_inverse=True)
        # parents
        self.p2 = np.searchsorted(self.u1, self.u2 // 100)
        self.p3 = np.searchsorted(self.u2, self.u3 // 10_000_000)
        self.block = (cy // BLOCK) * 1000 + (cx // BLOCK)

    def sums(self, A):
        """A: [cells, years, 12] -> per-level sums [units, years, 12]."""
        out = []
        for idx, n in ((self.i1, self.u1.size), (self.i2, self.u2.size), (self.i3, self.u3.size)):
            s = np.zeros((n,) + A.shape[1:], np.float64)
            np.add.at(s, idx, A)
            out.append(s)
        return [A.sum(axis=0, dtype=np.float64)] + out


def fit_levels(SM, SV, w, alpha, H):
    m = [np.tensordot(x, w, axes=([-2], [0])) for x in SM]
    v = [np.tensordot(x, w, axes=([-2], [0])) for x in SV]
    k0 = np.where(m[0] > 0, v[0] / np.maximum(m[0], 1e-9), 1.0)            # [12]
    k1 = (v[1] + alpha * k0[None]) / (m[1] + alpha)                          # [U1,12]
    k2 = (v[2] + alpha * k1[H.p2]) / (m[2] + alpha)                          # [U2,12]
    k3 = (v[3] + alpha * k2[H.p3]) / (m[3] + alpha)                          # [U3,12]
    return k0, k1, k2, k3


def weights(years):
    w = np.zeros(NYEARS)
    for y in years:
        w[y - 2000] += 1
    return w


# --------------------------------------------------------------------------- validation
def metrics(obs, pred):
    obs = obs.astype(np.float64).ravel()
    pred = pred.astype(np.float64).ravel()
    keep = (obs > 0) | (pred > 0)
    obs, pred = obs[keep], pred[keep]
    lo, lp = np.log1p(obs), np.log1p(pred)
    r2 = 1 - np.sum((lo - lp) ** 2) / np.sum((lo - lo.mean()) ** 2)
    return {"n": int(obs.size), "mae": round(float(np.mean(np.abs(obs - pred))), 2),
            "bias_pct": round(float((pred.sum() - obs.sum()) / obs.sum() * 100), 2),
            "r2_log": round(float(r2), 4)}


def aggregate(A, key):
    """Sum rows of A [cells, ...] by integer key -> [groups, ...]."""
    u, inv = np.unique(key, return_inverse=True)
    out = np.zeros((u.size,) + A.shape[1:], np.float64)
    np.add.at(out, inv, A)
    return out


def loyo(M3, V3, SM, SV, H, alpha, years, keys, mode="full"):
    """Leave-one-year-out predictions of VIIRS from MODIS for every year in `years`."""
    obs, pred = [], []
    for y in years:
        w = weights([x for x in years if x != y])
        k0, k1, k2, k3 = fit_levels(SM, SV, w, alpha, H)
        kc = cell_factors(mode, SM, SV, w, alpha, H, M3.shape[0])
        yi = y - 2000
        mm = M3[:, yi, :].astype(np.float64)
        vv = V3[:, yi, :].astype(np.float64)
        if y == 2012:  # January 2012 has no full VIIRS month
            mm[:, 0] = 0
            vv[:, 0] = 0
        obs.append(vv)
        pred.append(mm * kc)
    obs = np.stack(obs, 1)   # [cells, nyears, 12]
    pred = np.stack(pred, 1)
    res = {}
    for name, key in keys.items():
        if name == "cell_year":
            res[name] = metrics(obs.sum(2), pred.sum(2))
        elif name.endswith("_year"):
            res[name] = metrics(aggregate(obs.sum(2), key), aggregate(pred.sum(2), key))
        else:
            res[name] = metrics(aggregate(obs, key), aggregate(pred, key))
    return res


def cell_factors(mode, SM, SV, w, alpha, H, n):
    """Per-cell [n, 12] MODIS->VIIRS factors for one calibration method."""
    if mode == "raw":
        return np.ones((n, 12))
    if mode == "global":
        k = float(np.tensordot(SV[0], w, axes=([0], [0])).sum() / np.tensordot(SM[0], w, axes=([0], [0])).sum())
        return np.full((n, 12), k)
    k0, k1, k2, k3 = fit_levels(SM, SV, w, alpha, H)
    return {"global_month": np.broadcast_to(k0, (n, 12)), "biome": k1[H.i1],
            "biome_realm": k2[H.i2], "full": k3[H.i3]}[mode]


# --------------------------------------------------------------------------- main
def main():
    t0 = time.time()
    ids, M, T, V = load_cells()
    strata, meta = load_strata(ids)
    H = Hierarchy(ids, strata["biome"], strata["realm"])
    print(f"units: biome {H.u1.size}, biome×realm {H.u2.size}, block×biome×realm {H.u3.size}", flush=True)

    M3 = M.reshape(-1, NYEARS, 12)
    T3 = T.reshape(-1, NYEARS, 12)
    V3 = V.reshape(-1, NYEARS, 12)

    # ---- overlap window sums (January 2012 excluded)
    Mc = M3.astype(np.float64)
    Vc = V3.astype(np.float64)
    Mc[:, 12, 0] = 0
    Vc[:, 12, 0] = 0
    SM, SV = H.sums(Mc), H.sums(Vc)

    # ratio by year (global, and per biome) — evidence for the calibration window
    ratio_year = {}
    for y in range(2012, 2026):
        yi = y - 2000
        ratio_year[y] = round(float(Vc[:, yi].sum() / Mc[:, yi].sum()), 4)
    ratio_biome_year = {}
    for j, b in enumerate(H.u1):
        ratio_biome_year[int(b)] = {y: round(float(SV[1][j, y - 2000].sum() / max(1, SM[1][j, y - 2000].sum())), 3)
                                    for y in range(2012, 2026)}
    print("global VIIRS/MODIS by year:", ratio_year, flush=True)

    keys = {"cell_year": None, "block_month": H.block, "country_month": strata["country"],
            "country_year": strata["country"], "biome_month": H.i1}

    # ---- choose alpha by LOYO (block × month MAE)
    alpha_cv = {}
    for a in ALPHAS:
        alpha_cv[a] = loyo(M3, V3, SM, SV, H, a, CALIB_YEARS, {"block_month": H.block})["block_month"]
        print(f"alpha {a:>5}: {alpha_cv[a]}", flush=True)
    alpha = min(alpha_cv, key=lambda a: alpha_cv[a]["mae"])
    print(f"chosen alpha = {alpha}", flush=True)

    # ---- method comparison at the chosen alpha
    methods = {}
    for mode in ("raw", "global", "global_month", "biome", "biome_realm", "full"):
        methods[mode] = loyo(M3, V3, SM, SV, H, alpha, CALIB_YEARS, keys, mode)
        print(f"{mode:>12}: block_month {methods[mode]['block_month']}  country_year {methods[mode]['country_year']}", flush=True)

    # ---- out-of-window check: calibrate on CALIB_YEARS, predict the drift years
    late = [y for y in range(2012, 2026) if y not in CALIB_YEARS]
    k_all = fit_levels(SM, SV, weights(CALIB_YEARS), alpha, H)[3][H.i3]
    oow = {}
    if late:
        obs = np.stack([V3[:, y - 2000, :] for y in late], 1).astype(np.float64)
        pred = np.stack([M3[:, y - 2000, :] * k_all for y in late], 1)
        oow = {"years": late, "country_year": metrics(aggregate(obs.sum(2), strata["country"]), aggregate(pred.sum(2), strata["country"])),
               "block_month": metrics(aggregate(obs, H.block), aggregate(pred, H.block))}
        print(f"out-of-window {late[0]}–{late[-1]}: {oow}", flush=True)

    # ---- final fit + bootstrap (stage B)
    w = weights(CALIB_YEARS)
    k0, k1, k2, k3 = fit_levels(SM, SV, w, alpha, H)
    boot = np.empty((N_BOOT,) + k3.shape, np.float32)
    for b in range(N_BOOT):
        wb = weights(rng.choice(CALIB_YEARS, size=len(CALIB_YEARS), replace=True))
        boot[b] = fit_levels(SM, SV, wb, alpha, H)[3]
    k_lo = np.percentile(boot, 5, axis=0).astype(np.float32)
    k_hi = np.percentile(boot, 95, axis=0).astype(np.float32)

    # ---- stage A: Terra -> Terra+Aqua for 2000-11..2002-06
    SA_M, SA_V = H.sums(T3.astype(np.float64)), H.sums(M3.astype(np.float64))   # "M"=Terra, "V"=Terra+Aqua
    rA = fit_levels(SA_M, SA_V, weights(STAGE_A_YEARS), alpha, H)
    stageA_cv = loyo(T3, M3, SA_M, SA_V, H, alpha, STAGE_A_YEARS, {"block_month": H.block, "country_year": strata["country"]}, "full")
    stageA_raw = loyo(T3, M3, SA_M, SA_V, H, alpha, STAGE_A_YEARS, {"block_month": H.block, "country_year": strata["country"]}, "raw")
    print(f"stage A (Terra->T+A) global r by month: {np.round(rA[0], 3).tolist()}", flush=True)
    print(f"stage A LOYO full: {stageA_cv}  raw: {stageA_raw}", flush=True)

    np.savez_compressed(
        INTERIM / "calib.npz",
        ids=ids, M=M, V=V, unit=H.i3.astype(np.int32),
        k=k3.astype(np.float32), k_lo=k_lo, k_hi=k_hi, r=rA[3].astype(np.float32),
        country=strata["country"], biome=strata["biome"], realm=strata["realm"],
        unit_key=H.u3, alpha=alpha,
    )
    validation = {
        "calibration_years": [CALIB_YEARS[0], CALIB_YEARS[-1]],
        "stage_a_years": [STAGE_A_YEARS[0], STAGE_A_YEARS[-1]],
        "alpha": alpha, "alpha_cv": {str(a): v for a, v in alpha_cv.items()},
        "methods": methods, "out_of_window": oow,
        "ratio_by_year": ratio_year, "ratio_by_biome_year": ratio_biome_year,
        "k_global_month": np.round(k0, 4).tolist(),
        "k_biome_month": {int(b): np.round(k1[j], 4).tolist() for j, b in enumerate(H.u1)},
        "stage_a": {"r_global_month": np.round(rA[0], 4).tolist(), "loyo_full": stageA_cv, "loyo_raw": stageA_raw},
        "units": {"biome": int(H.u1.size), "biome_realm": int(H.u2.size), "block_biome_realm": int(H.u3.size)},
        "n_cells": int(ids.size), "bootstrap": N_BOOT,
    }
    (INTERIM / "validation.json").write_text(json.dumps(validation, indent=1), encoding="utf-8")
    print(f"done ({time.time() - t0:.0f}s)")


if __name__ == "__main__":
    main()
