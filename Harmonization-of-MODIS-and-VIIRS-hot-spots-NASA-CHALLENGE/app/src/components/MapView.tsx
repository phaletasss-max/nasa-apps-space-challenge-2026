import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import type { LayersList, PickingInfo } from "@deck.gl/core";
import { ColumnLayer, GeoJsonLayer, PolygonLayer, ScatterplotLayer, SolidPolygonLayer } from "@deck.gl/layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { useStore } from "../lib/store";
import { activityT, cellRGBA, FIRE, ramp, RECENCY } from "../lib/colors";
import { cellCenter, loadNrtPoints, overviewRows, type NrtPoints } from "../lib/data";
import { fmt, months, tr } from "../lib/i18n";
import type { Aoi, Basemap, Meta, Overview } from "../lib/types";

// MapLibre 6 ships its worker as a separate ES module; let Vite bundle it and hand MapLibre the URL.
maplibregl.setWorkerUrl(maplibreWorkerUrl);

/** Vector basemap (OpenFreeMap, OpenStreetMap data) or NASA GIBS raster mosaics (multi-resolution tiles). */
const GIBS = {
  blackmarble: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png",
  bluemarble: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/2004-08-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
};
const VECTOR_DARK = "https://tiles.openfreemap.org/styles/dark";

function styleFor(b: Basemap): string | StyleSpecification {
  if (b === "dark") return VECTOR_DARK;
  return {
    version: 8,
    sources: { base: { type: "raster", tiles: [GIBS[b]], tileSize: 256, maxzoom: 8, attribution: "NASA GIBS" } },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#07090c" } },
      { id: "base", type: "raster", source: "base", paint: { "raster-opacity": b === "bluemarble" ? 0.75 : 1 } },
    ],
  };
}

/** Cell squares as one binary polygon buffer (closed CCW rings, 5 vertices each). */
function cellGeometry(ov: Overview, meta: Meta) {
  const { nx, cell } = meta.grid;
  const inset = cell * 0.04; // hairline gap: reads as a data grid when zoomed in
  const positions = new Float32Array(ov.count * 10);
  const startIndices = new Uint32Array(ov.count + 1);
  for (let i = 0; i < ov.count; i++) {
    const id = ov.id[i];
    const w = -180 + (id % nx) * cell + inset, s = -90 + Math.floor(id / nx) * cell + inset;
    const e = w + cell - 2 * inset, n = Math.min(85, s + cell - 2 * inset);
    positions.set([w, s, e, s, e, n, w, n, w, s], i * 10);
    startIndices[i] = i * 5;
  }
  startIndices[ov.count] = ov.count * 5;
  return { positions, startIndices };
}

interface Hover { x: number; y: number; row: number }

