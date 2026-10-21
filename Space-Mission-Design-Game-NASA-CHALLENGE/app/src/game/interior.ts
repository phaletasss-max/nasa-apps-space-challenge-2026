/**
 * Life on board: an agent simulation of the crew inside a two-deck transit habitat.
 * Schedule modelled on ISS practice (daily planning conference, ~2.5 h exercise, ~8.5 h sleep),
 * needs (energy, hunger, fitness, stress, health), walking between rooms and climbing ladders,
 * system faults repaired by the best engineer and illnesses treated by the medical officer.
 */
import type { Astronaut, Role } from "./crew";

export type Activity = "sleep" | "eat" | "exercise" | "work" | "conference" | "hygiene" | "leisure" | "comms" | "repair" | "treat" | "patient" | "walk";
export const ACTIVITY_LABEL: Record<Activity, string> = {
  sleep: "Durmiendo", eat: "Comiendo", exercise: "Ejercicio (cinta y resistencia)", work: "Trabajando", conference: "Conferencia diaria de planificación",
  hygiene: "Higiene personal", leisure: "Tiempo libre", comms: "Llamada con la Tierra", repair: "Reparando una avería", treat: "Atendiendo a un paciente",
  patient: "En la enfermería", walk: "Desplazándose",
};

export interface Room { id: string; name: string; deck: 0 | 1; x0: number; x1: number }
export const ROOMS: Room[] = [
  { id: "bridge", name: "Puente de mando", deck: 0, x0: 0, x1: 6 },
  { id: "comms", name: "Comunicaciones", deck: 0, x0: 6, x1: 10 },
  { id: "lab", name: "Laboratorio", deck: 0, x0: 10, x1: 18 },
  { id: "med", name: "Enfermería", deck: 0, x0: 18, x1: 22 },
  { id: "airlock", name: "Esclusa", deck: 0, x0: 22, x1: 28 },
  { id: "quarters", name: "Camarotes", deck: 1, x0: 0, x1: 8 },
  { id: "hygiene", name: "Higiene", deck: 1, x0: 8, x1: 11 },
  { id: "galley", name: "Cocina y comedor", deck: 1, x0: 11, x1: 18 },
  { id: "gym", name: "Gimnasio", deck: 1, x0: 18, x1: 23 },
  { id: "eclss", name: "Soporte vital", deck: 1, x0: 23, x1: 28 },
];
export const LADDERS = [10.5, 20.5];
export const room = (id: string) => ROOMS.find((r) => r.id === id)!;

export type SystemId = "lifeSupport" | "power" | "water" | "thermal" | "comms";
export const SYSTEM_LABEL: Record<SystemId, string> = { lifeSupport: "Soporte vital (CO₂/O₂)", power: "Energía", water: "Reciclaje de agua", thermal: "Control térmico", comms: "Comunicaciones" };
const SYSTEM_ROOM: Record<SystemId, string> = { lifeSupport: "eclss", power: "eclss", water: "eclss", thermal: "eclss", comms: "comms" };

export interface Needs { energy: number; hunger: number; fitness: number; stress: number; health: number }

export interface Agent {
  id: string; name: string; role: Role; skills: Astronaut["skills"];
  x: number; deck: 0 | 1; climbing: number; // >0 while on a ladder
  activity: Activity; roomId: string; targetX: number; targetDeck: 0 | 1; targetRoom: string;
  needs: Needs;
  task: { kind: "repair"; system: SystemId } | { kind: "treat"; patient: string } | { kind: "patient" } | null;
  ill: boolean;
  stats: { sleepMin: number; meals: number; exerciseMin: number; scienceMin: number };
  slot: number;
}

export interface Habitat {
  minute: number; // ship time since start (minutes, UTC-like clock starting at 00:00)
  agents: Agent[];
  systems: Record<SystemId, number>;
  science: number;
  log: { minute: number; text: string; kind: "info" | "ok" | "warn" | "bad" }[];
  lastMeal: Record<string, number>;
}

const WORK_ROOM: Record<Role, string> = { commander: "bridge", pilot: "bridge", engineer: "eclss", scientist: "lab", doctor: "lab" };

