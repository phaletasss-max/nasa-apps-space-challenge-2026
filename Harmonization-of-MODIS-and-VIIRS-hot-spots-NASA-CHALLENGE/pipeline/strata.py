"""
Assign every 0.25° cell on Earth to a country (Natural Earth 1:50m) and to a
biome + biogeographic realm (RESOLVE Ecoregions 2017, Dinerstein et al. 2017).

Polygons are rasterized straight onto the 0.25° grid (PIL), largest first so that
enclaves (Lesotho, Vatican, …) overwrite their hosts. Coastal cells whose centre
falls just outside every polygon are filled from their neighbours (3-cell dilation),
so near-shore fire cells still get a country and a biome.

Output: data/interim/strata.npz
    country, biome, realm   int16 [720, 1440]  (-1 = none; row 0 = 90°S)
    countries, realms, biomes   lookup tables (json strings)
"""
import json
import time

import numpy as np
import shapefile
from PIL import Image, ImageDraw

from config import CELL, INTERIM, REF

NX, NY = int(360 / CELL), int(180 / CELL)


def cell_centres():
    lon = -180 + (np.arange(NX) + 0.5) * CELL
    lat = -90 + (np.arange(NY) + 0.5) * CELL
    lo, la = np.meshgrid(lon, lat)
    return lo.ravel(), la.ravel()


def ring_area(ring):
    x = np.asarray([p[0] for p in ring])
    y = np.asarray([p[1] for p in ring])
    return 0.5 * abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1)))


def rasterize(items):
    """items: list of (exterior_rings, value). Returns int16 grid with row 0 = south."""
    img = Image.new("I", (NX, NY), 0)
    draw = ImageDraw.Draw(img)
    items = sorted(items, key=lambda it: -sum(ring_area(r) for r in it[0]))
    for rings, value in items:
        for ring in rings:
            pts = [((lon + 180) / CELL, (90 - lat) / CELL) for lon, lat in ring]
            if len(pts) >= 3:
                draw.polygon(pts, fill=int(value) + 1)
    grid = np.asarray(img, dtype=np.int32)[::-1] - 1   # flip so row 0 = 90°S
    return grid.astype(np.int16)


def dilate(grid, steps=3):
    g = grid.copy()
    for _ in range(steps):
        miss = g < 0
        if not miss.any():
            break
        cand = np.full_like(g, -1)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            sh = np.roll(np.roll(g, dy, 0), dx, 1)
            cand = np.where((cand < 0) & (sh >= 0), sh, cand)
        g = np.where(miss, cand, g)
    return g


def exteriors(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"][0]]
    if geom["type"] == "MultiPolygon":
        return [p[0] for p in geom["coordinates"]]
    return []


def load_countries():
    gj = json.loads((REF / "ne_50m_admin_0_countries.geojson").read_text(encoding="utf-8"))
    items, meta = [], []
    for i, f in enumerate(gj["features"]):
        p = f["properties"]
        items.append((exteriors(f["geometry"]), i))
        meta.append({"a3": p["ADM0_A3"], "name": p["NAME"], "name_es": p.get("NAME_ES") or p["NAME"],
                     "continent": p.get("CONTINENT", "")})
    return items, meta


def load_ecoregions():
    r = shapefile.Reader(str(REF / "ecoregions" / "Ecoregions2017.shp"), encoding="latin-1")
    b_items, r_items, biomes, realms = [], [], {}, []
    for sr in r.iterShapeRecords():
        rec = sr.record.as_dict()
        b = int(rec["BIOME_NUM"])
        if b <= 0 or b > 14:  # 98 = N/A, 99 = rock & ice
            continue
        if rec["REALM"] not in realms:
            realms.append(rec["REALM"])
        rings = exteriors(sr.shape.__geo_interface__)
        b_items.append((rings, b))
        r_items.append((rings, realms.index(rec["REALM"])))
        biomes[b] = {"name": rec["BIOME_NAME"], "color": rec["COLOR_BIO"]}
    return b_items, r_items, realms, biomes


def main():
    t0 = time.time()
    c_items, cmeta = load_countries()
    country = dilate(rasterize(c_items))
    print(f"countries: {np.sum(country >= 0):,} cells ({time.time() - t0:.0f}s)", flush=True)
    b_items, r_items, realms, biomes = load_ecoregions()
    biome = dilate(rasterize(b_items))
    realm = dilate(rasterize(r_items))
    print(f"biomes: {np.sum(biome >= 0):,} cells, realms {realms} ({time.time() - t0:.0f}s)", flush=True)
    np.savez_compressed(
        INTERIM / "strata.npz", country=country, biome=biome, realm=realm,
        countries=json.dumps(cmeta), realms=json.dumps(realms),
        biomes=json.dumps({str(k): v for k, v in sorted(biomes.items())}),
    )
    print(f"saved strata.npz ({time.time() - t0:.0f}s)")


if __name__ == "__main__":
    main()
