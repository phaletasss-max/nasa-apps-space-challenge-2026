"""
FireCal Perú — pipeline de armonización MODIS -> VIIRS (solo librería estándar).

Entrada : data/raw/firms/{modis,viirs-snpp}_YYYY_Peru.csv   (FIRMS, archivo anual por país)
          data/raw/geo/peru_departamental_simple.geojson
Salida  : web/data/grid.json        celdas 0.25° con series mensuales crudas MODIS y VIIRS
          web/data/calib.json       factores k[departamento][mes] (+ IC bootstrap)
          web/data/validation.json  validación leave-one-year-out y ratio por año
          web/data/departments.geojson

Método
  1. Métrica común: "celda-día con fuego" en grilla de 0.1° (binaria por celda y día).
     Atenúa la diferencia de resolución (MODIS 1 km vs VIIRS 375 m).
  2. Filtros: type == 0 (fuego de vegetación); MODIS confianza >= 30; VIIRS confianza n/h.
  3. Calibración en el solapamiento (2012-02 .. 2025-12): k = ΣVIIRS / ΣMODIS por
     departamento × mes-del-año, con shrinkage empírico hacia la macro-región
     (costa/sierra/selva) y de ésta hacia el nivel nacional:  k_d = (ΣV_d + α·k_r) / (ΣM_d + α).
  4. Retroproyección: MODIS 2000-11 .. 2012-01 × k  =>  serie "equivalente VIIRS" continua.
  5. Incertidumbre: bootstrap de años del solapamiento (percentiles 5–95).
  6. Validación: se excluye un año, se calibra con el resto y se predice ese año.
"""
import csv
import json
import math
import random
import statistics
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "web" / "data"
OUT.mkdir(parents=True, exist_ok=True)

LON0, LAT0 = -82.0, -19.0
FINE, COARSE = 0.1, 0.25
SWITCH = (2012 - 2000) * 12 + 1        # 2012-02: primer mes completo de VIIRS S-NPP
LAST = (2025 - 2000) * 12 + 11         # 2025-12
ALPHA = 50.0                            # pseudo-cuentas del shrinkage
N_BOOT = 400

MACRO = {
    "selva": ["LORETO", "UCAYALI", "MADRE DE DIOS", "SAN MARTIN", "AMAZONAS"],
    "sierra": ["CAJAMARCA", "ANCASH", "HUANUCO", "PASCO", "JUNIN", "HUANCAVELICA",
               "AYACUCHO", "APURIMAC", "CUSCO", "PUNO"],
    "costa": ["TUMBES", "PIURA", "LAMBAYEQUE", "LA LIBERTAD", "LIMA", "CALLAO", "ICA",
              "AREQUIPA", "MOQUEGUA", "TACNA"],
}
REGION_OF = {d: r for r, ds in MACRO.items() for d in ds}


def month_index(date):  # "YYYY-MM-DD" -> meses desde 2000-01
    return (int(date[:4]) - 2000) * 12 + int(date[5:7]) - 1


# ---------------------------------------------------------------- geometría
def load_departments():
    gj = json.loads((RAW / "geo" / "peru_departamental_simple.geojson").read_text(encoding="utf-8"))
    deps = []
    for f in gj["features"]:
        g = f["geometry"]
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        rings = [p[0] for p in polys]  # anillos exteriores (no hay huecos relevantes)
        xs = [x for r in rings for x, _ in r]
        ys = [y for r in rings for _, y in r]
        deps.append({"name": f["properties"]["NOMBDEP"], "rings": rings,
                     "bbox": (min(xs), min(ys), max(xs), max(ys)),
                     "c": (statistics.fmean(xs), statistics.fmean(ys))})
    deps.sort(key=lambda d: d["name"])
    return gj, deps


def in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def locate(x, y, deps):
    for i, d in enumerate(deps):
        x0, y0, x1, y1 = d["bbox"]
        if x0 <= x <= x1 and y0 <= y <= y1 and any(in_ring(x, y, r) for r in d["rings"]):
            return i
    return None


