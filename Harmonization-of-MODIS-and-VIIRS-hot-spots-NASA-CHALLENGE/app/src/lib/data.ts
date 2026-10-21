import type { Aoi, Meta, Nrt, Overview, Series } from "./types";

const BASE = `${import.meta.env.BASE_URL}data/`;

async function json<T>(path: string): Promise<T> {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

export const loadMeta = () => json<Meta>("meta.json");
export const loadNrt = () => json<Nrt>("nrt.json");
export const loadValidation = () => json<Record<string, unknown>>("validation.json");
export const loadCountriesGeo = () => json<GeoJSON.FeatureCollection>("countries.geojson");

/** Every VIIRS NRT detection of the early-warning window (layout: see pipeline/nrt.py write_points). */
export interface NrtPoints { lon: Float32Array; lat: Float32Array; day: Uint8Array; days: number }

export async function loadNrtPoints(): Promise<NrtPoints> {
  const [buf, nrt] = await Promise.all([fetch(BASE + "nrt_points.bin").then((r) => r.arrayBuffer()), loadNrt()]);
  const n = (buf.byteLength / 9) | 0;
  return { lon: new Float32Array(buf, 0, n), lat: new Float32Array(buf, 4 * n, n), day: new Uint8Array(buf, 8 * n, n), days: nrt.days };
}

const TYPED = {
  u4: Uint32Array, f4: Float32Array, u2: Uint16Array, i2: Int16Array, u1: Uint8Array, i1: Int8Array,
} as const;

export async function loadOverview(meta: Meta): Promise<Overview> {
  const buf = await (await fetch(BASE + "overview.bin")).arrayBuffer();
  const f = meta.overview.fields;
  const view = <K extends keyof typeof TYPED>(name: string) => {
    const { offset, type, length } = f[name];
    const C = TYPED[type as K];
    return new C(buf, offset, length) as InstanceType<(typeof TYPED)[K]>;
  };
  const ov = {
    count: meta.overview.count,
    id: view<"u4">("id"), mean: view<"f4">("mean"), trend: view<"f4">("trend"),
    nrtExp: view<"f4">("nrtExp"), nrtObs: view<"u2">("nrtObs"), country: view<"i2">("country"),
    peak: view<"u1">("peak"), conc: view<"u1">("conc"), sig: view<"i1">("sig"), biome: view<"i1">("biome"),
    index: new Map<number, number>(),
  } as Overview;
  for (let i = 0; i < ov.count; i++) ov.index.set(ov.id[i], i);
  return ov;
}

const seriesCache = new Map<string, Promise<Series>>();
export function loadSeries(key: string): Promise<Series> {
  if (!seriesCache.has(key)) seriesCache.set(key, json<Series>(`series/${key}.json`));
  return seriesCache.get(key)!;
}

// --------------------------------------------------------------------- tiles
/** One decoded 10° tile. Binary layout documented in pipeline/export.py (write_tile). */
export interface Tile {
  units: Float32Array; // [nUnits * 48]: k[12], lo[12], hi[12], r[12]
  ids: Uint32Array;
  unit: Uint32Array;
  country: Int32Array;
  offs: Uint32Array;
  months: Uint16Array;
  M: Uint16Array;
  V: Uint16Array;
}

export function decodeTile(buf: ArrayBuffer): Tile {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== "FCT2") throw new Error("bad tile magic");
  const nU = dv.getUint32(4, true), nC = dv.getUint32(8, true), nnz = dv.getUint32(12, true);
  let o = 16;
  const take = <T>(C: new (b: ArrayBuffer, o: number, n: number) => T, n: number, bytes: number): T => {
    const a = new C(buf, o, n);
    o += n * bytes;
    return a;
  };
  const units = take(Float32Array, nU * 48, 4);
  const ids = take(Uint32Array, nC, 4);
  const unit = take(Uint32Array, nC, 4);
  const country = take(Int32Array, nC, 4);
  const offs = take(Uint32Array, nC + 1, 4);
  const months = take(Uint16Array, nnz, 2);
  const M = take(Uint16Array, nnz, 2);
  const V = take(Uint16Array, nnz, 2);
  return { units, ids, unit, country, offs, months, M, V };
}

const tileCache = new Map<string, Promise<Tile | null>>();
function loadTile(key: string, available: Set<string>): Promise<Tile | null> {
  if (!available.has(key)) return Promise.resolve(null);
  if (!tileCache.has(key)) {
    tileCache.set(key, fetch(`${BASE}tiles/${key}.bin`).then((r) => r.arrayBuffer()).then(decodeTile));
  }
  return tileCache.get(key)!;
}

