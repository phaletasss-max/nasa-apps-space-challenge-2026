/**
 * Cruise trajectory for the campaign: Hohmann transfer between the real (elliptical) planet positions,
 * with the departure day chosen (±45 d around the phase-angle window) to minimise the arrival miss,
 * then blended smoothly onto the target's real position (what trajectory-correction manoeuvres do).
 * Lunar transfers are drawn as a 4–5 day arc from the Earth to the Moon.
 */
import { AU, DAY } from "../physics/constants";
import { angleXY, hohmann, nextWindow, planetPosition, semiMajorAxis, transferPoint, type Vec3 } from "../physics/orbits";
import { moonGeocentric } from "../data/worlds";
import type { Target } from "./contracts";

export interface Transfer { target: Target; window: number; arrival: number; tofDays: number; theta0: number; offset: Vec3; missKm: number }

export function moonHelio(ms: number): Vec3 {
  const e = planetPosition("earth", ms), m = moonGeocentric(ms);
  const d = m.km * 1000;
  return [e[0] + d * Math.cos(m.latRad) * Math.cos(m.lonRad), e[1] + d * Math.cos(m.latRad) * Math.sin(m.lonRad), e[2] + d * Math.sin(m.latRad)];
}

/** Best departure on or after `from` (interplanetary) or exactly `from` (Moon). */
export function planTransfer(target: Target, from: number, lunarDays = 4.5): Transfer | null {
  if (target === "moon") return { target, window: from, arrival: from + lunarDays * DAY * 1000, tofDays: lunarDays, theta0: 0, offset: [0, 0, 0], missKm: 0 };
  const nominal = nextWindow("earth", target, from);
  if (nominal === null) return null;
  const r1 = semiMajorAxis("earth"), r2 = semiMajorAxis(target);
  const h = hohmann(r1, r2);
  const missAt = (dep: number) => {
    const theta0 = angleXY(planetPosition("earth", dep));
    const end = transferPoint(h, r1, r2, theta0, 1);
    const actual = planetPosition(target, dep + h.tof * 1000);
    const offset: Vec3 = [actual[0] - end[0], actual[1] - end[1], actual[2] - end[2]];
    return { theta0, offset, miss: Math.hypot(...offset) };
  };
  let window = nominal, best = missAt(nominal);
  for (let k = -45; k <= 45; k++) {
    const dep = nominal + k * DAY * 1000;
    if (dep < from) continue;
    const m = missAt(dep);
    if (m.miss < best.miss) { best = m; window = dep; }
  }
  return { target, window, arrival: window + h.tof * 1000, tofDays: h.tof / DAY, theta0: best.theta0, offset: best.offset, missKm: best.miss / 1000 };
}

/** Heliocentric position (m) of the spacecraft at time ms. */
export function transferPosition(t: Transfer, ms: number): Vec3 {
  const s = Math.max(0, Math.min(1, (ms - t.window) / (t.arrival - t.window)));
  if (t.target === "moon") {
    const e = planetPosition("earth", ms), m = moonHelio(t.arrival);
    const me = planetPosition("earth", t.arrival);
    const w = s * s * (3 - 2 * s);
    // geocentric arc toward where the Moon will be at arrival, carried along with the Earth
    const g: Vec3 = [(m[0] - me[0]) * w, (m[1] - me[1]) * w, (m[2] - me[2]) * w];
    const bulge = Math.sin(Math.PI * s) * 0.18 * Math.hypot(...g);
    const n = Math.hypot(g[0], g[1]) || 1;
    return [e[0] + g[0] - (g[1] / n) * bulge, e[1] + g[1] + (g[0] / n) * bulge, e[2] + g[2]];
  }
  const r1 = semiMajorAxis("earth"), r2 = semiMajorAxis(t.target);
  const h = hohmann(r1, r2);
  const base = transferPoint(h, r1, r2, t.theta0, s);
  const b0 = transferPoint(h, r1, r2, t.theta0, 0);
  const start = planetPosition("earth", t.window);
  const w = s * s * (3 - 2 * s);
  return [0, 1, 2].map((i) => base[i] + (start[i] - b0[i]) * (1 - w) + t.offset[i] * w) as Vec3;
}

export const distanceAU = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / AU;
