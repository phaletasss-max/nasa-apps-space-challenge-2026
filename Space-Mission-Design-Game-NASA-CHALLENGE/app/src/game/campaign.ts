/**
 * Campaign rules — pure functions over a mutable Campaign object (no UI, no storage).
 * The zustand store (store.ts) clones the campaign, calls one of these, and applies the returned Effect.
 *
 * Mission life cycle (see docs/LOGICA.md for the full map):
 *   design → building → ready → ascent → cruise → arrived ┬→ complete (orbit / flyby, robotic)
 *                                                          ├→ landing → complete (robotic)  | failed
 *                                                          │          └→ surface → return → reentry → complete | failed (crewed)
 *                                                          └→ return → reentry → complete | failed (crewed flyby)
 *   any phase → failed (ascent failure, impact, no Δv, anomaly) ; campaign → over (bankruptcy)
 */
import { planAssembly, projectCompletion, stepDay, type Assembly, type LogLine } from "./assembly";
import { DEFAULT_VEHICLE, payloadById, type Vehicle } from "./catalog";
import { CONTRACTS, launchWindow, TARGET_LABEL, type Contract } from "./contracts";
import { generateCandidates, trainingDays, type Astronaut } from "./crew";
import { crewReady, initShip, shipDay, type ShipState } from "./crewcare";
import { predictEncounters, sizeKm } from "./hazards";
import { rngFrom } from "./rng";
import { planTransfer, transferPosition, type Transfer } from "./trajectory";

export type MissionPhase = "design" | "building" | "ready" | "ascent" | "cruise" | "arrived" | "landing" | "surface" | "return" | "reentry" | "complete" | "failed";
export type NextScreen = "hub" | "vehicle" | "ops" | "landing" | "debrief";

/** What the UI should do after a rule ran. */
export interface Effect { pause?: boolean; screen?: NextScreen; error?: string }

/** A predicted close approach, kept small so it can be saved. */
export interface Pass {
  name: string; cls: string; sizeKm: number; sizeEstimated: boolean; neo: boolean; pha: boolean;
  missKm: number; dateMs: number; relSpeedKms: number;
  level: "alert" | "watch" | "flyby";
  collisionProb: number;
  decision: "none" | "avoid" | "flyby";
  done: boolean;
}

export interface Mission {
  contractId: string;
  vehicle: Vehicle;
  assembly: Assembly | null;
  crewIds: string[];
  phase: MissionPhase;
  window: number | null;
  transfer: Transfer | null;
  launchDate?: number;
  /** Crewed missions: when the surface stay / return leg ends. */
  surfaceUntil?: number; returnStart?: number; returnAt?: number;
  ship: ShipState | null;
  shipLog: LogLine[];
  dvMargin: number; // m/s left on the payload after reserving the arrival burn
  dvSpent: number;
  passes: Pass[];
  science: number;
  scrubs: number;
  result?: { success: boolean; title: string; lines: string[]; crewLost?: boolean };
}

export interface Campaign {
  agency: string;
  budget: number; reputation: number; science: number;
  date: number; seed: number; day: number;
  teams: number;
  candidates: Astronaut[];
  mission: Mission | null;
  designs: Vehicle[];
  history: { title: string; success: boolean; date: number; science: number }[];
  news: LogLine[];
  over?: { reason: string; date: number };
}

// ------------------------------------------------------------------ economic and operational constants
export const KEEP_OUT_KM = 2e6;
export const MAX_TEAMS = 10;
export const START_BUDGET = 1500; // M USD
export const CREDIT_LINE = 300; // M USD of overdraft before bankruptcy
export const DEBT_INTEREST = 0.06; // per year on the negative balance
export const IDLE_TEAM_COST = 0.03; // M USD per team per day while no vehicle is in production
export const HIRE_COST = 1.5; // M USD selection and medical screening
export const MAX_DESIGNS = 12;
const DAY = 86400000;

