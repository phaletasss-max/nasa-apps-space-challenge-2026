import { create } from "zustand";
import type { Aoi, Basemap, CalMode, Lang, LayerId, Meta, Nrt, Overview, RenderMode, SeriesMode } from "./types";

export type DrawMode = null | "rect" | "poly";
export type View = "explore" | "methods";

interface State {
  meta: Meta | null;
  overview: Overview | null;
  nrt: Nrt | null;
  countriesGeo: GeoJSON.FeatureCollection | null;
  aoi: Aoi;
  year: number;
  layer: LayerId;
  basemap: Basemap;
  mode: SeriesMode;
  cal: CalMode;
  lang: Lang;
  draw: DrawMode;
  view: View;
  extruded: boolean;
  render: RenderMode;
  set: (p: Partial<State>) => void;
}

const initialLang: Lang = navigator.language?.toLowerCase().startsWith("es") ? "es" : "en";

export const useStore = create<State>((set) => ({
  meta: null, overview: null, nrt: null, countriesGeo: null,
  aoi: { kind: "world" }, year: 2024, layer: "activity", basemap: "dark",
  mode: "harm", cal: "count", lang: initialLang, draw: null, view: "explore", extruded: false, render: "grid",
  ...readHash(),
  set: (p) => set(p),
}));

// ---------------------------------------------------------------- URL hash <-> state
export function aoiToHash(a: Aoi): string {
  switch (a.kind) {
    case "world": return "world";
    case "country": return `c:${a.a3}`;
    case "biome": return `b:${a.key}`;
    case "bbox": return `r:${a.bounds.map((v) => v.toFixed(2)).join(",")}`;
    case "polygon": return `p:${a.ring.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(",")}`;
  }
}

export function hashToAoi(h: string): Aoi | null {
  if (h === "world") return { kind: "world" };
  const [k, v] = [h.slice(0, 2), h.slice(2)];
  if (k === "c:") return { kind: "country", a3: v };
  if (k === "b:") return { kind: "biome", key: v };
  if (k === "r:") {
    const b = v.split(",").map(Number);
    return b.length === 4 && b.every(Number.isFinite) ? { kind: "bbox", bounds: b as [number, number, number, number] } : null;
  }
  if (k === "p:") {
    const ring = v.split(",").map((p) => p.split(" ").map(Number) as [number, number]);
    return ring.length >= 3 ? { kind: "polygon", ring } : null;
  }
  return null;
}

export function writeHash(s: Pick<State, "aoi" | "year" | "layer" | "lang" | "view">) {
  const q = new URLSearchParams({ aoi: aoiToHash(s.aoi), y: String(s.year), l: s.layer, lang: s.lang });
  if (s.view === "methods") q.set("v", "methods");
  const h = "#" + q.toString();
  if (location.hash !== h) history.replaceState(null, "", h);
}

export function readHash(): Partial<State> {
  const q = new URLSearchParams(location.hash.slice(1));
  const out: Partial<State> = {};
  const a = q.get("aoi");
  if (a) { const aoi = hashToAoi(a); if (aoi) out.aoi = aoi; }
  const y = Number(q.get("y"));
  if (y >= 2001 && y <= 2025) out.year = y;
  const l = q.get("l");
  if (l === "activity" || l === "peak" || l === "trend" || l === "week") out.layer = l;
  const lang = q.get("lang");
  if (lang === "en" || lang === "es") out.lang = lang;
  if (q.get("v") === "methods") out.view = "methods";
  return out;
}
