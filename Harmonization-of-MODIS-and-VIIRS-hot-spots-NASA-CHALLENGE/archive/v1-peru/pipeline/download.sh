#!/usr/bin/env bash
# Descarga los CSV anuales de FIRMS (Perú) — no requiere MAP_KEY.
set -u
OUT="$(dirname "$0")/../data/raw/firms"
mkdir -p "$OUT"
get() { # sensor year
  local f="$OUT/${1}_${2}_Peru.csv"
  [ -s "$f" ] && return 0
  curl -sf --retry 3 --max-time 300 -o "$f.part" \
    "https://firms.modaps.eosdis.nasa.gov/data/country/$1/$2/${1}_${2}_Peru.csv" && mv "$f.part" "$f" \
    && echo "ok $1 $2" || { rm -f "$f.part"; echo "FAIL $1 $2"; }
}
for y in $(seq 2000 2025); do get modis "$y"; done
for y in $(seq 2012 2025); do get viirs-snpp "$y"; done
echo DONE