export const contractOf = (c: Campaign | null): Contract | null => (c?.mission ? CONTRACTS.find((x) => x.id === c.mission!.contractId)! : null);
/** Contracts unlocked by reputation: each 20 points opens one difficulty level. */
export const unlocked = (c: Campaign, k: Contract) => k.difficulty <= 1 + Math.floor(c.reputation / 20);
export const fmtDay = (t: number) => new Date(t).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
export const flybyScience = (km: number) => Math.round(Math.min(260, 40 + 18 * Math.sqrt(km)));
/** Hardware + test cost of building a design (team salaries not included). */
export const programCost = (v: Vehicle, date = 0) => planAssembly(v, date).tasks.reduce((s, t) => s + t.cost, 0);
export const crewOf = (c: Campaign) => c.candidates.filter((a) => c.mission?.crewIds.includes(a.id));
const isCrewed = (k: Contract) => k.crew > 0;

function news(c: Campaign, text: string, kind: LogLine["kind"] = "info") { c.news.unshift({ date: c.date, text, kind }); c.news = c.news.slice(0, 150); }
function shipNews(m: Mission, date: number, text: string, kind: LogLine["kind"]) { m.shipLog.unshift({ date, text, kind }); m.shipLog = m.shipLog.slice(0, 80); }

/** Old saves: fill fields added in later versions. */
export function migrate(c: Campaign): Campaign {
  c.designs ??= [];
  if (c.mission) { c.mission.ship ??= null; c.mission.shipLog ??= []; }
  return c;
}

// ------------------------------------------------------------------ campaign
export function createCampaign(agency: string, seed: number, date: number): Campaign {
  return {
    agency, budget: START_BUDGET, reputation: 20, science: 0, date, seed, day: 0, teams: 3,
    candidates: generateCandidates(seed), mission: null, designs: [], history: [],
    news: [{ date, text: `Se constituye ${agency}. Presupuesto inicial: ${START_BUDGET.toLocaleString("es-PE")} M USD y línea de crédito de ${CREDIT_LINE} M USD. Revise la cartera de contratos.`, kind: "info" }],
  };
}

/**
 * The daily model. Order inside a day: production → payroll and training → interest → calendar →
 * cruise events (asteroid passes, crew condition, arrival / surface / return milestones) → windows → solvency.
 * Stops early when something needs the player's attention.
 */
export function simulateDays(c: Campaign, n: number): Effect {
  const eff: Effect = {};
  const stop = () => { eff.pause = true; };
  for (let k = 0; k < n && !c.over; k++) {
    const m = c.mission;
    // ---- production
    if (m?.assembly && m.phase === "building") {
      const before = m.assembly.spent, logLen = m.assembly.log.length;
      stepDay(m.assembly, rngFrom(c.seed + c.day * 7919));
      c.budget -= m.assembly.spent - before;
      for (const l of m.assembly.log.slice(0, m.assembly.log.length - logLen)) if (l.kind === "bad") { news(c, l.text, "bad"); stop(); }
      if (m.assembly.complete) { m.phase = "ready"; news(c, "Vehículo integrado y en la plataforma. Listo para la revisión de lanzamiento.", "ok"); stop(); }
    } else c.budget -= c.teams * IDLE_TEAM_COST;
    // ---- payroll and training
    for (const a of c.candidates) if (a.hired) {
      c.budget -= a.salary / 365;
      if (m && m.crewIds.includes(a.id) && a.training < 1 && (m.phase === "design" || m.phase === "building" || m.phase === "ready")) {
        a.training = Math.min(1, a.training + 1 / trainingDays(a));
        if (a.training >= 1) news(c, `${a.name} completó el entrenamiento específico de la misión.`, "ok");
      }
    }
    if (c.budget < 0) c.budget -= (-c.budget * DEBT_INTEREST) / 365;
    c.date += DAY; c.day++;

    // ---- flight
    if (m && m.transfer && (m.phase === "cruise" || m.phase === "surface" || m.phase === "return")) {
      if (m.ship) {
        const crew = crewOf(c);
        for (const e of shipDay(m.ship, crew, rngFrom(c.seed * 3 + c.day), m.transfer.target !== "moon")) {
          shipNews(m, c.date, e.text, e.kind);
          if (e.kind === "bad") news(c, e.text, "bad");
        }
      }
      if (m.phase === "cruise") {
        if (resolvePasses(c, m)) { stop(); eff.screen = "debrief"; break; }
        const alertSoon = m.passes.some((p) => !p.done && p.decision === "none" && p.level === "alert" && p.dateMs - c.date < 20 * DAY && p.dateMs - c.date >= 19 * DAY);
        if (alertSoon) { news(c, "Aproximación en zona de exclusión dentro de 20 días: se requiere una decisión.", "warn"); stop(); }
        if (c.date >= m.transfer.arrival) {
          c.date = m.transfer.arrival;
          m.phase = "arrived";
          news(c, `Llegada a ${TARGET_LABEL[m.transfer.target]}.`, "ok");
          stop(); break;
        }
      } else if (m.phase === "surface" && m.surfaceUntil && c.date >= m.surfaceUntil) {
        startReturn(c, m);
        news(c, "Despegue desde la superficie y acoplamiento con la cápsula. Inicio del regreso a la Tierra.", "ok");
        stop();
      } else if (m.phase === "return" && m.returnAt && c.date >= m.returnAt) {
        c.date = m.returnAt;
        m.phase = "reentry";
        news(c, "La cápsula se aproxima a la Tierra: preparar la reentrada.", "warn");
        stop(); break;
      }
    }
    // ---- launch windows
    if (m && m.window && (m.phase === "design" || m.phase === "building" || m.phase === "ready") && c.date > m.window + 25 * DAY) {
      const ct = contractOf(c)!;
      const w = launchWindow(ct, c.date);
      if (ct.target !== "moon") { news(c, `Se cerró la ventana de lanzamiento a ${TARGET_LABEL[ct.target]}. Próxima apertura: ${fmtDay(w!)}.`, "warn"); stop(); }
      m.window = w;
    }
    if (m?.phase === "ready" && m.window && contractOf(c)!.target !== "moon" && Math.abs(c.date - m.window) < DAY / 2) { news(c, "Se abre la ventana de lanzamiento.", "ok"); stop(); }
    // ---- solvency
    if (c.budget < -CREDIT_LINE) {
      c.over = { reason: `La deuda superó la línea de crédito de ${CREDIT_LINE} M USD.`, date: c.date };
      news(c, "La agencia entra en quiebra: el directorio suspende las operaciones.", "bad");
      stop(); break;
    }
    if (eff.pause) break;
  }
  return eff;
}

