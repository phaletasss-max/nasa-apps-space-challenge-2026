/**
 * Entry, descent & landing (EDL) in 2D: downrange x, altitude h, velocities vx (horizontal) and vz (vertical, + up).
 * Simplified point-mass physics with an exponential atmosphere ρ(h) = ρ0·exp(−h/H), drag via ballistic
 * coefficient β = m/(Cd·A), constant L/D during guided entry, and thrust with mass flow ṁ = T/(Isp·g0).
 * Mission numbers are rounded from public descriptions of MSL/Perseverance, Apollo's LM and the Venera landers.
 */
import { G0 } from "./constants";

export type LandingBody = "mars" | "moon" | "venus";
export type Phase = "entry" | "parachute" | "freefall" | "powered" | "skycrane" | "descent" | "landed" | "crashed";

export interface LandingState {
  body: LandingBody;
  t: number; x: number; h: number; vx: number; vz: number;
  mass: number; fuel: number;
  phase: Phase;
  throttle: number; // 0..1 (actual)
  pitch: number; // rad, thrust tilt from vertical (+ = brakes +x motion)
  heat: number; peakHeat: number; // W/cm² (Sutton–Graves estimate)
  gload: number; peakG: number;
  events: { t: number; text: string }[];
  result: string;
}

export interface Control { auto: boolean; throttle: number; pitch: number }

interface Atmo { rho0: number; H: number }
const ATMO: Record<LandingBody, Atmo | null> = { mars: { rho0: 0.02, H: 11100 }, venus: { rho0: 65, H: 15900 }, moon: null };
const GRAV: Record<LandingBody, number> = { mars: 3.71, moon: 1.62, venus: 8.87 };

export const density = (b: LandingBody, h: number) => { const a = ATMO[b]; return a ? a.rho0 * Math.exp(-Math.max(0, h) / a.H) : 0; };
export const gravity = (b: LandingBody) => GRAV[b];

/** Vehicle parameters per phase. */
const MARS = { entryMass: 3300, betaEntry: 126, LD: 0.24, chuteCdA: 200, shieldMass: 385, poweredMass: 1910, thrustMax: 25000, isp: 220, fuel: 390 };
const MOON = { dry: 7000, fuel: 900, thrustMax: 45000, isp: 311 }; // ~370 m/s of Δv: tight, like Apollo
const VENUS = { entryMass: 1600, betaEntry: 160, chuteCdA: 40, landerMass: 760, plateCdA: 3.69 };

