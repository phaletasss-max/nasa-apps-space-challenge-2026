import { AU, DAY, ELEMENTS, G0, PLANETS, SOLAR_CONSTANT, SUN } from "./constants";

export type Vec3 = [number, number, number];

const RAD = Math.PI / 180;
export const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

export const julianCenturies = (dateMs: number) => (dateMs - J2000_MS) / (36525 * DAY * 1000);

/** Solve Kepler's equation M = E − e·sin E (Newton iteration). Angles in radians. */
export function solveKepler(M: number, e: number): number {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 30; i++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

/** Heliocentric ecliptic J2000 position (m) of a planet at a date (JPL approximate elements). */
export function planetPosition(id: string, dateMs: number): Vec3 {
  const T = julianCenturies(dateMs);
  const { el, rate } = ELEMENTS[id];
  const [a, e, I, L, w, O] = el.map((v, k) => v + rate[k] * T);
  const omega = (w - O) * RAD; // argument of perihelion
  let M = (L - w) * RAD;
  M = ((M + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  const E = solveKepler(M, e);
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(omega), sw = Math.sin(omega), cO = Math.cos(O * RAD), sO = Math.sin(O * RAD);
  const cI = Math.cos(I * RAD), sI = Math.sin(I * RAD);
  const x = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
  const y = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
  const z = sw * sI * xp + cw * sI * yp;
  return [x * AU, y * AU, z * AU];
}

export const semiMajorAxis = (id: string) => ELEMENTS[id].el[0] * AU;

export const norm = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);
export const angleXY = (v: Vec3) => Math.atan2(v[1], v[0]);

// ------------------------------------------------------------------ Hohmann transfers (coplanar, circular)
export interface Hohmann {
  dv1: number; // heliocentric departure Δv = v∞ at departure (m/s)
  dv2: number; // heliocentric arrival Δv = v∞ at arrival (m/s)
  tof: number; // time of flight (s)
  phase: number; // required target lead angle at departure (rad)
  aT: number; // transfer semi-major axis (m)
}

export function hohmann(r1: number, r2: number, mu = SUN.gm): Hohmann {
  const aT = (r1 + r2) / 2;
  const v1 = Math.sqrt(mu / r1), v2 = Math.sqrt(mu / r2);
  const vp = Math.sqrt(mu * (2 / r1 - 1 / aT)), va = Math.sqrt(mu * (2 / r2 - 1 / aT));
  const tof = Math.PI * Math.sqrt(aT ** 3 / mu);
  const n2 = Math.sqrt(mu / r2 ** 3);
  return { dv1: Math.abs(vp - v1), dv2: Math.abs(v2 - va), tof, phase: Math.PI - n2 * tof, aT };
}

/** Δv to go from a circular parking orbit (radius rp) to a hyperbolic excess speed vInf. */
export const dvFromParking = (vInf: number, gm: number, rp: number) =>
  Math.sqrt(vInf * vInf + (2 * gm) / rp) - Math.sqrt(gm / rp);

/** Δv to capture from vInf into a circular orbit of radius rp (Oberth). */
export const dvCapture = dvFromParking;

/** Current phase angle target−origin (rad, in (−π, π]). */
export function phaseAngle(origin: string, target: string, dateMs: number): number {
  const d = angleXY(planetPosition(target, dateMs)) - angleXY(planetPosition(origin, dateMs));
  return Math.atan2(Math.sin(d), Math.cos(d));
}

/** First date ≥ start when the phase angle matches the Hohmann requirement (daily scan + bisection). */
export function nextWindow(origin: string, target: string, startMs: number, maxDays = 1600): number | null {
  const need = hohmann(semiMajorAxis(origin), semiMajorAxis(target)).phase;
  const f = (t: number) => {
    const d = phaseAngle(origin, target, t) - need;
    return Math.atan2(Math.sin(d), Math.cos(d));
  };
  let prev = f(startMs);
  for (let day = 1; day <= maxDays; day++) {
    const t = startMs + day * DAY * 1000;
    const cur = f(t);
    if (Math.sign(cur) !== Math.sign(prev) && Math.abs(cur - prev) < Math.PI) {
      let lo = t - DAY * 1000, hi = t;
      for (let k = 0; k < 30; k++) {
        const mid = (lo + hi) / 2;
        if (Math.sign(f(mid)) === Math.sign(f(lo))) lo = mid; else hi = mid;
      }
      return (lo + hi) / 2;
    }
    prev = cur;
  }
  return null;
}

/** Point on the Hohmann transfer ellipse, fraction s∈[0,1] of the flight, departing at angle θ0 (rad). */
export function transferPoint(h: Hohmann, r1: number, r2: number, theta0: number, s: number): Vec3 {
  const outward = r2 > r1;
  const e = Math.abs(r2 - r1) / (r1 + r2);
  // mean anomaly from periapsis (outward) or apoapsis (inward)
  const M = Math.PI * s + (outward ? 0 : Math.PI);
  const E = solveKepler(M, e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = h.aT * (1 - e * Math.cos(E));
  const ang = theta0 + (outward ? nu : nu - Math.PI);
  return [r * Math.cos(ang), r * Math.sin(ang), 0];
}

// ------------------------------------------------------------------ rocket & spacecraft budgets
/** Tsiolkovsky: Δv = Isp·g0·ln(m0/mf). */
export const rocketDv = (isp: number, m0: number, mf: number) => isp * G0 * Math.log(m0 / mf);

/** Propellant needed for Δv with a given dry (final) mass. */
export const propellantFor = (dv: number, isp: number, mDry: number) => mDry * (Math.exp(dv / (isp * G0)) - 1);

/** Solar array power at heliocentric distance d (m): P = S0·(1 AU/d)²·area·efficiency. */
export const solarPower = (d: number, area: number, eff: number) => SOLAR_CONSTANT * (AU / d) ** 2 * area * eff;

/** Data rate scales with 1/d² for the same antenna and transmitter (normalized at reference distance). */
export const dataRate = (rateAtRef: number, dRef: number, d: number) => rateAtRef * (dRef / d) ** 2;

// ------------------------------------------------------------------ orbit sandbox (two-body, RK4)
export interface State { r: Vec3; v: Vec3 }

function accel(r: Vec3, gm: number): Vec3 {
  const d = norm(r), k = -gm / (d * d * d);
  return [k * r[0], k * r[1], k * r[2]];
}

/** One RK4 step of r'' = −μ r/|r|³. */
export function rk4(s: State, dt: number, gm: number): State {
  const add = (a: Vec3, b: Vec3, h: number): Vec3 => [a[0] + b[0] * h, a[1] + b[1] * h, a[2] + b[2] * h];
  const k1v = accel(s.r, gm), k1r = s.v;
  const k2v = accel(add(s.r, k1r, dt / 2), gm), k2r = add(s.v, k1v, dt / 2);
  const k3v = accel(add(s.r, k2r, dt / 2), gm), k3r = add(s.v, k2v, dt / 2);
  const k4v = accel(add(s.r, k3r, dt), gm), k4r = add(s.v, k3v, dt);
  const comb = (a: Vec3, b: Vec3, c: Vec3, d: Vec3): Vec3 =>
    [0, 1, 2].map((i) => (a[i] + 2 * b[i] + 2 * c[i] + d[i]) / 6) as Vec3;
  return { r: add(s.r, comb(k1r, k2r, k3r, k4r), dt), v: add(s.v, comb(k1v, k2v, k3v, k4v), dt) };
}

export interface Elements { a: number; e: number; rp: number; ra: number; period: number; energy: number }

/** Osculating elements from a state vector. */
export function elementsOf(s: State, gm: number): Elements {
  const r = norm(s.r), v = norm(s.v);
  const energy = (v * v) / 2 - gm / r;
  const a = -gm / (2 * energy);
  const h: Vec3 = [s.r[1] * s.v[2] - s.r[2] * s.v[1], s.r[2] * s.v[0] - s.r[0] * s.v[2], s.r[0] * s.v[1] - s.r[1] * s.v[0]];
  const hm = norm(h);
  const e = Math.sqrt(Math.max(0, 1 + (2 * energy * hm * hm) / (gm * gm)));
  const rp = a * (1 - e);
  const ra = e < 1 ? a * (1 + e) : Infinity;
  const period = e < 1 ? 2 * Math.PI * Math.sqrt(a ** 3 / gm) : Infinity;
  return { a, e, rp, ra, period, energy };
}

/** Apply an impulsive burn along prograde (+) / radial-out (+) directions (m/s). */
export function burn(s: State, prograde: number, radial: number): State {
  const v = norm(s.v), r = norm(s.r);
  const t: Vec3 = [s.v[0] / v, s.v[1] / v, s.v[2] / v];
  const n: Vec3 = [s.r[0] / r, s.r[1] / r, s.r[2] / r];
  return { r: s.r, v: [0, 1, 2].map((i) => s.v[i] + t[i] * prograde + n[i] * radial) as Vec3 };
}

export const circularState = (gm: number, radius: number): State => ({ r: [radius, 0, 0], v: [0, Math.sqrt(gm / radius), 0] });

export { PLANETS };