/** Asteroid passes that happened today. Returns true if the spacecraft was lost. */
function resolvePasses(c: Campaign, m: Mission): boolean {
  for (const p of m.passes) {
    if (p.done || p.dateMs > c.date) continue;
    p.done = true;
    if (p.decision === "flyby") {
      const sci = flybyScience(p.sizeKm);
      m.science += sci;
      news(c, `Sobrevuelo científico de ${p.name} a 5 000 km: imágenes y espectros obtenidos (+${sci} ciencia).`, "ok");
    } else if (p.decision === "avoid") {
      news(c, `${p.name} pasó a más de ${(KEEP_OUT_KM / 1e6).toFixed(0)} millones de km tras la maniobra de evasión.`, "info");
    } else if (rngFrom(c.seed + c.day)() < p.collisionProb) {
      news(c, `Contacto perdido cerca de ${p.name}. Impacto probable.`, "bad");
      finishMission(c, false, "Pérdida de la nave en crucero", [`La nave pasó a ${Math.round(p.missKm).toLocaleString("es-PE")} km de ${p.name} sin maniobra de evasión.`], isCrewed(contractOf(c)!));
      return true;
    } else news(c, `${p.name} pasó a ${Math.round(p.missKm).toLocaleString("es-PE")} km de la nave sin consecuencias.`, p.level === "alert" ? "warn" : "info");
  }
  return false;
}

function startReturn(c: Campaign, m: Mission) {
  const k = contractOf(c)!;
  m.phase = "return";
  m.returnStart = c.date;
  m.returnAt = c.date + (k.returnDays ?? 4.5) * DAY;
}

// ------------------------------------------------------------------ contracts and design
export function acceptContract(c: Campaign, id: string): Effect {
  if (c.mission) return { error: "Ya hay una misión activa." };
  const k = CONTRACTS.find((x) => x.id === id)!;
  if (!unlocked(c, k)) return { error: "Reputación insuficiente para este contrato." };
  c.budget += k.advance;
  c.mission = {
    contractId: id, vehicle: { ...structuredClone(DEFAULT_VEHICLE), payload: k.payloads[0] }, assembly: null, crewIds: [],
    phase: "design", window: launchWindow(k, c.date), transfer: null, ship: null, shipLog: [],
    dvMargin: 0, dvSpent: 0, passes: [], science: 0, scrubs: 0,
  };
  news(c, `Contrato firmado con ${k.client}: ${k.title}. Anticipo recibido: ${k.advance} M USD.`, "ok");
  return { screen: "vehicle" };
}

