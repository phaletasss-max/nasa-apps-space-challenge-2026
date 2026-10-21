/**
 * Launch ascent in 2D, Earth-centred inertial frame: central gravity, rotating atmosphere with
 * exponential density, sea-level→vacuum thrust, staging (boosters in parallel with the core),
 * gravity turn then closed-loop guidance to a 200 km orbit. Engine failures follow part reliability;
 * vehicles with ≥ 9 engines on a stage tolerate one engine out (Falcon 9-style).
 */
import { G0, PLANETS } from "../physics/constants";
import { boosterById, engineById, payloadById, TANK_FRACTION, UPPER_STAGE_FACTOR, type Vehicle } from "./catalog";

const RE = PLANETS.earth.radius, MU = PLANETS.earth.gm;
const OMEGA = 7.2921159e-5;
const LAT = (28.5 * Math.PI) / 180; // Cape Canaveral
const TARGET = 200e3;

interface Group { name: string; thrustSL: number; thrustVac: number; ispSL: number; ispVac: number; tank: string; engines: number; reliability: number }
interface Tank { prop: number; dry: number }

export interface AscentState {
  t: number; x: number; y: number; vx: number; vy: number;
  mass: number; payload: number;
  tanks: Record<string, Tank>;
  phase: "ascent" | "orbit" | "failed";
  stage: number; // index into the sequence
  sequence: { name: string; groups: Group[]; jettison: string[] }[];
  q: number; maxQ: number; maxQT: number; maxQLogged: boolean; fairing: boolean;
  enginesOut: number;
  throttle: number; pitchDeg: number;
  events: { t: number; text: string }[];
  result: string;
  dvLeft: number; // upper-stage Δv remaining after orbit insertion
}

export function initAscent(v: Vehicle): AscentState {
  const pay = payloadById(v.payload);
  const tanks: Record<string, Tank> = {};
  const seq: AscentState["sequence"] = [];
  v.stages.forEach((s, i) => {
    const e = engineById(s.engine);
    tanks[`s${i}`] = { prop: s.propT * 1000, dry: e.mass * s.count + s.propT * 1000 * TANK_FRACTION[e.propellant] * (i === 0 ? 1 : UPPER_STAGE_FACTOR) + 400 };
  });
  const core = (i: number): Group => {
    const s = v.stages[i], e = engineById(s.engine);
    return { name: `Etapa ${i + 1}`, thrustSL: e.thrustSL * s.count * 1000, thrustVac: e.thrustVac * s.count * 1000, ispSL: e.ispSL || e.ispVac * 0.7, ispVac: e.ispVac, tank: `s${i}`, engines: s.count, reliability: e.reliability };
  };
  if (v.boosters && v.boosters.count) {
    const b = boosterById(v.boosters.id), n = v.boosters.count;
    tanks.b = { prop: b.prop * n, dry: b.dry * n };
    seq.push({ name: "Boosters + etapa 1", groups: [{ name: "Boosters", thrustSL: b.thrustSL * n * 1000, thrustVac: b.thrustVac * n * 1000, ispSL: b.ispSL, ispVac: b.ispVac, tank: "b", engines: n, reliability: b.reliability }, core(0)], jettison: ["b"] });
    seq.push({ name: "Etapa 1", groups: [core(0)], jettison: ["s0"] });
  } else seq.push({ name: "Etapa 1", groups: [core(0)], jettison: ["s0"] });
  for (let i = 1; i < v.stages.length; i++) seq.push({ name: `Etapa ${i + 1}`, groups: [core(i)], jettison: [`s${i}`] });
  const fairing = pay.crew ? 0 : 1800;
  const mass = Object.values(tanks).reduce((s, t) => s + t.prop + t.dry, 0) + pay.mass + fairing;
  return {
    t: 0, x: 0, y: RE, vx: OMEGA * RE * Math.cos(LAT), vy: 0, mass, payload: pay.mass, tanks, phase: "ascent", stage: 0, sequence: seq,
    q: 0, maxQ: 0, maxQT: 0, maxQLogged: false, fairing: fairing > 0, enginesOut: 0, throttle: 1, pitchDeg: 90,
    events: [{ t: 0, text: "Despegue." }], result: "", dvLeft: 0,
  };
}