export default function MapView() {
  const { meta, overview: ov, countriesGeo, layer, basemap, aoi, draw, lang, extruded, render, set } = useStore();
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [drawPts, setDrawPts] = useState<[number, number][]>([]);
  const [cursor, setCursor] = useState<[number, number] | null>(null);
  const [styleGen, setStyleGen] = useState(0);
  const [zoom, setZoom] = useState(1.4);
  const [points, setPoints] = useState<NrtPoints | null>(null);

  // ---- map init
  useEffect(() => {
    const map = new maplibregl.Map({
      container: box.current!, style: styleFor(useStore.getState().basemap),
      center: [10, 15], zoom: 1.4, minZoom: 1, maxZoom: 11, attributionControl: { compact: true },
      renderWorldCopies: false, maxPitch: 70,
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");
    // Overlay mode (not interleaved): deck.gl 9.4's interleaved renderer is not compatible with MapLibre 6.
    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    map.addControl(overlay);
    map.on("style.load", () => setStyleGen((g) => g + 1));
    map.on("zoomend", () => setZoom(map.getZoom()));
    mapRef.current = map;
    overlayRef.current = overlay;
    return () => map.remove();
  }, []);

  useEffect(() => { mapRef.current?.setStyle(styleFor(basemap)); }, [basemap]);

  // ---- NRT detection points, loaded on first use of the week layer
  useEffect(() => {
    if (layer === "week" && !points) loadNrtPoints().then(setPoints).catch(() => undefined);
  }, [layer, points]);

  const aoiRows = useMemo(() => {
    if (!ov || !meta || aoi.kind === "world") return undefined;
    return new Set(overviewRows(aoi, ov, meta));
  }, [aoi, ov, meta]);

  const geom = useMemo(() => (ov && meta ? cellGeometry(ov, meta) : null), [ov, meta]);

  // per-vertex colours for the active layer
  const cellData = useMemo(() => {
    if (!ov || !geom) return null;
    const colors = new Uint8Array(ov.count * 20);
    for (let i = 0; i < ov.count; i++) {
      const c = cellRGBA(layer, ov, i, aoiRows ? !aoiRows.has(i) : false);
      if (!c) continue;
      for (let v = 0; v < 5; v++) colors.set(c, i * 20 + v * 4);
    }
    return {
      length: ov.count, startIndices: geom.startIndices,
      attributes: { getPolygon: { value: geom.positions, size: 2 }, getFillColor: { value: colors, size: 4, normalized: true } },
    };
  }, [ov, geom, layer, aoiRows]);

  const heatData = useMemo(() => {
    if (!ov || !meta || layer !== "activity" || render !== "smooth") return null;
    const rows: number[] = [];
    for (let i = 0; i < ov.count; i++) if (ov.mean[i] >= 0.15) rows.push(i);
    return rows;
  }, [ov, meta, layer, render]);

  const columns = useMemo(() => {
    if (!ov || !extruded) return [];
    const rows: number[] = [];
    for (let i = 0; i < ov.count; i++) if (ov.mean[i] >= 1) rows.push(i);
    return rows;
  }, [ov, extruded]);

  const pointData = useMemo(() => {
    if (!points) return null;
    const n = points.lon.length;
    const pos = new Float32Array(n * 2);
    const col = new Uint8Array(n * 4);
    const last = Math.max(1, points.days - 1);
    for (let i = 0; i < n; i++) {
      pos[2 * i] = points.lon[i]; pos[2 * i + 1] = points.lat[i];
      const c = ramp(RECENCY, points.day[i] / last);
      col.set([c[0], c[1], c[2], 230], 4 * i);
    }
    return { length: n, attributes: { getPosition: { value: pos, size: 2 }, getFillColor: { value: col, size: 4, normalized: true } } };
  }, [points]);

  // ---- fly to AOI
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !meta) return;
    const b = boundsOf(aoi, meta);
    if (b) map.fitBounds(b, { padding: 70, duration: 1200, maxZoom: 6 });
    else map.fitBounds([-168, -56, 178, 76], { padding: 10, duration: 1200 });
  }, [aoi, meta]);

  // ---- drawing interactions
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setDrawPts([]);
    if (!draw) {
      map.dragPan.enable(); map.doubleClickZoom.enable(); map.getCanvas().style.cursor = "";
      return;
    }
    map.getCanvas().style.cursor = "crosshair";
    let start: maplibregl.LngLat | null = null;
    const pts: [number, number][] = [];
    const finish = (a: Aoi | null) => { if (a) set({ aoi: a }); set({ draw: null }); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(null); };
    const onMove = (e: maplibregl.MapMouseEvent) => {
      setCursor([e.lngLat.lng, e.lngLat.lat]);
      if (draw === "rect" && start) setDrawPts(rect(start, e.lngLat));
    };
    const onDown = (e: maplibregl.MapMouseEvent) => { if (draw === "rect") { start = e.lngLat; map.dragPan.disable(); } };
    const onUp = (e: maplibregl.MapMouseEvent) => {
      if (draw !== "rect" || !start) return;
      const w = Math.min(start.lng, e.lngLat.lng), eLng = Math.max(start.lng, e.lngLat.lng);
      const s = Math.min(start.lat, e.lngLat.lat), n = Math.max(start.lat, e.lngLat.lat);
      start = null;
      finish(eLng - w > 0.2 && n - s > 0.2 ? { kind: "bbox", bounds: [w, s, eLng, n] } : null);
    };
    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (draw !== "poly") return;
      pts.push([e.lngLat.lng, e.lngLat.lat]);
      setDrawPts([...pts]);
    };
    const onDbl = (e: maplibregl.MapMouseEvent) => {
      if (draw !== "poly") return;
      e.preventDefault();
      finish(pts.length >= 3 ? { kind: "polygon", ring: [...pts, pts[0]] } : null);
    };
    if (draw === "poly") map.doubleClickZoom.disable();
    map.on("mousemove", onMove); map.on("mousedown", onDown); map.on("mouseup", onUp);
    map.on("click", onClick); map.on("dblclick", onDbl);
    window.addEventListener("keydown", onKey);
    return () => {
      map.off("mousemove", onMove); map.off("mousedown", onDown); map.off("mouseup", onUp);
      map.off("click", onClick); map.off("dblclick", onDbl);
      window.removeEventListener("keydown", onKey);
      map.dragPan.enable(); map.doubleClickZoom.enable(); map.getCanvas().style.cursor = "";
    };
  }, [draw, set]);

  useEffect(() => {
    mapRef.current?.easeTo({ pitch: extruded ? 50 : 0, bearing: extruded ? -12 : 0, duration: 900 });
  }, [extruded]);

  // ---- deck layers
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !meta || !ov || !styleGen) return;
    const selectedA3 = aoi.kind === "country" ? aoi.a3 : null;
    const showPoints = layer === "week" && pointData && zoom >= 3.5;
    const layers = [
      cellData && !extruded && !heatData && new SolidPolygonLayer({
        id: "cells", data: cellData, _normalize: false, filled: true, extruded: false,
        opacity: showPoints ? 0.45 : 1,
      }),
      heatData && !extruded && new HeatmapLayer<number>({
        id: "heat", data: heatData, getPosition: (i) => cellCenter(ov.id[i], meta), getWeight: (i) => Math.sqrt(ov.mean[i]),
        radiusPixels: 22, intensity: 1.6, threshold: 0.05, colorRange: FIRE.map((c) => [...c, 255] as [number, number, number, number]),
        aggregation: "SUM",
      }),
      extruded && new ColumnLayer<number>({
        id: "columns", data: columns, diskResolution: 4, angle: 45, radius: 13000, extruded: true, coverage: 1,
        getPosition: (i) => cellCenter(ov.id[i], meta),
        getElevation: (i) => Math.sqrt(ov.mean[i]) * 22000,
        getFillColor: (i) => [...ramp(FIRE, activityT(ov.mean[i])), aoiRows && !aoiRows.has(i) ? 70 : 235] as [number, number, number, number],
        material: { ambient: 0.6, diffuse: 0.6, shininess: 20 },
        updateTriggers: { getFillColor: [aoi] },
      }),
      showPoints && new ScatterplotLayer({
        id: "nrt-points", data: pointData, radiusUnits: "meters", getRadius: 190,
        radiusMinPixels: 1.4, radiusMaxPixels: 40, stroked: false, antialiasing: true,
      }),
      countriesGeo && new GeoJsonLayer({
        id: "countries", data: countriesGeo, pickable: !draw, stroked: true, filled: true,
        getFillColor: [0, 0, 0, 1], getLineColor: [150, 160, 180, 80], lineWidthMinPixels: 0.6,
        onClick: (info: PickingInfo) => {
          const a3 = (info.object as GeoJSON.Feature | undefined)?.properties?.a3 as string | undefined;
          if (a3 && meta.countries.some((c) => c.a3 === a3)) set({ aoi: { kind: "country", a3 } });
        },
      }),
      countriesGeo && selectedA3 ? new GeoJsonLayer({
        id: "selected", data: { ...countriesGeo, features: countriesGeo.features.filter((f) => f.properties?.a3 === selectedA3) },
        stroked: true, filled: false, getLineColor: [255, 209, 102, 255], lineWidthMinPixels: 2.2,
      }) : null,
      (aoi.kind === "bbox" || aoi.kind === "polygon") && new PolygonLayer({
        id: "aoi", data: [aoi.kind === "bbox" ? bboxRing(aoi.bounds) : aoi.ring], getPolygon: (d: [number, number][]) => d,
        stroked: true, filled: true, getFillColor: [255, 209, 102, 18], getLineColor: [255, 209, 102, 255], lineWidthMinPixels: 2,
      }),
      drawPts.length > 0 && new PolygonLayer({
        id: "drawing", data: [draw === "poly" && cursor ? [...drawPts, cursor] : drawPts], getPolygon: (d: [number, number][]) => d,
        stroked: true, filled: true, getFillColor: [255, 209, 102, 30], getLineColor: [255, 209, 102, 255], lineWidthMinPixels: 1.5,
      }),
    ].filter(Boolean) as LayersList;
    overlay.setProps({
      layers,
      onHover: (info: PickingInfo) => {
        if (!info.coordinate || draw) return setHover(null);
        const [lon, lat] = info.coordinate as [number, number];
        const { nx, cell } = meta.grid;
        const id = Math.floor((lat + 90) / cell) * nx + Math.floor((lon + 180) / cell);
        const row = ov.index.get(id);
        setHover(row === undefined ? null : { x: info.x, y: info.y, row });
      },
    });
  }, [cellData, heatData, pointData, columns, extruded, countriesGeo, aoi, aoiRows, draw, drawPts, cursor, layer, meta, ov, set,
    styleGen, zoom]);

  return (
    <div className="map-wrap">
      <div ref={box} className="map" />
      {hover && ov && <HoverCard h={hover} lang={lang} />}
      {draw && <div className="draw-hint">{tr(lang, draw === "rect" ? "draw_hint_rect" : "draw_hint_poly")}</div>}
      {layer === "week" && zoom < 3.5 && !draw && <div className="map-tip">{tr(lang, "points_hint")}</div>}
    </div>
  );
}