export function abandonMission(c: Campaign): Effect {
  if (!c.mission) return {};
  const k = contractOf(c)!;
  news(c, `Contrato rescindido: ${k.title}. Se devuelve el anticipo y la reputación cae 10 puntos.`, "bad");
  c.budget -= k.advance;
  c.reputation = Math.max(0, c.reputation - 10);
  for (const a of c.candidates) if (c.mission.crewIds.includes(a.id)) a.training = 0;
  c.mission = null;
  return { screen: "hub" };
}

/** Freeze the design (critical design review) and start production. Needs funds or credit for the hardware. */
export function startBuild(c: Campaign): Effect {
  const m = c.mission;
  if (!m || m.phase !== "design") return {};
  const cost = programCost(m.vehicle, c.date);
  if (cost > c.budget + CREDIT_LINE) return { error: `El hardware cuesta ${Math.round(cost)} M USD y solo hay ${Math.round(c.budget + CREDIT_LINE)} M USD disponibles con crédito.` };
  m.assembly = planAssembly(m.vehicle, c.date, c.teams);
  m.phase = "building";
  news(c, `Diseño «${m.vehicle.name}» congelado (revisión crítica aprobada). Fabricación iniciada; fin estimado: ${fmtDay(projectCompletion(m.assembly))}.`, "info");
  return {};
}

export function saveDesign(c: Campaign, v: Vehicle) {
  const copy = structuredClone(v);
  c.designs = [copy, ...c.designs.filter((d) => d.name !== v.name)].slice(0, MAX_DESIGNS);
}
export function deleteDesign(c: Campaign, name: string) { c.designs = c.designs.filter((d) => d.name !== name); }

// ------------------------------------------------------------------ crew
export function hire(c: Campaign, id: string) {
  const a = c.candidates.find((x) => x.id === id);
  if (!a || a.hired || a.lost) return;
  a.hired = true; c.budget -= HIRE_COST;
  news(c, `Incorporación al cuerpo de astronautas: ${a.name} (${a.country}).`);
}
export function release(c: Campaign, id: string) {
  const a = c.candidates.find((x) => x.id === id);
  if (!a) return;
  if (c.mission && c.mission.crewIds.includes(id) && !["design", "building", "ready"].includes(c.mission.phase)) return; // in flight
  a.hired = false; a.training = 0;
  if (c.mission) c.mission.crewIds = c.mission.crewIds.filter((x) => x !== id);
}
export function toggleCrew(c: Campaign, id: string) {
  const m = c.mission;
  if (!m || !["design", "building", "ready"].includes(m.phase)) return;
  const seats = payloadById(m.vehicle.payload).crew;
  if (m.crewIds.includes(id)) { m.crewIds = m.crewIds.filter((x) => x !== id); c.candidates.find((x) => x.id === id)!.training = 0; }
  else if (m.crewIds.length < seats) m.crewIds.push(id);
}

// ------------------------------------------------------------------ launch and flight
export function scrub(c: Campaign, reason: string): Effect {
  if (c.mission) c.mission.scrubs++;
  news(c, `Lanzamiento suspendido: ${reason}. Nuevo intento en 24 h.`, "warn");
  simulateDays(c, 1);
  return { pause: true };
}

