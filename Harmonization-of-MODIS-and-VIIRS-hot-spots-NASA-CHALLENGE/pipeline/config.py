"""Shared configuration for the FireCal pipeline."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
FIRMS = RAW / "firms"
NRT = RAW / "nrt"
REF = RAW / "ref"
INTERIM = ROOT / "data" / "interim"
PUBLIC = ROOT / "app" / "public" / "data"

SENSORS = {
    # sensor id: (first year, last full year)
    "modis": (2000, 2025),
    "viirs-snpp": (2012, 2025),
}
FIRMS_YEARLY = "https://firms.modaps.eosdis.nasa.gov/data/country/zips/{sensor}_{year}_all_countries.zip"
FIRMS_NRT = {
    "modis": "https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_7d.csv",
    "viirs-snpp": "https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_7d.csv",
}
REFERENCE = {
    "ne_50m_admin_0_countries.geojson":
        "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson",
    "ne_110m_admin_0_countries.geojson":
        "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson",
    "Ecoregions2017.zip": "https://storage.googleapis.com/teow2016/Ecoregions2017.zip",
}

# Grids
FINE = 0.1      # degrees: fire cell-day detection grid
CELL = 0.25     # degrees: analysis / delivery grid
TILE = 10       # degrees: web tile size

# Calendar
FIRST_MONTH = 10                 # 2000-11 (MODIS Terra start), months since 2000-01
SWITCH_MONTH = (2012 - 2000) * 12 + 1   # 2012-02: first full month of VIIRS S-NPP
LAST_MONTH = (2025 - 2000) * 12 + 11    # 2025-12
CLIM_YEARS = range(2001, 2026)          # full years used for climatology

# Detection filters
MODIS_MIN_CONF = 30
VIIRS_CONF = ("n", "h", "nominal", "high")
