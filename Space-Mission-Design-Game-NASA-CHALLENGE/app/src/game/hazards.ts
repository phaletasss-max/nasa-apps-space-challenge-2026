/**
 * Route-hazard predictor: real asteroids (NASA/JPL SBDB elements) propagated with two-body Kepler
 * motion, closest approaches to a planned trajectory, and the Δv of a trajectory-correction manoeuvre.
 *
 * Reality check shown to the player: interplanetary space is extremely empty; real missions do not
 * dodge asteroids, they plan close flybys on purpose (Galileo–Gaspra, NEAR–Mathilde, Lucy–Dinkinesh).
 * The game's "keep-out radius" is a deliberately conservative operational parameter.
 */
import catalogue from "../data/asteroids.json";
import { AU, SUN } from "../physics/constants";
import { solveKepler, type Vec3 } from "../physics/orbits";

export interface Asteroid {
  name: string;
  a: number; e: number; i: number; node: number; peri: number; M0: number; epochMs: number; // a in AU, angles rad
  H: number; diameterKm: number | null; neo: boolean; pha: boolean; cls: string;
}

const RAD = Math.PI / 180;
const jdToMs = (jd: number) => (jd - 2440587.5) * 86400000;

export const ASTEROIDS: Asteroid[] = (catalogue.data as (string | number | null)[][]).map((r) => ({
  name: String(r[0]), a: Number(r[1]), e: Number(r[2]), i: Number(r[3]) * RAD, node: Number(r[4]) * RAD, peri: Number(r[5]) * RAD,
  M0: Number(r[6]) * RAD, epochMs: jdToMs(Number(r[7])), H: Number(r[8]),
  diameterKm: r[9] === null ? null : Number(r[9]), neo: r[10] === 1, pha: r[11] === 1, cls: String(r[12]),
})).filter((a) => a.a > 0 && a.e < 1); // drop the odd hyperbolic interloper

/** Diameter estimate from absolute magnitude H when unknown (albedo 0.14). */
export const diameterFromH = (H: number, albedo = 0.14) => (1329 / Math.sqrt(albedo)) * 10 ** (-H / 5);
export const sizeKm = (a: Asteroid) => a.diameterKm ?? diameterFromH(a.H);

/** Heliocentric ecliptic J2000 position (m). */
export function asteroidPosition(a: Asteroid, dateMs: number): Vec3 {
  const aM = a.a * AU;
  const n = Math.sqrt(SUN.gm / aM ** 3);
  let M = a.M0 + n * ((dateMs - a.epochMs) / 1000);
  M = ((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const E = solveKepler(M > Math.PI ? M - 2 * Math.PI : M, a.e);
  const xp = aM * (Math.cos(E) - a.e), yp = aM * Math.sqrt(1 - a.e * a.e) * Math.sin(E);
  const cw = Math.cos(a.peri), sw = Math.sin(a.peri), cO = Math.cos(a.node), sO = Math.sin(a.node), cI = Math.cos(a.i), sI = Math.sin(a.i);
  return [
    (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    sw * sI * xp + cw * sI * yp,
  ];
}

export interface Encounter {
  asteroid: Asteroid;
  missKm: number;
  dateMs: number;
  relSpeedKms: number;
  leadDays: number; // time between "now" and the encounter
  level: "alert" | "watch" | "flyby";
  avoidDvMs: number; // Δv to push the miss distance out to the keep-out radius, if done now
  flybyDvMs: number; // Δv to bend the path to a 5 000 km science flyby, if done now
  collisionProb: number; // illustrative: Gaussian position uncertainty
}

/**
 * Closest approaches between a trajectory and the catalogue.
 * traj(ms) returns the spacecraft heliocentric position (m) for t in [t0, t1].
 */
export function predictEncounters(traj: (ms: number) => Vec3, t0: number, t1: number, nowMs: number,
  opts: { keepOutKm?: number; watchKm?: number; steps?: number } = {}): Encounter[] {
  const keepOut = (opts.keepOutKm ?? 2e6) * 1000, watch = (opts.watchKm ?? 8e6) * 1000, steps = opts.steps ?? 400;
  const times = Array.from({ length: steps + 1 }, (_, k) => t0 + ((t1 - t0) * k) / steps);
  const path = times.map(traj);
  const rMin = Math.min(...path.map((p) => Math.hypot(...p))), rMax = Math.max(...path.map((p) => Math.hypot(...p)));
  const out: Encounter[] = [];
  for (const a of ASTEROIDS) {
    const q = a.a * (1 - a.e) * AU, Q = a.a * (1 + a.e) * AU;
    if (Q < rMin - watch || q > rMax + watch) continue; // orbit never reaches the route's radial span
    let best = Infinity, bk = 0;
    for (let k = 0; k <= steps; k++) {
      const p = asteroidPosition(a, times[k]), s = path[k];
      const d = Math.hypot(p[0] - s[0], p[1] - s[1], p[2] - s[2]);
      if (d < best) { best = d; bk = k; }
    }
    if (best > watch) continue;
    // refine around the coarse minimum (golden-section on time)
    let lo = times[Math.max(0, bk - 1)], hi = times[Math.min(steps, bk + 1)];
    const dist = (t: number) => { const p = asteroidPosition(a, t), s = traj(t); return Math.hypot(p[0] - s[0], p[1] - s[1], p[2] - s[2]); };
    for (let it = 0; it < 40; it++) {
      const m1 = lo + (hi - lo) * 0.382, m2 = lo + (hi - lo) * 0.618;
      if (dist(m1) < dist(m2)) hi = m2; else lo = m1;
    }
    const tc = (lo + hi) / 2, miss = dist(tc);
    const dt = 3600 * 1000;
    const pa = asteroidPosition(a, tc + dt), pa0 = asteroidPosition(a, tc), sa = traj(Math.min(t1, tc + dt)), sa0 = traj(tc);
    const rel = Math.hypot(pa[0] - pa0[0] - (sa[0] - sa0[0]), pa[1] - pa0[1] - (sa[1] - sa0[1]), pa[2] - pa0[2] - (sa[2] - sa0[2])) / 3600;
    const lead = Math.max(1, (tc - nowMs) / 1000);
    const sigma = (a.neo ? 2000 : 500) * 1000; // m, ephemeris uncertainty scale
    const R = (sizeKm(a) / 2) * 1000;
    out.push({
      asteroid: a, missKm: miss / 1000, dateMs: tc, relSpeedKms: rel / 1000, leadDays: lead / 86400,
      level: miss < keepOut ? "alert" : miss < watch / 2 ? "flyby" : "watch",
      avoidDvMs: miss < keepOut ? avoidDv(keepOut - miss, lead) : 0,
      flybyDvMs: avoidDv(Math.max(0, miss - 5e6), lead),
      collisionProb: Math.min(1, (R * R) / (2 * sigma * sigma) * Math.exp(-(miss * miss) / (2 * sigma * sigma))),
    });
  }
  return out.sort((x, y) => x.missKm - y.missKm);
}

/** Δv (m/s) to displace the arrival point by `dMeters` with `leadSeconds` of drift: Δv ≈ d / t. */
export const avoidDv = (dMeters: number, leadSeconds: number) => dMeters / leadSeconds;