function HoverCard({ h, lang }: { h: Hover; lang: "en" | "es" }) {
  const ov = useStore((s) => s.overview)!;
  const meta = useStore((s) => s.meta)!;
  const i = h.row;
  const [lon, lat] = cellCenter(ov.id[i], meta);
  const country = meta.countries.find((c) => c.idx === ov.country[i]);
  const obs = ov.nrtObs[i], exp = ov.nrtExp[i];
  return (
    <div className="hover-card" style={{ left: h.x + 14, top: h.y + 14 }}>
      <div className="hc-title">{country ? (lang === "es" ? country.name_es : country.name) : "—"}
        <span className="hc-coord">{lat.toFixed(2)}°, {lon.toFixed(2)}°</span></div>
      <div className="hc-row"><span>{tr(lang, "hover_mean")}</span><b>{fmt(ov.mean[i], lang, 1)}</b></div>
      {ov.peak[i] < 12 && <div className="hc-row"><span>{tr(lang, "hover_peak")}</span><b>{months(lang)[ov.peak[i]]} · {ov.conc[i]}%</b></div>}
      {ov.mean[i] >= 2 && <div className="hc-row"><span>{tr(lang, "hover_trend")}</span>
        <b className={ov.sig[i] > 0 ? "up" : ov.sig[i] < 0 ? "down" : ""}>{ov.trend[i] >= 0 ? "+" : ""}{fmt(ov.trend[i], lang)}%/10y{ov.sig[i] ? " *" : ""}</b></div>}
      {(obs > 0 || exp >= 0.05) && <div className="hc-row"><span>{tr(lang, "hover_week")}</span><b>{obs} / {fmt(exp, lang, 1)}</b></div>}
    </div>
  );
}

function rect(a: maplibregl.LngLat, b: maplibregl.LngLat): [number, number][] {
  return [[a.lng, a.lat], [b.lng, a.lat], [b.lng, b.lat], [a.lng, b.lat], [a.lng, a.lat]];
}

function bboxRing([w, s, e, n]: [number, number, number, number]): [number, number][] {
  return [[w, s], [e, s], [e, n], [w, n], [w, s]];
}

function boundsOf(aoi: Aoi, meta: Meta): [number, number, number, number] | null {
  if (aoi.kind === "country") return meta.countries.find((c) => c.a3 === aoi.a3)?.bbox ?? null;
  if (aoi.kind === "bbox") return aoi.bounds;
  if (aoi.kind === "polygon") {
    const xs = aoi.ring.map((p) => p[0]), ys = aoi.ring.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  return null;
}