export const altitude = (s: AscentState) => Math.hypot(s.x, s.y) - RE;

export function orbitOf(s: AscentState) {
  const r = Math.hypot(s.x, s.y), v2 = s.vx * s.vx + s.vy * s.vy;
  const energy = v2 / 2 - MU / r, h = s.x * s.vy - s.y * s.vx;
  const a = -MU / (2 * energy), e = Math.sqrt(Math.max(0, 1 + (2 * energy * h * h) / (MU * MU)));
  return { periAlt: a * (1 - e) - RE, apoAlt: e < 1 ? a * (1 + e) - RE : Infinity, speed: Math.sqrt(v2) };
}

/** Advance dt seconds. `rand` decides engine failures at each ignition. */
export function stepAscent(s: AscentState, dt: number, rand: () => number = Math.random): AscentState {
  if (s.phase !== "ascent") return s;
  const ev = (text: string) => s.events.push({ t: s.t, text });
  const r = Math.hypot(s.x, s.y), h = r - RE;
  // start at (0, R) moving +x (eastward, clockwise in this frame): local east = (y, −x)/r
  const up = [s.x / r, s.y / r], east = [s.y / r, -s.x / r];
  const vUp = s.vx * up[0] + s.vy * up[1], vH = s.vx * east[0] + s.vy * east[1];
  // relative velocity to the rotating atmosphere
  const vAtmH = OMEGA * r * Math.cos(LAT);
  const relH = vH - vAtmH, rel = Math.hypot(vUp, relH);
  const rho = 1.225 * Math.exp(-Math.max(0, h) / 8500), p = Math.exp(-Math.max(0, h) / 8500);
  s.q = 0.5 * rho * rel * rel;
  if (s.q > s.maxQ) { s.maxQ = s.q; s.maxQT = s.t; }
  else if (!s.maxQLogged && s.maxQ > 5000 && s.q < s.maxQ * 0.97) { s.maxQLogged = true; ev(`Max-Q: ${(s.maxQ / 1000).toFixed(1)} kPa de presión dinámica.`); }
  if (s.fairing && h > 110e3) { s.fairing = false; s.mass -= 1800; ev("Separación del carenado."); }

  // ---- thrust from active groups
  const step = s.sequence[s.stage];
  let thrust = 0, flow = 0;
  for (const g of step.groups) {
    const tank = s.tanks[g.tank];
    if (tank.prop <= 0) continue;
    const frac = g.engines >= 9 && s.enginesOut > 0 && g.tank === "s0" ? (g.engines - 1) / g.engines : 1;
    const T = (g.thrustVac - (g.thrustVac - g.thrustSL) * p) * frac;
    const isp = g.ispVac - (g.ispVac - g.ispSL) * p;
    const md = T / (isp * G0);
    const burned = Math.min(tank.prop, md * dt);
    tank.prop -= burned; s.mass -= burned;
    thrust += T; flow += md;
  }
  void flow;

  // ---- guidance: vertical → pitch-over → gravity turn → closed loop above 50 km / on upper stages
  let elev: number;
  if (s.t < 8 || rel < 70) elev = Math.PI / 2;
  else if (s.stage === 0 && h < 45e3) {
    const turn = Math.atan2(vUp, Math.max(1, relH));
    elev = Math.min(turn, Math.PI / 2 - Math.min((s.t - 8) * 0.004, 0.09));
  } else {
    const g = MU / (r * r) - (vH * vH) / r;
    const vzDes = Math.max(-150, Math.min(400, (TARGET - h) / 90));
    const aT = Math.max(1e-3, thrust / s.mass);
    elev = Math.asin(Math.max(-0.3, Math.min(1, ((vzDes - vUp) / 20 + g) / aT)));
  }
  s.pitchDeg = (elev * 180) / Math.PI;
  const dir = [up[0] * Math.sin(elev) + east[0] * Math.cos(elev), up[1] * Math.sin(elev) + east[1] * Math.cos(elev)];

  // ---- forces
  const cda = 0.35 * Math.PI * 2.0 ** 2;
  const drag = rel > 0 ? (s.q * cda) / s.mass : 0;
  const dragVec = rel > 0 ? [(-(vUp * up[0] + relH * east[0]) / rel) * drag, (-(vUp * up[1] + relH * east[1]) / rel) * drag] : [0, 0];
  const gAcc = -MU / (r * r);
  const ax = (thrust / s.mass) * dir[0] + gAcc * up[0] + dragVec[0];
  const ay = (thrust / s.mass) * dir[1] + gAcc * up[1] + dragVec[1];
  s.vx += ax * dt; s.vy += ay * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.t += dt;
  s.throttle = thrust > 0 ? 1 : 0;

  // ---- orbit check (upper stage cut-off)
  const o = orbitOf(s);
  if (s.stage > 0 && o.periAlt > 160e3) {
    s.phase = "orbit";
    const tank = s.tanks[step.groups[0].tank];
    const g0 = step.groups[0];
    const dryAll = s.mass - tank.prop;
    s.dvLeft = g0.ispVac * G0 * Math.log(s.mass / dryAll);
    s.result = `Órbita alcanzada: ${(o.periAlt / 1000).toFixed(0)} × ${(o.apoAlt / 1000).toFixed(0)} km. Δv restante en la etapa superior: ${(s.dvLeft / 1000).toFixed(2)} km/s.`;
    ev(`Corte del motor (SECO). ${s.result}`);
    return s;
  }
  if (altitude(s) < -1) { s.phase = "failed"; s.result = "El vehículo no ganó altura y cayó."; ev(s.result); return s; }

  // ---- staging
  const spent = step.groups.every((g) => s.tanks[g.tank].prop <= 0) || (step.jettison.includes("b") && s.tanks.b.prop <= 0);
  if (spent) {
    for (const j of step.jettison) { s.mass -= s.tanks[j].dry + Math.max(0, s.tanks[j].prop); s.tanks[j].prop = 0; s.tanks[j].dry = 0; }
    ev(step.jettison.includes("b") ? "Separación de los boosters." : `Apagado y separación de la ${step.name.toLowerCase()}.`);
    s.stage++;
    if (s.stage >= s.sequence.length) {
      s.phase = o.periAlt > 120e3 ? "orbit" : "failed";
      s.result = s.phase === "orbit" ? `Órbita marginal ${(o.periAlt / 1000).toFixed(0)} × ${(o.apoAlt / 1000).toFixed(0)} km sin combustible restante.`
        : `Combustible agotado en trayectoria suborbital (perigeo ${(o.periAlt / 1000).toFixed(0)} km). Falta Δv.`;
      ev(s.result);
      return s;
    }
    const next = s.sequence[s.stage];
    const g = next.groups[0];
    if (rand() > g.reliability ** g.engines) {
      if (g.engines >= 9) { s.enginesOut++; ev("Falla de un motor: el resto compensa (capacidad de motor inoperativo)."); }
      else { s.phase = "failed"; s.result = `Anomalía en el encendido de la ${next.name.toLowerCase()}. Misión perdida.`; ev(s.result); return s; }
    }
    ev(`Encendido de la ${next.name.toLowerCase()}.`);
  }
  return s;
}

export function simulateAscent(v: Vehicle, rand: () => number = () => 0.5, dt = 0.2): AscentState {
  const s = initAscent(v);
  while (s.phase === "ascent" && s.t < 1500) stepAscent(s, dt, rand);
  if (s.phase === "ascent") { s.phase = "failed"; s.result = "La etapa superior no alcanzó la órbita a tiempo."; }
  return s;
}
