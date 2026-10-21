/**
 * Vehicle production & integration schedule (a small project-management model).
 * Tasks form a dependency graph; engineering teams are assigned by critical-path priority;
 * tests can fail according to part reliability and trigger rework. Advances one day at a time.
 */
import { boosterById, engineById, payloadById, TANK_DAYS_PER_T, type Vehicle } from "./catalog";

export type TaskStatus = "pending" | "active" | "done";
export type TaskKind = "build" | "test" | "integrate";

export interface Task {
  id: string; name: string; group: string; kind: TaskKind;
  days: number; // nominal duration with one team
  deps: string[];
  cost: number; // M USD charged when the task starts
  successP?: number; // tests: probability of passing
  progress: number; // 0..1
  status: TaskStatus;
  teams: number;
  start?: number; end?: number; // ms
  attempts: number;
}

export interface LogLine { date: number; text: string; kind: "info" | "ok" | "warn" | "bad" }

export interface Assembly {
  tasks: Task[];
  teams: number; // engineering teams on payroll
  date: number; // current schedule date (ms)
  spent: number; // M USD
  log: LogLine[];
  complete: boolean;
}

export const TEAM_COST_PER_DAY = 0.06; // M USD per team per day (salaries, facilities)
export const MAX_TEAMS_PER_TASK = 3;
const DAY = 86400000;

export function planAssembly(v: Vehicle, startMs: number, teams = 3): Assembly {
  const T: Task[] = [];
  const add = (t: Omit<Task, "progress" | "status" | "teams" | "attempts">) => { T.push({ ...t, progress: 0, status: "pending", teams: 0, attempts: 0 }); return t.id; };
  const stageTests: string[] = [];
  v.stages.forEach((s, i) => {
    const e = engineById(s.engine), g = `Etapa ${i + 1}`;
    const eng = add({ id: `s${i}-eng`, name: `${s.count} × motor ${e.name.split(" (")[0]}`, group: g, kind: "build",
      days: Math.round(e.buildDays * (1 + 0.12 * (s.count - 1))), deps: [], cost: e.cost * s.count });
    const tank = add({ id: `s${i}-tank`, name: `Tanques y estructura (${s.propT} t)`, group: g, kind: "build",
      days: Math.round(30 + s.propT * TANK_DAYS_PER_T), deps: [], cost: 10 + s.propT * 0.12 });
    const integ = add({ id: `s${i}-int`, name: "Integración de la etapa", group: g, kind: "integrate", days: 20, deps: [eng, tank], cost: 4 });
    stageTests.push(add({ id: `s${i}-test`, name: "Prueba de encendido estático", group: g, kind: "test", days: 8, deps: [integ], cost: 3,
      successP: Math.max(0.6, e.reliability ** s.count * 0.96) }));
  });
  if (v.boosters && v.boosters.count) {
    const b = boosterById(v.boosters.id);
    const f = add({ id: "b-build", name: `${v.boosters.count} × ${b.name}`, group: "Boosters", kind: "build", days: b.buildDays, deps: [], cost: b.cost * v.boosters.count });
    stageTests.push(add({ id: "b-test", name: "Encendido de calificación en banco", group: "Boosters", kind: "test", days: 10, deps: [f], cost: 4, successP: 0.95 }));
  }
  const p = payloadById(v.payload);
  const pb = add({ id: "p-build", name: `Fabricación: ${p.name}`, group: "Carga útil", kind: "build", days: p.buildDays, deps: [], cost: p.cost * 0.8 });
  const pt = add({ id: "p-test", name: "Pruebas ambientales (vacío térmico y vibración)", group: "Carga útil", kind: "test", days: 35, deps: [pb], cost: p.cost * 0.05, successP: 0.9 });
  const stack = add({ id: "stack", name: "Apilamiento en el edificio de ensamblaje", group: "Integración", kind: "integrate", days: 21, deps: stageTests, cost: 6 });
  const fair = add({ id: "fairing", name: p.crew ? "Integración de la cápsula y torre de escape" : "Integración de carga útil y carenado", group: "Integración", kind: "integrate", days: 14, deps: [stack, pt], cost: 5 });
  const wdr = add({ id: "wdr", name: "Ensayo general con combustible (WDR)", group: "Integración", kind: "test", days: 6, deps: [fair], cost: 3, successP: 0.85 });
  add({ id: "rollout", name: "Traslado a la plataforma de lanzamiento", group: "Integración", kind: "integrate", days: 3, deps: [wdr], cost: 1 });
  return { tasks: T, teams, date: startMs, spent: 0, log: [{ date: startMs, text: `Inicio del programa de fabricación de «${v.name}».`, kind: "info" }], complete: false };
}