/** Trans-target injection after reaching the parking orbit; the payload covers any shortfall of the upper stage. */
export function depart(c: Campaign, dvLeftUpper: number, events: string[]): Effect {
  const m = c.mission, k = contractOf(c);
  if (!m || !k) return {};
  const pay = payloadById(m.vehicle.payload);
  const shortfall = Math.max(0, k.dvDeparture - dvLeftUpper);
  m.launchDate = c.date;
  m.transfer = planTransfer(k.target, c.date, k.cruiseDays);
  m.dvMargin = pay.ownDv - k.dvArrival - shortfall;
  m.ship = isCrewed(k) ? initShip(crewOf(c)) : null;
  for (const e of events) news(c, e, "info");
  news(c, `Inyección hacia ${TARGET_LABEL[k.target]} completada${shortfall > 0 ? `; la nave cubrió ${Math.round(shortfall)} m/s con su propio motor` : ""}. Margen de Δv para correcciones: ${Math.round(m.dvMargin)} m/s.`, m.dvMargin >= 0 ? "ok" : "warn");
  m.phase = "cruise";
  if (m.transfer) {
    const tr = m.transfer;
    m.passes = predictEncounters((ms) => transferPosition(tr, ms), tr.window + DAY, tr.arrival, c.date, { keepOutKm: KEEP_OUT_KM, watchKm: 8e6, steps: tr.target === "moon" ? 60 : 500 })
      .slice(0, 24)
      .map((e) => ({ name: e.asteroid.name, cls: e.asteroid.cls, sizeKm: sizeKm(e.asteroid), sizeEstimated: e.asteroid.diameterKm === null, neo: e.asteroid.neo, pha: e.asteroid.pha,
        missKm: e.missKm, dateMs: e.dateMs, relSpeedKms: e.relSpeedKms, level: e.level, collisionProb: e.collisionProb, decision: "none" as const, done: false }));
    const alerts = m.passes.filter((p) => p.level === "alert").length;
    news(c, `Predictor de riesgos: ${m.passes.length} objetos a menos de 8 millones de km de la ruta${alerts ? `, ${alerts} dentro de la zona de exclusión` : ""}.`, alerts ? "warn" : "info");
  }
  return { screen: "ops", pause: true };
}

export function decide(c: Campaign, name: string, decision: Pass["decision"], dv: number) {
  const m = c.mission;
  const p = m?.passes.find((x) => x.name === name);
  if (!m || !p || p.done || dv > m.dvMargin) return;
  p.decision = decision;
  m.dvMargin -= dv; m.dvSpent += dv;
  news(c, decision === "avoid" ? `Maniobra de corrección de trayectoria (TCM) para alejarse de ${name}: ${dv.toFixed(2)} m/s.`
    : `Trayectoria ajustada para sobrevolar ${name} a 5 000 km: ${dv.toFixed(2)} m/s.`, "info");
}

/**
 * Arrival manoeuvre. Order of checks: Δv for the arrival burn → spacecraft anomaly (payload reliability,
 * reduced by a good flight engineer on crewed missions) → crew fitness before a landing → branch.
 */
export function arrive(c: Campaign): Effect {
  const k = contractOf(c), m = c.mission;
  if (!k || !m || m.phase !== "arrived") return {};
  const pay = payloadById(m.vehicle.payload);
  const crew = crewOf(c);
  const eng = Math.max(0, ...crew.map((a) => a.skills.engineering));
  const pFail = (1 - pay.reliability) * (1 - eng / 20);
  if (m.dvMargin < 0 && k.dvArrival > 0)
    return finishMission(c, false, "Sin combustible para la llegada", [`Faltaron ${Math.round(-m.dvMargin)} m/s para la maniobra de llegada a ${TARGET_LABEL[k.target]}. La nave pasa de largo.`], false, isCrewed(k));
  if (rngFrom(c.seed + 4242)() < pFail)
    return finishMission(c, false, "Anomalía de la nave", ["Una falla en el sistema de propulsión durante la maniobra de llegada terminó con la misión."], false, isCrewed(k));
  if (isCrewed(k)) {
    const ready = crewReady(m.ship ?? initShip(crew));
    if (k.landing && !ready.ok) {
      news(c, `Descenso cancelado por reglas de vuelo: ${ready.reason}. La tripulación regresa.`, "warn");
      m.result = { success: false, title: "Descenso cancelado", lines: [`Las reglas de vuelo impidieron el descenso: ${ready.reason}.`] };
      startReturn(c, m);
      return { screen: "ops", pause: true };
    }
    if (!k.landing) { news(c, `Sobrevuelo de ${TARGET_LABEL[k.target]} completado. Trayectoria de retorno libre hacia la Tierra.`, "ok"); m.science += 150; startReturn(c, m); return { screen: "ops", pause: true }; }
  }
  if (k.landing) { m.phase = "landing"; return { screen: "landing" }; }
  return finishMission(c, true, k.dvArrival > 0 ? `En órbita de ${TARGET_LABEL[k.target]}` : "Sobrevuelo completado",
    [k.dvArrival > 0 ? `Maniobra de inserción orbital de ${(k.dvArrival / 1000).toFixed(2)} km/s ejecutada.` : `Sobrevuelo de ${TARGET_LABEL[k.target]} completado.`]);
}