/** Scheduled activity for an agent at a given time of day (minutes 0..1439). */
export function scheduled(a: Agent, tod: number, day: number): { act: Activity; room: string } {
  const h = tod / 60;
  const exStart = a.slot % 2 === 0 ? 13 : 15.5; // staggered gym slots (2.5 h each)
  if (h < 6 || h >= 21.5) return { act: "sleep", room: "quarters" };
  if (h < 6.5) return { act: "hygiene", room: "hygiene" };
  if (h < 7) return { act: "eat", room: "galley" };
  if (h < 7.5) return { act: "conference", room: "bridge" };
  if (h < 12) return { act: "work", room: WORK_ROOM[a.role] };
  if (h < 13) return { act: "eat", room: "galley" };
  if (h >= exStart && h < exStart + 2.5) return { act: "exercise", room: "gym" };
  if (h < 18.5) return { act: "work", room: WORK_ROOM[a.role] };
  if (h < 19.5) return { act: "eat", room: "galley" };
  if (h < 21) return (day + a.slot) % 2 === 0 ? { act: "comms", room: "comms" } : { act: "leisure", room: "galley" };
  return { act: "hygiene", room: "hygiene" };
}

export function createHabitat(crew: Astronaut[], startMinute = 6 * 60): Habitat {
  const agents: Agent[] = crew.map((c, i) => ({
    id: c.id, name: c.name, role: c.role, skills: c.skills, x: 2 + i * 1.5, deck: 1, climbing: 0,
    activity: "sleep", roomId: "quarters", targetX: 2 + i * 1.5, targetDeck: 1, targetRoom: "quarters",
    needs: { energy: 85, hunger: 30, fitness: 80, stress: 20, health: 100 }, task: null, ill: false,
    stats: { sleepMin: 0, meals: 0, exerciseMin: 0, scienceMin: 0 }, slot: i,
  }));
  return { minute: startMinute, agents, systems: { lifeSupport: 100, power: 100, water: 100, thermal: 100, comms: 100 }, science: 0,
    log: [{ minute: startMinute, text: "Tripulación a bordo del hábitat de tránsito.", kind: "info" }], lastMeal: {} };
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));
const WALK = 2.2; // units per minute
const CLIMB_MIN = 1.2;

