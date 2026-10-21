/**
 * Launch-vehicle performance: masses, stage-by-stage Δv (Tsiolkovsky), thrust-to-weight, cost and
 * reliability. Boosters burn in parallel with the first stage and are modelled as a "stage 0".
 */
import { G0 } from "../physics/constants";
import { boosterById, DENSITY, engineById, payloadById, TANK_COST_PER_T, TANK_FRACTION, UPPER_STAGE_FACTOR, type Vehicle } from "./catalog";

export interface StagePerf {
  label: string;
  wet: number; dry: number; prop: number; // kg
  thrustSL: number; thrustVac: number; // kN
  isp: number; // effective vacuum Isp for Δv
  dv: number; // m/s
  twr: number; // thrust-to-weight at ignition (SL for first stage, vac for upper)
  burnS: number;
  diameter: number; height: number; // m, for the 3D view
}

export interface Performance {
  stages: StagePerf[];
  liftoffMass: number; payloadMass: number;
  dvLaunch: number; // total vehicle Δv (excluding payload's own propulsion)
  dvPayload: number;
  liftoffTwr: number;
  cost: number; reliability: number;
  height: number;
}

/** Δv needed to reach low Earth orbit including gravity and drag losses (typical ~9.3–9.5 km/s). */
export const DV_TO_LEO = 9400;

export function performance(v: Vehicle): Performance {
  const pay = payloadById(v.payload);
  const stages: StagePerf[] = [];
  let above = pay.mass; // mass sitting on top of the stage being evaluated
  let cost = pay.cost, rel = pay.reliability, height = 6;

  // upper stages first (top → bottom), then reverse
  const specs = [...v.stages].map((s, i) => ({ s, i })).reverse();
  for (const { s, i } of specs) {
    const e = engineById(s.engine);
    const prop = s.propT * 1000;
    const dry = e.mass * s.count + prop * TANK_FRACTION[e.propellant] * (i === 0 ? 1 : UPPER_STAGE_FACTOR) + 400;
    const wet = dry + prop;
    const m0 = wet + above, mf = dry + above;
    const first = i === 0;
    const isp = first && !v.boosters ? (e.ispSL + e.ispVac) / 2 + 10 : e.ispVac; // first stage flies partly in air
    const thrustSL = e.thrustSL * s.count, thrustVac = e.thrustVac * s.count;
    const dv = isp * G0 * Math.log(m0 / mf);
    const volume = prop / DENSITY[e.propellant];
    const diameter = Math.min(9, Math.max(1.8, Math.cbrt(volume / 6) * 1.25));
    const h = volume / (Math.PI * (diameter / 2) ** 2) * 1.15 + 2.5;
    stages.unshift({
      label: `Etapa ${i + 1}`, wet, dry, prop, thrustSL, thrustVac, isp, dv,
      twr: ((first ? thrustSL : thrustVac) * 1000) / (m0 * G0),
      burnS: (prop * isp * G0) / ((first ? thrustSL || thrustVac : thrustVac) * 1000), diameter, height: h,
    });
    above = m0;
    cost += e.cost * s.count + s.propT * TANK_COST_PER_T * 10 + 15;
    rel *= e.reliability ** s.count * 0.995;
    height += h;
  }

  if (v.boosters && v.boosters.count > 0) {
    const b = boosterById(v.boosters.id), n = v.boosters.count;
    const core = stages[0];
    const coreEngine = engineById(v.stages[0].engine);
    // Phase 0: boosters + core burn together until the boosters are spent.
    const ispB = (b.ispSL + b.ispVac) / 2, ispC = (coreEngine.ispSL + coreEngine.ispVac) / 2;
    const tBurn = (b.prop * ispB * G0) / (b.thrustVac * 1000);
    const coreFlow = ((coreEngine.thrustSL + coreEngine.thrustVac) / 2) * v.stages[0].count * 1000 / (ispC * G0);
    const coreUsed = Math.min(core.prop * 0.9, coreFlow * tBurn);
    const m0 = above + (b.prop + b.dry) * n;
    const mf = m0 - b.prop * n - coreUsed;
    const isp = (b.prop * n * ispB + coreUsed * ispC) / (b.prop * n + coreUsed);
    const thrustSL = b.thrustSL * n + core.thrustSL, thrustVac = b.thrustVac * n + core.thrustVac;
    stages.unshift({ label: "Boosters", wet: (b.prop + b.dry) * n, dry: b.dry * n, prop: b.prop * n, thrustSL, thrustVac, isp,
      dv: isp * G0 * Math.log(m0 / mf), twr: (thrustSL * 1000) / (m0 * G0), burnS: tBurn, diameter: 3.7, height: 0 });
    // Phase 1: boosters jettisoned, the core continues alone (now high up: near-vacuum Isp).
    const c0 = mf - b.dry * n, c1 = c0 - (core.prop - coreUsed);
    core.isp = coreEngine.ispVac - 8;
    core.dv = core.isp * G0 * Math.log(c0 / c1);
    above = m0;
    cost += b.cost * n;
    rel *= b.reliability ** n;
  }

  const dvLaunch = stages.reduce((s, x) => s + x.dv, 0);
  return {
    stages, liftoffMass: above, payloadMass: pay.mass, dvLaunch, dvPayload: pay.ownDv,
    liftoffTwr: stages[0].twr, cost, reliability: rel, height,
  };
}

export interface MissionNeeds { dvDeparture: number; dvArrival: number; crew: number; label: string }

export interface Readiness {
  dvNeededLaunch: number; dvMarginLaunch: number;
  dvMarginPayload: number;
  twrOk: boolean; crewOk: boolean;
  ok: boolean;
  issues: string[];
}

/** Can this vehicle fly this mission? (upper stages do LEO + departure; the payload does arrival). */
export function readiness(p: Performance, v: Vehicle, need: MissionNeeds): Readiness {
  const pay = payloadById(v.payload);
  const dvNeededLaunch = DV_TO_LEO + need.dvDeparture;
  const dvMarginLaunch = p.dvLaunch - dvNeededLaunch;
  const dvMarginPayload = pay.ownDv - need.dvArrival;
  const twrOk = p.liftoffTwr >= 1.15;
  const crewOk = pay.crew >= need.crew;
  const issues: string[] = [];
  if (!twrOk) issues.push(`Empuje/peso al despegue ${p.liftoffTwr.toFixed(2)}: debe ser al menos 1.15 o el cohete no se eleva con margen.`);
  if (dvMarginLaunch < 0) issues.push(`Faltan ${Math.round(-dvMarginLaunch)} m/s de Δv para llegar a órbita y salir hacia ${need.label}.`);
  if (dvMarginPayload < 0) issues.push(`La carga útil necesita ${Math.round(need.dvArrival)} m/s para la llegada y solo tiene ${pay.ownDv}.`);
  if (!crewOk) issues.push(`La misión requiere ${need.crew} astronautas y esta carga útil lleva ${pay.crew}.`);
  for (const s of p.stages) if (s.label !== "Boosters" && s.label !== "Etapa 1" && s.twr < 0.15) issues.push(`${s.label}: empuje/peso ${s.twr.toFixed(2)} muy bajo (pérdidas por gravedad).`);
  return { dvNeededLaunch, dvMarginLaunch, dvMarginPayload, twrOk, crewOk, ok: issues.length === 0, issues };
}
