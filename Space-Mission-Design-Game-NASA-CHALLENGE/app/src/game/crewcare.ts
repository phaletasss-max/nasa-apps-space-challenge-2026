/**
 * Crew condition during flight, one step per simulated day (the minute-by-minute habitat in interior.ts
 * is only run while the player watches it). Rates follow the same assumptions as interior.ts so both
 * views agree on average:
 *  - Deep-space radiation ≈ 1.8 mSv/day (MSL/RAD cruise measurement); lunar transit ≈ 1.0 mSv/day.
 *  - Exercise ~2.5 h/day keeps fitness roughly stable; illness or a broken gym erodes it.
 *  - Stress grows with isolation; calls home, leisure and a good commander bring it down.
 *  - A system fault ~ every 6 days per system; the best engineer repairs it.
 *  - An illness ~ every 12 crew-days; recovery speed depends on the best medical skill.
 */
import type { Astronaut } from "./crew";
import { SYSTEM_LABEL, type SystemId } from "./interior";

export interface CrewCondition { id: string; health: number; fitness: number; stress: number; doseMsv: number; ill: boolean }
export interface ShipState { crew: CrewCondition[]; systems: Record<SystemId, number>; days: number; science: number }
export interface ShipEvent { text: string; kind: "info" | "ok" | "warn" | "bad" }

export const CAREER_LIMIT_MSV = 600; // NASA-STD-3001 career effective dose limit
const SYSTEMS: SystemId[] = ["lifeSupport", "power", "water", "thermal", "comms"];
const clamp = (v: number) => Math.max(0, Math.min(100, v));

export function initShip(crew: Astronaut[]): ShipState {
  return {
    crew: crew.map((a) => ({ id: a.id, health: 100, fitness: 85, stress: 15, doseMsv: 0, ill: false })),
    systems: { lifeSupport: 100, power: 100, water: 100, thermal: 100, comms: 100 },
    days: 0, science: 0,
  };
}

const best = (crew: Astronaut[], k: keyof Astronaut["skills"]) => Math.max(0, ...crew.map((a) => a.skills[k]));

/** Advance one day. `deepSpace` = beyond the Earth–Moon system. Returns notable events. */
export function shipDay(s: ShipState, crew: Astronaut[], rand: () => number, deepSpace: boolean): ShipEvent[] {
  const ev: ShipEvent[] = [];
  const byId = new Map(crew.map((a) => [a.id, a]));
  const eng = best(crew, "engineering"), med = best(crew, "medicine"), lead = best(crew, "leadership");

  // systems: random faults, then repairs by the best engineer
  for (const k of SYSTEMS) {
    if (s.systems[k] >= 90 && rand() < 1 / 6) {
      s.systems[k] = 35 + rand() * 25;
      ev.push({ text: `Avería a bordo: ${SYSTEM_LABEL[k]} al ${Math.round(s.systems[k])} %.`, kind: "warn" });
    } else if (s.systems[k] < 100) {
      const before = s.systems[k];
      s.systems[k] = Math.min(100, s.systems[k] + 15 + eng * 7);
      if (before < 90 && s.systems[k] >= 100) ev.push({ text: `${SYSTEM_LABEL[k]} reparado.`, kind: "ok" });
    }
  }
  // illness
  if (crew.length && rand() < 1 / 12) {
    const c = s.crew[Math.floor(rand() * s.crew.length)];
    if (!c.ill) { c.ill = true; c.health = Math.min(c.health, 65); ev.push({ text: `${byId.get(c.id)?.name ?? "Un tripulante"} enfermó (infección leve).`, kind: "warn" }); }
  }

  const gymOk = s.systems.power > 50;
  const commsOk = s.systems.comms > 50;
  const lifeOk = s.systems.lifeSupport > 50;
  for (const c of s.crew) {
    const a = byId.get(c.id);
    const resilient = a?.trait === "Resistente al aislamiento";
    c.doseMsv += deepSpace ? 1.8 : 1.0;
    c.fitness = clamp(c.fitness + (gymOk && !c.ill ? -0.03 : -0.6));
    c.stress = clamp(c.stress + (resilient ? 0.15 : 0.3) - (commsOk ? 0.12 : 0) - lead * 0.015 + (lifeOk ? 0 : 1.5));
    if (c.ill) {
      c.health = clamp(c.health + 2 + med * 0.8);
      if (c.health >= 100) { c.ill = false; ev.push({ text: `${a?.name ?? "Tripulante"} recibió el alta médica.`, kind: "ok" }); }
    } else c.health = clamp(c.health + (lifeOk ? 0.5 : -1.2) - (c.stress > 80 ? 0.4 : 0));
  }
  // lab work: scientists produce more, stressed crews less
  s.science += crew.reduce((sum, a) => {
    const c = s.crew.find((x) => x.id === a.id)!;
    return sum + (c.ill ? 0 : (a.skills.science / 10) * (a.role === "scientist" ? 1.2 : 0.35) * (1 - c.stress / 200));
  }, 0);
  s.days++;
  return ev;
}

/** Fitness for a demanding phase (landing, EVA, re-entry): the worst crew member sets the limit. */
export function crewReady(s: ShipState): { ok: boolean; worst: CrewCondition | null; reason: string } {
  if (!s.crew.length) return { ok: true, worst: null, reason: "" };
  const worst = [...s.crew].sort((x, y) => x.health - y.health)[0];
  if (worst.health < 45) return { ok: false, worst, reason: "un tripulante no está en condiciones médicas" };
  if (s.crew.some((c) => c.doseMsv > CAREER_LIMIT_MSV)) return { ok: false, worst, reason: "se superó el límite de dosis de radiación" };
  return { ok: true, worst, reason: "" };
}
