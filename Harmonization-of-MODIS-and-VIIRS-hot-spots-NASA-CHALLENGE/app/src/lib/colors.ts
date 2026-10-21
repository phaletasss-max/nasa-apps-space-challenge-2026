import type { LayerId, Overview } from "./types";

export type RGB = [number, number, number];

export const FIRE: RGB[] = [
  [59, 15, 31], [138, 28, 43], [212, 68, 28], [255, 138, 31], [255, 209, 102], [255, 243, 196],
];
export const DIVERGING: RGB[] = [
  [43, 108, 176], [120, 170, 220], [70, 74, 84], [255, 150, 90], [230, 57, 70],
];
// Cyclic, roughly perceptual: winter blues -> spring greens -> summer yellows/oranges -> autumn reds/purples
export const MONTHS: RGB[] = [
  [76, 120, 255], [64, 170, 230], [60, 200, 170], [90, 205, 100], [170, 215, 70], [240, 210, 60],
  [255, 165, 50], [255, 110, 50], [235, 70, 80], [200, 70, 150], [150, 80, 210], [100, 90, 240],
];
export const WEEK: { max: number; color: RGB }[] = [
  { max: 0.67, color: [90, 150, 230] },
  { max: 1.5, color: [235, 220, 150] },
  { max: 3, color: [255, 140, 40] },
  { max: Infinity, color: [255, 50, 60] },
];
export const NEW_FIRE: RGB = [230, 80, 230];
/** NRT detections: oldest day -> newest day. */
export const RECENCY: RGB[] = [[150, 30, 40], [230, 70, 40], [255, 150, 40], [255, 230, 140]];

export function ramp(stops: RGB[], t: number): RGB {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = stops[i], b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export const css = (c: RGB, a = 1) => `rgba(${c.map(Math.round).join(",")},${a})`;
export const gradientCss = (stops: RGB[]) => `linear-gradient(90deg, ${stops.map((c) => css(c)).join(", ")})`;

export const activityT = (v: number) => Math.log10(1 + v) / Math.log10(301);

/**
 * Fill colour (RGBA, alpha 0–255) of overview cell i for a map layer, or null when the
 * cell is not drawn on that layer. `dim` fades cells outside the selected area.
 */
export function cellRGBA(layer: LayerId, ov: Overview, i: number, dim = false): [number, number, number, number] | null {
  let c: RGB;
  let a: number;
  const mean = ov.mean[i];
  if (layer === "activity") {
    if (mean < 0.15) return null;
    c = ramp(FIRE, activityT(mean));
    a = 0.35 + 0.65 * Math.min(1, activityT(mean) * 1.6);
  } else if (layer === "peak") {
    if (mean < 0.5 || ov.peak[i] > 11) return null;
    c = MONTHS[ov.peak[i]];
    a = Math.min(1, 0.25 + (ov.conc[i] / 100) * 0.9) * Math.min(1, 0.4 + activityT(mean));
  } else if (layer === "trend") {
    if (mean < 2) return null;
    const t = Math.max(-60, Math.min(60, ov.trend[i]));
    c = ramp(DIVERGING, (t + 60) / 120);
    a = ov.sig[i] !== 0 ? 0.95 : 0.22;
  } else {
    const obs = ov.nrtObs[i], exp = ov.nrtExp[i];
    if (obs === 0) return null;
    c = exp < 0.05 ? NEW_FIRE : WEEK.find((w) => obs / exp < w.max)!.color;
    a = 0.9;
  }
  if (dim) a *= 0.35;
  return [c[0], c[1], c[2], Math.round(a * 255)];
}