// --------------------------------------------------------------------- geometry
export function pointInRing(x: number, y: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function aoiBounds(aoi: Aoi): [number, number, number, number] | null {
  if (aoi.kind === "bbox") return aoi.bounds;
  if (aoi.kind === "polygon") {
    const xs = aoi.ring.map((p) => p[0]), ys = aoi.ring.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  return null;
}

export function cellCenter(id: number, meta: Meta): [number, number] {
  const { cell, nx } = meta.grid;
  const cy = Math.floor(id / nx), cx = id % nx;
  return [-180 + (cx + 0.5) * cell, -90 + (cy + 0.5) * cell];
}

export function cellInAoi(id: number, aoi: Aoi, meta: Meta): boolean {
  const [x, y] = cellCenter(id, meta);
  if (aoi.kind === "bbox") {
    const [w, s, e, n] = aoi.bounds;
    return x >= w && x <= e && y >= s && y <= n;
  }
  if (aoi.kind === "polygon") return pointInRing(x, y, aoi.ring);
  return false;
}

// --------------------------------------------------------------------- harmonization (mirrors export.harmonize)
/** Sum harmonized + raw series over all cells of a custom AOI, from tiles. */
export async function seriesForShape(aoi: Aoi, meta: Meta): Promise<Series> {
  const b = aoiBounds(aoi)!;
  const T = meta.grid.tileCells * meta.grid.cell; // 10°
  const keys: string[] = [];
  for (let tx = Math.floor((b[0] + 180) / T); tx <= Math.floor((b[2] + 180) / T); tx++)
    for (let ty = Math.floor((b[1] + 90) / T); ty <= Math.floor((b[3] + 90) / T); ty++) keys.push(`${tx}_${ty}`);
  const available = new Set(meta.tiles);
  const tiles = await Promise.all(keys.map((k) => loadTile(k, available)));

  const { first, last, switch: sw, terraOnlyLast } = meta.months;
  const n = last - first + 1;
  const out: Series = {
    first, cells: 0,
    H: new Array(n).fill(0), lo: new Array(n).fill(0), hi: new Array(n).fill(0),
    M: new Array(n).fill(0), V: new Array(n).fill(0),
  };
  for (const t of tiles) {
    if (!t) continue;
    for (let c = 0; c < t.ids.length; c++) {
      if (!cellInAoi(t.ids[c], aoi, meta)) continue;
      out.cells++;
      const u = t.unit[c] * 48;
      for (let j = t.offs[c]; j < t.offs[c + 1]; j++) {
        const m = t.months[j];
        if (m < first || m > last) continue;
        const i = m - first, mo = m % 12, a = t.M[j], v = t.V[j];
        out.M[i] += a;
        out.V[i] += v;
        if (m < sw) {
          const r = m <= terraOnlyLast ? t.units[u + 36 + mo] : 1;
          out.H[i] += a * r * t.units[u + mo];
          out.lo[i] += a * r * t.units[u + 12 + mo];
          out.hi[i] += a * r * t.units[u + 24 + mo];
        } else {
          out.H[i] += v;
          out.lo[i] += v;
          out.hi[i] += v;
        }
      }
    }
  }
  return out;
}

export function seriesForAoi(aoi: Aoi, meta: Meta): Promise<Series> {
  if (aoi.kind === "world") return loadSeries("WORLD");
  if (aoi.kind === "country") return loadSeries(aoi.a3);
  if (aoi.kind === "biome") return loadSeries(aoi.key);
  return seriesForShape(aoi, meta);
}

/** Cells of the overview inside an AOI (used for this-week totals and map highlight). */
export function overviewRows(aoi: Aoi, ov: Overview, meta: Meta): number[] {
  const rows: number[] = [];
  if (aoi.kind === "world") {
    for (let i = 0; i < ov.count; i++) rows.push(i);
  } else if (aoi.kind === "country") {
    const c = meta.countries.find((x) => x.a3 === aoi.a3);
    if (c) for (let i = 0; i < ov.count; i++) if (ov.country[i] === c.idx) rows.push(i);
  } else if (aoi.kind === "biome") {
    const id = Number(aoi.key.slice(1));
    for (let i = 0; i < ov.count; i++) if (ov.biome[i] === id) rows.push(i);
  } else {
    for (let i = 0; i < ov.count; i++) if (cellInAoi(ov.id[i], aoi, meta)) rows.push(i);
  }
  return rows;
}