/** End of the landing simulation. Crewed missions continue on the surface. */
export function landed(c: Campaign, ok: boolean, text: string): Effect {
  const k = contractOf(c), m = c.mission;
  if (!k || !m) return {};
  if (!ok) return finishMission(c, false, `Pérdida durante el descenso a ${TARGET_LABEL[k.target]}`, [text], isCrewed(k));
  if (!isCrewed(k)) return finishMission(c, true, `Aterrizaje en ${TARGET_LABEL[k.target]}`, [text]);
  const crew = crewOf(c);
  const eva = Math.round(crew.reduce((s, a) => s + a.skills.science, 0) * (k.surfaceDays ?? 3) * 6);
  m.science += eva;
  m.phase = "surface";
  m.surfaceUntil = c.date + (k.surfaceDays ?? 3) * DAY;
  news(c, `Alunizaje confirmado. Comienzan ${k.surfaceDays ?? 3} días de actividades extravehiculares (+${eva} ciencia).`, "ok");
  return { screen: "ops", pause: true };
}

/** Re-entry and splashdown: heat-shield and parachute reliability of the capsule. */
export function reenter(c: Campaign): Effect {
  const k = contractOf(c), m = c.mission;
  if (!k || !m || m.phase !== "reentry") return {};
  const ok = rngFrom(c.seed + 777)() < 0.995;
  const aborted = m.result?.title === "Descenso cancelado";
  if (!ok) return finishMission(c, false, "Pérdida durante la reentrada", ["Falla del escudo térmico durante la reentrada a 11 km/s."], true);
  const doses = m.ship ? Math.max(...m.ship.crew.map((x) => x.doseMsv)) : 0;
  const lines = ["Reentrada a 11 km/s y amerizaje en el Pacífico. La tripulación está a salvo.", `Dosis máxima de radiación de la tripulación: ${doses.toFixed(0)} mSv.`];
  if (aborted) return finishMission(c, false, "Tripulación a salvo, objetivo no cumplido", [...(m.result?.lines ?? []), ...lines], false, true);
  return finishMission(c, true, k.landing ? "Alunizaje y regreso completados" : "Sobrevuelo tripulado completado", lines);
}

/**
 * Close the mission: payment, reputation, science, astronaut records.
 * Reputation: success +8 + 5·difficulty; robotic failure −8; crew lost −25; crew safe after an abort −3.
 */
export function finishMission(c: Campaign, success: boolean, title: string, lines: string[], crewLost = false, crewSafe = false): Effect {
  const m = c.mission, k = contractOf(c);
  if (!m || !k) return {};
  const sci = Math.round(success ? k.science + m.science + (m.ship?.science ?? 0) : (m.science + (m.ship?.science ?? 0)) * 0.5);
  if (success) { c.budget += k.reward; c.reputation = Math.min(100, c.reputation + 8 + k.difficulty * 5); }
  else c.reputation = Math.max(0, c.reputation - (crewLost ? 25 : crewSafe ? 3 : 8));
  c.science += sci;
  m.phase = success ? "complete" : "failed";
  m.result = { success, crewLost, title, lines: [...lines,
    success ? `Pago final del contrato: ${k.reward} M USD.` : "El cliente no realiza el pago final.",
    `Ciencia entregada: ${sci} puntos.`] };
  c.history.unshift({ title: k.title, success, date: c.date, science: sci });
  for (const id of m.crewIds) {
    const a = c.candidates.find((x) => x.id === id);
    if (!a) continue;
    if (crewLost) { a.lost = true; a.hired = false; } else a.flights++;
    a.training = 0;
  }
  if (crewLost) news(c, `Duelo en la agencia: se pierde a la tripulación de ${k.title}.`, "bad");
  news(c, `${success ? "Misión cumplida" : "Misión fallida"}: ${k.title}.`, success ? "ok" : "bad");
  return { screen: "debrief", pause: true };
}

export function closeMission(c: Campaign): Effect { c.mission = null; return { screen: "hub" }; }
