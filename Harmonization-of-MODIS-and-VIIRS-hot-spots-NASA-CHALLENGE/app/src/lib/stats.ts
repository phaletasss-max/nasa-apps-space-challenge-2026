import type { Series } from "./types";

export const Y0 = 2000;
export const CLIM = { from: 2001, to: 2025 };
export const YEARS = Array.from({ length: CLIM.to - CLIM.from + 1 }, (_, i) => CLIM.from + i);

export const mIdx = (y: number, moy: number) => (y - Y0) * 12 + moy;

/** Value of a series at absolute month index (0 when outside). */
export function at(arr: number[], s: Series, m: number): number {
  const i = m - s.first;
  return i >= 0 && i < arr.length ? arr[i] : 0;
}

/** Naive splice: raw MODIS before the switch month, raw VIIRS after. */
export function naive(s: Series, sw: number): number[] {
  return s.M.map((v, i) => (s.first + i < sw ? v : s.V[i]));
}

export function yearTotal(arr: number[], s: Series, y: number): number {
  let t = 0;
  for (let k = 0; k < 12; k++) t += at(arr, s, mIdx(y, k));
  return t;
}

export function quantile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

export interface MonthClim {
  mean: number;
  sd: number;
  p10: number;
  p50: number;
  p90: number;
}

export function climatology(arr: number[], s: Series): MonthClim[] {
  return Array.from({ length: 12 }, (_, moy) => {
    const v = YEARS.map((y) => at(arr, s, mIdx(y, moy))).sort((a, b) => a - b);
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1));
    return { mean, sd: sd || 1, p10: quantile(v, 0.1), p50: quantile(v, 0.5), p90: quantile(v, 0.9) };
  });
}

/** Fire season: shortest circular window of months holding >= share of the mean annual activity. */
export function fireSeason(clim: MonthClim[], share = 0.8) {
  const m = clim.map((c) => c.mean);
  const total = m.reduce((a, b) => a + b, 0) || 1;
  let peak = 0;
  m.forEach((v, i) => { if (v > m[peak]) peak = i; });
  for (let len = 1; len <= 12; len++) {
    let best = -1, bestStart = 0;
    for (let s = 0; s < 12; s++) {
      let v = 0;
      for (let k = 0; k < len; k++) v += m[(s + k) % 12];
      if (v > best) { best = v; bestStart = s; }
    }
    if (best / total >= share) return { start: bestStart, end: (bestStart + len - 1) % 12, months: len, share: best / total, peak };
  }
  return { start: 0, end: 11, months: 12, share: 1, peak };
}

/** Theil–Sen slope + Mann–Kendall two-sided p-value (no tie correction). */
export function senMk(v: number[]) {
  const n = v.length;
  const slopes: number[] = [];
  let S = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      slopes.push((v[j] - v[i]) / (j - i));
      S += Math.sign(v[j] - v[i]);
    }
  slopes.sort((a, b) => a - b);
  const slope = quantile(slopes, 0.5);
  const varS = (n * (n - 1) * (2 * n + 5)) / 18;
  const z = S > 0 ? (S - 1) / Math.sqrt(varS) : S < 0 ? (S + 1) / Math.sqrt(varS) : 0;
  const p = 2 * (1 - normCdf(Math.abs(z)));
  return { slope, p };
}

export function normCdf(z: number): number {
  // Abramowitz–Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Poisson upper tail P(X >= k | lambda). */
export function poissonUpper(k: number, lam: number): number {
  if (k <= 0) return 1;
  if (lam <= 0) return 0;
  if (lam > 50) return 1 - normCdf((k - 0.5 - lam) / Math.sqrt(lam));
  let term = Math.exp(-lam), cdf = 0;
  for (let x = 0; x < k; x++) { cdf += term; term *= lam / (x + 1); }
  return Math.max(0, 1 - cdf);
}

export interface CriticalMonth {
  y: number;
  moy: number;
  value: number;
  z: number;
  ratio: number;
}

/** Months whose harmonized activity is unusually high for that calendar month. */
export function criticalMonths(s: Series, clim: MonthClim[], minZ = 2, limit = 8): CriticalMonth[] {
  const out: CriticalMonth[] = [];
  for (const y of YEARS)
    for (let moy = 0; moy < 12; moy++) {
      const v = at(s.H, s, mIdx(y, moy));
      const c = clim[moy];
      if (c.mean < 0.5) continue;
      const z = (v - c.mean) / c.sd;
      if (z >= minZ) out.push({ y, moy, value: v, z, ratio: v / c.mean });
    }
  return out.sort((a, b) => b.z - a.z).slice(0, limit);
}

export function sensorJump(arr: number[], s: Series) {
  const avg = (y0: number, y1: number) => {
    let t = 0;
    for (let y = y0; y <= y1; y++) t += yearTotal(arr, s, y);
    return t / (y1 - y0 + 1);
  };
  const before = avg(2009, 2011);
  return before > 0 ? (avg(2012, 2014) / before - 1) * 100 : 0;
}