/** Advance one simulated minute. */
export function stepMinute(h: Habitat, rand: () => number) {
  const tod = h.minute % 1440, day = Math.floor(h.minute / 1440);
  const log = (text: string, kind: Habitat["log"][number]["kind"] = "info") => h.log.unshift({ minute: h.minute, text, kind });

  // ---- random faults & illness
  for (const s of Object.keys(h.systems) as SystemId[]) {
    if (h.systems[s] > 90 && rand() < 1 / (60 * 24 * 6)) {
      h.systems[s] = 35 + rand() * 25;
      log(`Avería: ${SYSTEM_LABEL[s]} al ${Math.round(h.systems[s])} %.`, "warn");
    }
  }
  if (rand() < 1 / (60 * 24 * 12)) {
    const p = h.agents[Math.floor(rand() * h.agents.length)];
    if (!p.ill) { p.ill = true; p.needs.health = 60; log(`${p.name} presenta síntomas (infección leve).`, "warn"); }
  }

  // ---- task assignment
  for (const s of Object.keys(h.systems) as SystemId[]) {
    if (h.systems[s] < 90 && !h.agents.some((a) => a.task?.kind === "repair" && a.task.system === s)) {
      const fixer = [...h.agents].filter((a) => !a.task && !a.ill).sort((x, y) => (y.skills.engineering + (y.role === "engineer" ? 3 : 0)) - (x.skills.engineering + (x.role === "engineer" ? 3 : 0)))[0];
      if (fixer && (h.systems[s] < 60 || scheduled(fixer, tod, day).act !== "sleep")) {
        fixer.task = { kind: "repair", system: s };
        log(`${fixer.name} se dirige a reparar: ${SYSTEM_LABEL[s]}.`);
      }
    }
  }
  for (const p of h.agents) {
    if (p.ill && p.task?.kind !== "patient") {
      p.task = { kind: "patient" };
      const doc = [...h.agents].filter((a) => a.id !== p.id && !a.task).sort((x, y) => y.skills.medicine - x.skills.medicine)[0];
      if (doc) { doc.task = { kind: "treat", patient: p.id }; log(`${doc.name} atiende a ${p.name} en la enfermería.`); }
    }
  }

  // ---- each agent: decide target, move, act
  for (const a of h.agents) {
    let act: Activity, target: string;
    if (a.task?.kind === "repair") { act = "repair"; target = SYSTEM_ROOM[a.task.system]; }
    else if (a.task?.kind === "treat") { act = "treat"; target = "med"; }
    else if (a.task?.kind === "patient") { act = "patient"; target = "med"; }
    else if (a.needs.energy < 10) { act = "sleep"; target = "quarters"; }
    else if (a.needs.hunger > 92) { act = "eat"; target = "galley"; }
    else ({ act, room: target } = scheduled(a, tod, day));

    if (a.targetRoom !== target) {
      const r = room(target);
      a.targetRoom = target; a.targetDeck = r.deck;
      a.targetX = r.x0 + 0.8 + ((a.slot * 1.37) % Math.max(0.5, r.x1 - r.x0 - 1.6));
    }
    // movement: walk to a ladder if the deck differs, climb, then walk to the target
    let moving = false;
    if (a.climbing > 0) { a.climbing -= 1; moving = true; if (a.climbing <= 0) a.deck = a.targetDeck; }
    else if (a.deck !== a.targetDeck) {
      const ladder = LADDERS.reduce((b, l) => (Math.abs(l - a.x) < Math.abs(b - a.x) ? l : b));
      if (Math.abs(a.x - ladder) < 0.05) a.climbing = CLIMB_MIN;
      else a.x += Math.sign(ladder - a.x) * Math.min(WALK, Math.abs(ladder - a.x));
      moving = true;
    } else if (Math.abs(a.x - a.targetX) > 0.05) {
      a.x += Math.sign(a.targetX - a.x) * Math.min(WALK, Math.abs(a.targetX - a.x));
      moving = true;
    }
    a.activity = moving ? "walk" : act;
    a.roomId = ROOMS.find((r) => r.deck === a.deck && a.x >= r.x0 && a.x <= r.x1)?.id ?? a.roomId;

    // ---- needs per minute
    const n = a.needs, perMin = 1 / 60;
    n.hunger = clamp(n.hunger + 6 * perMin);
    n.fitness = clamp(n.fitness - 1.2 * perMin);
    n.stress = clamp(n.stress + 0.6 * perMin);
    if (a.activity !== "sleep") n.energy = clamp(n.energy - (a.activity === "exercise" || a.activity === "repair" ? 6 : 4) * perMin);
    switch (a.activity) {
      case "sleep": n.energy = clamp(n.energy + 12 * perMin); n.stress = clamp(n.stress - 2 * perMin); a.stats.sleepMin++; break;
      case "eat": n.hunger = clamp(n.hunger - 120 * perMin); if ((h.lastMeal[a.id] ?? -999) < h.minute - 120) { a.stats.meals++; h.lastMeal[a.id] = h.minute; } break;
      case "exercise": n.fitness = clamp(n.fitness + 16 * perMin); n.stress = clamp(n.stress - 3 * perMin); a.stats.exerciseMin++; break;
      case "leisure": n.stress = clamp(n.stress - 6 * perMin); break;
      case "comms": n.stress = clamp(n.stress - 8 * perMin); break;
      case "work": if (a.roomId === "lab") { h.science += (a.skills.science / 10) * perMin; a.stats.scienceMin++; } n.stress = clamp(n.stress + 0.5 * perMin); break;
      case "repair": if (a.task?.kind === "repair") {
        const s = a.task.system;
        h.systems[s] = Math.min(100, h.systems[s] + (a.skills.engineering * 0.9) * perMin * 10 / 6);
        if (h.systems[s] >= 100) { log(`${a.name} reparó ${SYSTEM_LABEL[s]}.`, "ok"); a.task = null; }
      } break;
      case "treat": if (a.task?.kind === "treat") {
        const p = h.agents.find((x) => x.id === (a.task as { patient: string }).patient)!;
        if (p.roomId === "med") p.needs.health = Math.min(100, p.needs.health + a.skills.medicine * 0.06);
        if (p.needs.health >= 100) { p.ill = false; p.task = null; a.task = null; log(`${p.name} recibió el alta médica.`, "ok"); }
      } break;
    }
    if (n.hunger > 95 || n.energy < 5) n.health = clamp(n.health - 0.05);
    if (h.systems.lifeSupport < 30) { n.stress = clamp(n.stress + 0.2); n.health = clamp(n.health - 0.02); }
  }
  h.minute++;
}