# ---------------------------------------------------------------- lectura FIRMS
def read_sensor(prefix, keep):
    """Devuelve dict celda0.1 -> set(fechas) y un punto de muestra por celda."""
    cells = defaultdict(set)
    sample = {}
    n_raw = n_kept = 0
    for path in sorted((RAW / "firms").glob(f"{prefix}_*_Peru.csv")):
        with path.open(newline="", encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                n_raw += 1
                if row.get("type", "0") not in ("0", "") or not keep(row):
                    continue
                n_kept += 1
                lon, lat = float(row["longitude"]), float(row["latitude"])
                key = (int(math.floor((lon - LON0) / FINE)), int(math.floor((lat - LAT0) / FINE)))
                cells[key].add(row["acq_date"])
                sample.setdefault(key, (lon, lat))
    print(f"  {prefix}: {n_raw:,} detecciones, {n_kept:,} tras filtros, "
          f"{sum(len(v) for v in cells.values()):,} celda-días")
    return cells, sample


def main():
    random.seed(42)
    gj, deps = load_departments()
    dep_names = [d["name"] for d in deps]
    regions = sorted(MACRO)
    dep_region = [regions.index(REGION_OF[n]) for n in dep_names]

    print("Leyendo FIRMS…")
    modis, s1 = read_sensor("modis", lambda r: int(r["confidence"]) >= 30)
    viirs, s2 = read_sensor("viirs-snpp", lambda r: r["confidence"] in ("n", "h", "nominal", "high"))
    sample = {**s2, **s1}

    # departamento de cada celda 0.1°
    print("Asignando departamentos…")
    cell_dep = {}
    for key in set(modis) | set(viirs):
        cx = LON0 + (key[0] + 0.5) * FINE
        cy = LAT0 + (key[1] + 0.5) * FINE
        d = locate(cx, cy, deps)
        if d is None:
            d = locate(*sample[key], deps)
        if d is None:  # costa/frontera: centroide más cercano
            px, py = sample[key]
            d = min(range(len(deps)), key=lambda i: (deps[i]["c"][0] - px) ** 2 + (deps[i]["c"][1] - py) ** 2)
        cell_dep[key] = d

    # agregados: por celda 0.25° y por departamento
    nmonths = LAST + 1
    coarse = {}  # (x,y) -> {"M": {m:n}, "V": {m:n}, "dep": {d:n}}
    depM = [[0] * nmonths for _ in deps]
    depV = [[0] * nmonths for _ in deps]
    for sensor, cells, dep_arr in (("M", modis, depM), ("V", viirs, depV)):
        for key, dates in cells.items():
            cx = LON0 + (key[0] + 0.5) * FINE
            cy = LAT0 + (key[1] + 0.5) * FINE
            ck = (int((cx - LON0) // COARSE), int((cy - LAT0) // COARSE))
            c = coarse.setdefault(ck, {"M": defaultdict(int), "V": defaultdict(int), "dep": defaultdict(int)})
            d = cell_dep[key]
            for dt in dates:
                m = month_index(dt)
                if m > LAST:
                    continue
                c[sensor][m] += 1
                c["dep"][d] += 1
                dep_arr[d][m] += 1

    # ------------------------------------------------------------ calibración
    years = list(range(2012, 2026))

    def months_of(y):
        return [m for m in range((y - 2000) * 12, (y - 2000) * 12 + 12) if SWITCH <= m <= LAST]

    # sumas por (dep, mes-del-año, año)
    SM = [[defaultdict(int) for _ in range(12)] for _ in deps]
    SV = [[defaultdict(int) for _ in range(12)] for _ in deps]
    for d in range(len(deps)):
        for y in years:
            for m in months_of(y):
                SM[d][m % 12][y] += depM[d][m]
                SV[d][m % 12][y] += depV[d][m]

    def fit(year_list):
        """k[dep][moy] con shrinkage dep -> región -> nacional."""
        cnt = defaultdict(int)
        for y in year_list:
            cnt[y] += 1
        def s(arr, d, moy):
            return sum(arr[d][moy][y] * w for y, w in cnt.items())
        k = [[1.0] * 12 for _ in deps]
        for moy in range(12):
            sm_d = [s(SM, d, moy) for d in range(len(deps))]
            sv_d = [s(SV, d, moy) for d in range(len(deps))]
            nat_m, nat_v = sum(sm_d), sum(sv_d)
            k_nat = nat_v / nat_m if nat_m else 1.0
            k_reg = []
            for r in range(len(regions)):
                rm = sum(sm_d[d] for d in range(len(deps)) if dep_region[d] == r)
                rv = sum(sv_d[d] for d in range(len(deps)) if dep_region[d] == r)
                k_reg.append((rv + ALPHA * k_nat) / (rm + ALPHA))
            for d in range(len(deps)):
                kr = k_reg[dep_region[d]]
                k[d][moy] = (sv_d[d] + ALPHA * kr) / (sm_d[d] + ALPHA)
        return k

    k = fit(years)
    boots = [fit([random.choice(years) for _ in years]) for _ in range(N_BOOT)]

    def pct(vals, p):
        v = sorted(vals)
        return v[min(len(v) - 1, max(0, int(round(p * (len(v) - 1)))))]

    k_lo = [[pct([b[d][m] for b in boots], 0.05) for m in range(12)] for d in range(len(deps))]
    k_hi = [[pct([b[d][m] for b in boots], 0.95) for m in range(12)] for d in range(len(deps))]

    # ------------------------------------------------------------ validación LOYO
    def r2(obs, pred):
        mu = statistics.fmean(obs)
        ss_tot = sum((o - mu) ** 2 for o in obs)
        ss_res = sum((o - p) ** 2 for o, p in zip(obs, pred))
        return 1 - ss_res / ss_tot if ss_tot else float("nan")

    methods = {"crudo": [], "k_nacional": [], "k_mes": [], "k_dep_mes": []}
    obs_dm = []  # (dep, mes) para R² log a nivel departamento-mes
    loyo_rows = []
    for y in years:
        rest = [x for x in years if x != y]
        kd = fit(rest)
        tm = sum(SM[d][moy][x] for d in range(len(deps)) for moy in range(12) for x in rest)
        tv = sum(SV[d][moy][x] for d in range(len(deps)) for moy in range(12) for x in rest)
        k_const = tv / tm
        k_moy = []
        for moy in range(12):
            a = sum(SM[d][moy][x] for d in range(len(deps)) for x in rest)
            b = sum(SV[d][moy][x] for d in range(len(deps)) for x in rest)
            k_moy.append(b / a if a else k_const)
        for d in range(len(deps)):
            for moy in range(12):
                M, V = SM[d][moy][y], SV[d][moy][y]
                if M == 0 and V == 0:
                    continue
                preds = {"crudo": M, "k_nacional": M * k_const, "k_mes": M * k_moy[moy], "k_dep_mes": M * kd[d][moy]}
                obs_dm.append(V)
                for name, p in preds.items():
                    methods[name].append(p)
        nat_obs = sum(SV[d][moy][y] for d in range(len(deps)) for moy in range(12))
        nat_pred = sum(SM[d][moy][y] * kd[d][moy] for d in range(len(deps)) for moy in range(12))
        nat_raw = sum(SM[d][moy][y] for d in range(len(deps)) for moy in range(12))
        loyo_rows.append({"year": y, "viirs": nat_obs, "pred": round(nat_pred), "modis": nat_raw})

    def summarize(pred):
        lo = [math.log1p(o) for o in obs_dm]
        lp = [math.log1p(p) for p in pred]
        mae = statistics.fmean(abs(o - p) for o, p in zip(obs_dm, pred))
        bias = (sum(pred) - sum(obs_dm)) / sum(obs_dm)
        return {"r2_log": round(r2(lo, lp), 3), "mae": round(mae, 1), "sesgo_pct": round(100 * bias, 1)}

    validation = {
        "nivel": "departamento × mes, año excluido (leave-one-year-out 2012–2025)",
        "n": len(obs_dm),
        "metodos": {name: summarize(p) for name, p in methods.items()},
        "anual_nacional": loyo_rows,
        "error_anual_pct": round(statistics.fmean(abs(r["pred"] - r["viirs"]) / r["viirs"] * 100 for r in loyo_rows), 1),
        "ratio_por_anio": [
            {"year": y,
             "ratio": round(sum(SV[d][moy][y] for d in range(len(deps)) for moy in range(12)) /
                            max(1, sum(SM[d][moy][y] for d in range(len(deps)) for moy in range(12))), 3)}
            for y in years],
    }

    # ------------------------------------------------------------ salida web
    cells_out = []
    for (x, y), c in sorted(coarse.items()):
        ms = sorted(set(c["M"]) | set(c["V"]))
        dep = max(c["dep"].items(), key=lambda kv: kv[1])[0]
        cells_out.append([x, y, dep, ms, [c["M"].get(m, 0) for m in ms], [c["V"].get(m, 0) for m in ms]])

    first_month = min(m for c in cells_out for m in c[3])
    (OUT / "grid.json").write_text(json.dumps({
        "res": COARSE, "lon0": LON0, "lat0": LAT0,
        "first": first_month, "last": LAST, "switch": SWITCH,
        "cells": cells_out,
    }, separators=(",", ":")), encoding="utf-8")

    (OUT / "calib.json").write_text(json.dumps({
        "deps": dep_names, "regions": regions, "dep_region": dep_region,
        "k": [[round(v, 4) for v in row] for row in k],
        "lo": [[round(v, 4) for v in row] for row in k_lo],
        "hi": [[round(v, 4) for v in row] for row in k_hi],
        "alpha": ALPHA, "overlap": ["2012-02", "2025-12"], "boot": N_BOOT,
    }, separators=(",", ":")), encoding="utf-8")

    (OUT / "validation.json").write_text(json.dumps(validation, indent=1), encoding="utf-8")
    (OUT / "departments.geojson").write_text(json.dumps(gj, separators=(",", ":")), encoding="utf-8")

    print(f"Celdas 0.25°: {len(cells_out):,}")
    print("Validación:", json.dumps(validation["metodos"], indent=1))
    print("Error anual nacional medio (%):", validation["error_anual_pct"])
    print("Ratio V/M por año:", [(r["year"], r["ratio"]) for r in validation["ratio_por_anio"]])


if __name__ == "__main__":
    main()