/** Remaining critical-path length (days) from each task to the end, with one team per task. */
export function criticalPath(a: Assembly): Map<string, number> {
  const memo = new Map<string, number>();
  const children = (id: string) => a.tasks.filter((t) => t.deps.includes(id));
  const rem = (t: Task) => (1 - t.progress) * t.days;
  const f = (t: Task): number => {
    if (memo.has(t.id)) return memo.get(t.id)!;
    const v = rem(t) + Math.max(0, ...children(t.id).map(f));
    memo.set(t.id, v);
    return v;
  };
  a.tasks.forEach(f);
  return memo;
}

const ready = (a: Assembly, t: Task) => t.status !== "done" && t.deps.every((d) => a.tasks.find((x) => x.id === d)!.status === "done");

/** Assign teams to ready tasks: longest remaining critical path first; spare teams double up (diminishing returns). */
export function assignTeams(a: Assembly) {
  const cp = criticalPath(a);
  a.tasks.forEach((t) => (t.teams = 0));
  const rdy = a.tasks.filter((t) => ready(a, t)).sort((x, y) => cp.get(y.id)! - cp.get(x.id)!);
  let free = a.teams;
  for (const t of rdy) { if (free <= 0) break; t.teams = 1; free--; }
  for (let round = 1; round < MAX_TEAMS_PER_TASK && free > 0; round++) {
    for (const t of rdy) { if (free <= 0) break; if (t.teams === round && t.kind !== "test") { t.teams++; free--; } }
  }
}

/** Advance the schedule by one day. */
export function stepDay(a: Assembly, rand: () => number) {
  if (a.complete) return;
  assignTeams(a);
  for (const t of a.tasks) {
    if (t.teams === 0) continue;
    if (t.status === "pending") {
      t.status = "active"; t.start = t.start ?? a.date; t.attempts++;
      a.spent += t.attempts === 1 ? t.cost : t.cost * 0.3;
    }
    if (t.kind !== "test" && rand() < 0.003) {
      const extra = Math.round(t.days * (0.08 + rand() * 0.12));
      t.days += extra;
      a.log.unshift({ date: a.date, text: `${t.group}: problema de calidad en «${t.name}» (+${extra} días).`, kind: "warn" });
    }
    t.progress += t.teams ** 0.75 / t.days;
    if (t.progress >= 1) {
      if (t.successP !== undefined && rand() > t.successP) {
        t.progress = 0; t.status = "pending"; t.days = Math.round(t.days * 1.6 + 10);
        a.log.unshift({ date: a.date, text: `${t.group}: ${t.name} FALLÓ. Se analiza la anomalía y se repite (+${t.days} días).`, kind: "bad" });
      } else {
        t.progress = 1; t.status = "done"; t.end = a.date;
        a.log.unshift({ date: a.date, text: `${t.group}: ${t.name} completado.`, kind: t.kind === "test" ? "ok" : "info" });
      }
    }
  }
  a.spent += a.teams * TEAM_COST_PER_DAY;
  a.date += DAY;
  if (a.tasks.every((t) => t.status === "done")) {
    a.complete = true;
    a.log.unshift({ date: a.date, text: "Vehículo en la plataforma: listo para lanzar.", kind: "ok" });
  }
}

/** Deterministic projection of the completion date (no failures, current team count). */
export function projectCompletion(a: Assembly): number {
  const sim: Assembly = JSON.parse(JSON.stringify(a));
  let guard = 0;
  while (!sim.complete && guard++ < 5000) stepDay(sim, () => 0.5);
  return sim.date;
}

export const progressOf = (a: Assembly) => a.tasks.reduce((s, t) => s + t.progress * t.days, 0) / a.tasks.reduce((s, t) => s + t.days, 0);
