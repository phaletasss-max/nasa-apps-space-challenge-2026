"""
Ingest FIRMS yearly global archives into compact Parquet tables (DuckDB).

For every sensor-year zip:
  fires_{sensor}_{year}.parquet   ix, iy (0.1° grid), month, days, days_terra
      days       = distinct days the 0.1° cell had >= 1 vegetation-fire detection
      days_terra = same, Terra MODIS only (needed to bridge the pre-Aqua period 2000-11..2002-06)
  static_{sensor}_{year}.parquet  ix, iy, n   (type 1 volcano / 2 static land source)

The 0.1° "fire cell-day" is the common currency between MODIS (1 km) and VIIRS
(375 m): it counts *whether* a cell burned on a day, not how many pixels did,
which removes most of the resolution-driven difference in raw detection counts.

Usage: python pipeline/ingest.py [--force]
"""
import argparse
import shutil
import time
import zipfile

import duckdb

from config import FINE, FIRMS, INTERIM, MODIS_MIN_CONF, SENSORS, VIIRS_CONF

CONF_SQL = {
    "modis": f"TRY_CAST(confidence AS INTEGER) >= {MODIS_MIN_CONF}",
    "viirs-snpp": "lower(confidence) IN (" + ",".join(f"'{c}'" for c in VIIRS_CONF) + ")",
}


def ingest(con, sensor, year, force=False):
    zpath = FIRMS / sensor / f"{year}.zip"
    out = INTERIM / f"fires_{sensor}_{year}.parquet"
    out_static = INTERIM / f"static_{sensor}_{year}.parquet"
    if not zpath.exists():
        return f"missing {zpath.name}"
    if out.exists() and out_static.exists() and not force:
        return f"skip {sensor} {year}"
    t0 = time.time()
    tmp = INTERIM / "tmp" / f"{sensor}_{year}"
    shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True)
    with zipfile.ZipFile(zpath) as z:
        for info in z.infolist():
            if info.filename.lower().endswith(".csv"):
                info.filename = info.filename.replace("/", "_")  # flatten
                z.extract(info, tmp)
    src = f"""read_csv('{tmp.as_posix()}/*.csv', header=true, union_by_name=true, all_varchar=true)"""
    base = f"""
        SELECT CAST(floor((CAST(longitude AS DOUBLE) + 180) / {FINE}) AS INTEGER) AS ix,
               CAST(floor((CAST(latitude  AS DOUBLE) +  90) / {FINE}) AS INTEGER) AS iy,
               CAST(acq_date AS DATE) AS d,
               coalesce(TRY_CAST(type AS INTEGER), 0) AS t,
               confidence,
               lower(coalesce(satellite, '')) IN ('terra', 't') AS terra
        FROM {src}
    """
    con.execute(f"CREATE OR REPLACE TEMP TABLE det AS {base}")
    n_all = con.execute("SELECT count(*) FROM det").fetchone()[0]
    con.execute(f"""
        COPY (
          SELECT ix, iy,
                 CAST((year(d) - 2000) * 12 + month(d) - 1 AS SMALLINT) AS month,
                 CAST(count(DISTINCT d) AS SMALLINT) AS days,
                 CAST(count(DISTINCT d) FILTER (WHERE terra) AS SMALLINT) AS days_terra
          FROM det WHERE t = 0 AND {CONF_SQL[sensor]}
          GROUP BY ALL
        ) TO '{out.as_posix()}' (FORMAT parquet, COMPRESSION zstd)
    """)
    con.execute(f"""
        COPY (SELECT ix, iy, CAST(count(*) AS INTEGER) AS n FROM det WHERE t IN (1, 2) GROUP BY ALL)
        TO '{out_static.as_posix()}' (FORMAT parquet, COMPRESSION zstd)
    """)
    cd = con.execute(f"SELECT sum(days) FROM '{out.as_posix()}'").fetchone()[0]
    con.execute("DROP TABLE det")
    shutil.rmtree(tmp, ignore_errors=True)
    return f"ok   {sensor} {year}: {n_all:,} detections -> {cd:,} fire cell-days ({time.time() - t0:.0f}s)"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--only", help="sensor:year, e.g. modis:2025")
    args = ap.parse_args()
    INTERIM.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    con.execute("PRAGMA threads=8")
    jobs = [(s, y) for s, (y0, y1) in SENSORS.items() for y in range(y0, y1 + 1)]
    if args.only:
        s, y = args.only.split(":")
        jobs = [(s, int(y))]
    for s, y in jobs:
        print(ingest(con, s, y, args.force), flush=True)


if __name__ == "__main__":
    main()