export function initLanding(body: LandingBody): LandingState {
  const base = { body, t: 0, x: 0, throttle: 0, pitch: 0, heat: 0, peakHeat: 0, gload: 0, peakG: 0, events: [] as { t: number; text: string }[], result: "" };
  if (body === "mars") {
    const v = 5400, g = (-15.5 * Math.PI) / 180;
    return { ...base, h: 125000, vx: v * Math.cos(g), vz: v * Math.sin(g), mass: MARS.entryMass, fuel: MARS.fuel, phase: "entry",
      events: [{ t: 0, text: "Interfaz de entrada: 125 km de altura a 5.4 km/s. Empiezan los 7 minutos de terror." }] };
  }
  if (body === "venus") {
    const v = 10500, g = (-20 * Math.PI) / 180;
    return { ...base, h: 130000, vx: v * Math.cos(g), vz: v * Math.sin(g), mass: VENUS.entryMass, fuel: 0, phase: "entry",
      events: [{ t: 0, text: "Entrada en la atmósfera de Venus a 10.5 km/s." }] };
  }
  return { ...base, h: 2500, vx: 80, vz: -40, mass: MOON.dry + MOON.fuel, fuel: MOON.fuel, phase: "descent",
    events: [{ t: 0, text: "Puerta alta (high gate): 2.5 km de altura. Combustible justo, como el Apollo 11." }] };
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Advance by dt seconds. Mutates and returns the state. */
export function stepLanding(s: LandingState, dt: number, ctrl: Control = { auto: true, throttle: 0, pitch: 0 }): LandingState {
  if (s.phase === "landed" || s.phase === "crashed") return s;
  const b = s.body, g = GRAV[b], rho = density(b, s.h);
  const v = Math.hypot(s.vx, s.vz) || 1e-9;
  const ev = (text: string) => s.events.push({ t: s.t, text });
  let ax = 0, az = -g;

  // ---------------- aerodynamics
  let cdaOverM = 0, LD = 0;
  if (b === "mars") {
    if (s.phase === "entry") { cdaOverM = 1 / MARS.betaEntry; LD = MARS.LD; }
    else if (s.phase === "parachute") cdaOverM = MARS.chuteCdA / s.mass;
    else cdaOverM = 1.2 / s.mass; // descent stage + rover, small drag
  } else if (b === "venus") {
    if (s.phase === "entry") cdaOverM = 1 / VENUS.betaEntry;
    else if (s.phase === "parachute") cdaOverM = VENUS.chuteCdA / s.mass;
    else cdaOverM = VENUS.plateCdA / s.mass;
  }
  if (cdaOverM > 0) {
    const d = 0.5 * rho * v * v * cdaOverM; // drag acceleration
    ax += (-d * s.vx) / v; az += (-d * s.vz) / v;
    if (LD) { const l = d * LD; ax += (l * -s.vz) / v; az += (l * s.vx) / v; } // lift ⟂ velocity, upward
    s.gload = Math.hypot(d, d * LD) / G0;
    s.peakG = Math.max(s.peakG, s.gload);
    s.heat = s.phase === "entry" ? (1.9027e-4 * Math.sqrt(rho / 1.0) * v ** 3) / 1e4 : 0;
    s.peakHeat = Math.max(s.peakHeat, s.heat);
  } else { s.heat = 0; s.gload = 0; }

  // ---------------- phase transitions & propulsion
  if (b === "mars") {
    if (s.phase === "entry" && v < 430 && s.h < 14000) {
      s.phase = "parachute"; ev(`Paracaídas supersónico desplegado a ${(s.h / 1000).toFixed(1)} km y ${Math.round(v)} m/s.`);
    } else if (s.phase === "parachute" && s.mass === MARS.entryMass && s.t > 0 && s.events.length && s.t - s.events[s.events.length - 1].t > 20) {
      s.mass -= MARS.shieldMass; ev("Separación del escudo térmico: el radar ya ve el suelo.");
    } else if (s.phase === "parachute" && s.h < 2100) {
      s.phase = "powered"; s.mass = MARS.poweredMass; s.fuel = MARS.fuel;
      ev(`Separación de la cubierta trasera a ${(s.h / 1000).toFixed(1)} km: ¡motores encendidos!`);
    } else if (s.phase === "powered" && s.h < 21) {
      s.phase = "skycrane"; ev("Grúa aérea: el rover baja colgado de cables a 0.75 m/s.");
    }
    if (s.phase === "powered" || s.phase === "skycrane") {
      const vzDes = s.phase === "skycrane" ? -0.75 : -clamp(s.h / 18, 0.75, 80);
      thrust(s, ax, az, vzDes, MARS.thrustMax, MARS.isp, dt, g, (tax, taz) => { ax = tax; az = taz; });
    }
  } else if (b === "venus") {
    if (s.phase === "entry" && v < 300 && s.h < 66000) { s.phase = "parachute"; s.mass = VENUS.landerMass; ev(`Se abre el paracaídas a ${(s.h / 1000).toFixed(0)} km, dentro de las nubes de ácido sulfúrico.`); }
    else if (s.phase === "parachute" && s.h < 48000) { s.phase = "freefall"; ev("Se suelta el paracaídas: el disco de frenado basta en el aire espeso."); }
  } else {
    if (ctrl.auto) {
      const vzDes = -clamp(s.h / 15, 1.2, 40);
      thrust(s, ax, az, vzDes, MOON.thrustMax, MOON.isp, dt, g, (tax, taz) => { ax = tax; az = taz; });
    } else {
      const T = s.fuel > 0 ? clamp(ctrl.throttle, 0, 1) * MOON.thrustMax : 0;
      s.throttle = T / MOON.thrustMax;
      s.pitch = clamp(ctrl.pitch, -0.8, 0.8);
      ax += (-T * Math.sin(s.pitch)) / s.mass; az += (T * Math.cos(s.pitch)) / s.mass;
      burnFuel(s, T, MOON.isp, dt);
    }
  }

  // ---------------- integrate (semi-implicit Euler)
  s.vx += ax * dt; s.vz += az * dt;
  s.x += s.vx * dt; s.h += s.vz * dt; s.t += dt;
  if (s.fuel <= 0 && (s.phase === "powered" || s.phase === "descent") && !s.events.some((e) => e.text.startsWith("Sin combustible"))) ev("Sin combustible de descenso.");

  if (s.h <= 0) {
    s.h = 0;
    const tilt = Math.abs((s.pitch * 180) / Math.PI);
    const okV = b === "venus" ? 12 : 3, ok = Math.abs(s.vz) < okV && Math.abs(s.vx) < 1.5 && tilt < 12;
    s.phase = ok ? "landed" : "crashed";
    s.result = ok
      ? `Contacto a ${Math.abs(s.vz).toFixed(2)} m/s tras ${fmtTime(s.t)}.${b === "moon" ? ` Combustible restante: ${Math.round(s.fuel)} kg.` : ""}`
      : `Impacto a ${Math.abs(s.vz).toFixed(1)} m/s vertical y ${Math.abs(s.vx).toFixed(1)} m/s lateral${tilt >= 12 ? `, inclinado ${tilt.toFixed(0)}°` : ""}.`;
    ev(s.result);
  }
  return s;
}

/** Guided thrust: track a vertical-speed target and null horizontal speed. */
function thrust(s: LandingState, ax0: number, az0: number, vzDes: number, Tmax: number, isp: number, dt: number, g: number,
  set: (ax: number, az: number) => void) {
  if (s.fuel <= 0) { s.throttle = 0; return; }
  // a rocket can only push: if we are descending slower than desired, let gravity do the work
  const azReq = Math.max(0, (vzDes - s.vz) * 0.9 + g - (az0 + g));
  const axReq = clamp(-s.vx * (s.h < 60 ? 1.2 : 0.3), -6, 6) - ax0;
  let T = s.mass * Math.hypot(axReq, azReq);
  s.pitch = clamp(Math.atan2(-axReq, Math.max(0.5, azReq)), -0.75, 0.75);
  T = clamp(T, 0, Tmax);
  s.throttle = T / Tmax;
  set(ax0 - (T * Math.sin(s.pitch)) / s.mass, az0 + (T * Math.cos(s.pitch)) / s.mass);
  burnFuel(s, T, isp, dt);
}

function burnFuel(s: LandingState, T: number, isp: number, dt: number) {
  const dm = Math.min(s.fuel, (T / (isp * G0)) * dt);
  s.fuel -= dm; s.mass -= dm;
}

export const fmtTime = (t: number) => (t >= 3600 ? `${Math.floor(t / 3600)} h ${Math.floor((t % 3600) / 60)} min` : `${Math.floor(t / 60)} min ${Math.round(t % 60)} s`);

/** Run to the end with the autopilot (tests & previews). */
export function simulate(body: LandingBody, dt = 0.05, maxT = 4 * 3600): LandingState {
  const s = initLanding(body);
  while (s.phase !== "landed" && s.phase !== "crashed" && s.t < maxT) stepLanding(s, dt);
  return s;
}
