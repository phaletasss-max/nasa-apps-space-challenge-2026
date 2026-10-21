export type Lang = "en" | "es";
export type LayerId = "activity" | "peak" | "trend" | "week";
export type CalMode = "count" | "z";
export type SeriesMode = "harm" | "naive";
export type Basemap = "dark" | "blackmarble" | "bluemarble";
export type RenderMode = "grid" | "smooth";

export interface CountryMeta {
  a3: string;
  idx: number;
  name: string;
  name_es: string;
  continent: string;
  cells: number;
  mean: number;
  bbox: [number, number, number, number];
}

export interface BiomeMeta {
  id: number;
  key: string;
  name: string;
  color: string;
  cells: number;
  mean: number;
}

export interface FieldLayout {
  offset: number;
  type: string;
  length: number;
}

export interface Meta {
  version: string;
  generated: string;
  grid: { cell: number; nx: number; tileCells: number };
  months: { first: number; last: number; switch: number; terraOnlyLast: number; climYears: [number, number] };
  calibration: { years: [number, number]; alpha: number; bootstrap: number };
  overview: { count: number; fields: Record<string, FieldLayout> };
  tiles: string[];
  countries: CountryMeta[];
  biomes: BiomeMeta[];
  nrt: { window: [string, string]; days: number; points?: number };
  stats: {
    cells: number; world_mean_annual: number; increasing: number; decreasing: number; eligible: number;
    detections: { modis: number; "viirs-snpp": number };
  };
}

export interface Overview {
  count: number;
  id: Uint32Array;
  mean: Float32Array;
  trend: Float32Array;
  nrtExp: Float32Array;
  nrtObs: Uint16Array;
  country: Int16Array;
  peak: Uint8Array;
  conc: Uint8Array;
  sig: Int8Array;
  biome: Int8Array;
  index: Map<number, number>;
}

/** Monthly series aligned to months[first..last] (months since 2000-01). */
export interface Series {
  first: number;
  H: number[];
  lo: number[];
  hi: number[];
  M: number[];
  V: number[];
  cells: number;
}

export type Aoi =
  | { kind: "world" }
  | { kind: "country"; a3: string }
  | { kind: "biome"; key: string }
  | { kind: "bbox"; bounds: [number, number, number, number]; label?: string }
  | { kind: "polygon"; ring: [number, number][]; label?: string };

export interface NrtRow {
  obs: number;
  exp: number;
  ratio: number | null;
  p: number;
}

export interface Nrt {
  window: [string, string];
  days: number;
  source: string;
  world: NrtRow;
  countries: (NrtRow & { a3: string })[];
  biomes: (NrtRow & { key: string })[];
  generated: string;
}
