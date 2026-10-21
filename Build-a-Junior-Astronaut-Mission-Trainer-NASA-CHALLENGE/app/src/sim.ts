/**
 * Outpost simulator: hourly mass & energy balance for a lunar or Martian base.
 * Pure logic (no rendering) so it can be unit-tested. Numbers are rounded, order-of-magnitude
 * values from public NASA sources (cited inline); this is a teaching model, not a design tool.
 */

export type SiteId = "moon-eq" | "moon-pole" | "mars";

export interface Site {
  id: SiteId;
  name: string;
  body: "moon" | "mars";
  dayHours: number; // length of a solar day
  peakFlux: number; // W/m² on a sun-facing panel at local noon, clear sky
  sunlitFraction: number; // share of the day with sun (pole: long days, short eclipses)
  doseGcr: number; // mSv/day on the surface, unshielded
  nightHeatKw: number; // extra heating per habitat module when the sun is down
  isruCo2: boolean; // Mars: O2 from atmospheric CO2 (MOXIE-like)
  ice: boolean; // lunar pole: water from ice in shadowed craters
  blurb: string;
}

export const SITES: Record<SiteId, Site> = {
  "moon-eq": {
    id: "moon-eq", name: "Luna · ecuador (Mar de la Tranquilidad)", body: "moon", dayHours: 708.7, peakFlux: 1361,
    sunlitFraction: 0.5, doseGcr: 1.37, nightHeatKw: 2.0, isruCo2: false, ice: false,
    blurb: "Un día lunar dura 29.5 días terrestres: ~14 días de sol y ~14 de noche helada (−170 °C).",
  },
  "moon-pole": {
    id: "moon-pole", name: "Luna · polo sur (borde de Shackleton)", body: "moon", dayHours: 708.7, peakFlux: 1230,
    sunlitFraction: 0.85, doseGcr: 1.37, nightHeatKw: 1.2, isruCo2: false, ice: true,
    blurb: "En los picos del polo sur el Sol casi no se pone y hay hielo en cráteres vecinos en sombra permanente.",
  },
  mars: {
    id: "mars", name: "Marte · cráter Jezero", body: "mars", dayHours: 24.66, peakFlux: 590,
    sunlitFraction: 0.5, doseGcr: 0.67, nightHeatKw: 1.5, isruCo2: true, ice: false,
    blurb: "Un sol dura 24 h 40 min. Llega ~43 % de la luz solar de la Tierra y el polvo la reduce aún más.",
  },
};

/** Per crew member per day (NASA BVAD-style rounded values). */
export const PER_CREW = { o2: 0.84, water: 4.0, food: 1.8, powerKw: 0.5 };
export const CAREER_LIMIT_MSV = 600; // NASA-STD-3001: career effective dose limit
const BASE_LOAD_KW = 1.5;
const HAB_MASS = 5000; // kg per habitat module (2 crew)
const MASS = { solarPerM2: 12, batteryPerKwh: 6, reactor: 1800, recycler: 500, electrolysisPerKgDay: 80, isruPerKgDay: 220, icePerKgDay: 150, greenhousePerM2: 30 };
const REACTOR_KW = 10; // Kilopower-class fission unit (kWe)

export interface Build {
  site: SiteId;
  crew: number;
  solarM2: number;
  batteryKwh: number;
  reactors: number;
  recycler: boolean;
  electrolysisKgDay: number; // O2 from water
  isruKgDay: number; // Mars only: O2 from CO2
  iceKgDay: number; // Moon pole only: water from ice
  greenhouseM2: number;
  shieldingCm: number; // regolith over the habitat (local material, no launch mass)
  supplyDays: number; // stored O2, water and food
  missionDays: number;
  massLimit: number; // kg the landers can deliver
  seed: number;
}

export const DEFAULT_BUILD: Build = {
  site: "moon-pole", crew: 4, solarM2: 220, batteryKwh: 300, reactors: 1, recycler: true, electrolysisKgDay: 4,
  isruKgDay: 0, iceKgDay: 12, greenhouseM2: 40, shieldingCm: 50, supplyDays: 160, missionDays: 180, massLimit: 40000, seed: 7,
};

export function launchMass(b: Build) {
  const habitats = Math.ceil(b.crew / 2);
  const parts = {
    habitats: habitats * HAB_MASS,
    solar: b.solarM2 * MASS.solarPerM2,
    battery: b.batteryKwh * MASS.batteryPerKwh,
    reactor: b.reactors * MASS.reactor,
    recycler: b.recycler ? MASS.recycler : 0,
    electrolysis: b.electrolysisKgDay * MASS.electrolysisPerKgDay,
    isru: b.isruKgDay * MASS.isruPerKgDay,
    ice: b.iceKgDay * MASS.icePerKgDay,
    greenhouse: b.greenhouseM2 * MASS.greenhousePerM2,
    supplies: b.supplyDays * b.crew * (PER_CREW.o2 + PER_CREW.water + PER_CREW.food),
  };
  return { parts, total: Object.values(parts).reduce((a, c) => a + c, 0) };
}

// ------------------------------------------------------------------ state
export interface Event { day: number; text: string; kind: "info" | "warn" | "bad" | "ok" }

export interface SimState {
  hour: number;
  o2: number; water: number; food: number; // kg in storage
  battery: number; // kWh
  dose: number; // mSv accumulated (per crew member)
  dust: number; // 0..1 panel dust loss (Mars)
  tau: number; // Mars atmospheric optical depth
  stormHoursLeft: number;
  speHoursLeft: number;
  recyclerDownHours: number;
  coldHours: number; // consecutive hours without heating
  hungryDays: number;
  // last-hour flows (for the HUD)
  solarKw: number; reactorKw: number; loadKw: number; shed: string[];
  sunElev: number; // −1..1 (sine of sun elevation, <0 night)
  status: "running" | "won" | "lost";
  reason: string;
  scienceHours: number;
  log: Event[];
  history: { day: number; o2: number; water: number; food: number; battery: number; dose: number }[];
}

export function initState(b: Build): SimState {
  const days = b.supplyDays;
  return {
    hour: 0, o2: days * b.crew * PER_CREW.o2, water: days * b.crew * PER_CREW.water, food: days * b.crew * PER_CREW.food,
    battery: b.batteryKwh * 0.8, dose: 0, dust: 0, tau: 0.5, stormHoursLeft: 0, speHoursLeft: 0, recyclerDownHours: 0,
    coldHours: 0, hungryDays: 0, solarKw: 0, reactorKw: 0, loadKw: 0, shed: [], sunElev: 0, status: "running", reason: "",
    scienceHours: 0, log: [{ day: 0, text: `Aterrizaje en ${SITES[b.site].name}. ${SITES[b.site].blurb}`, kind: "info" }], history: [],
  };
}

/** Deterministic RNG (mulberry32) so a seed replays the same events. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sun elevation proxy (sine) for the site at a given hour. */
export function sunAt(site: Site, hour: number): number {
  const phase = (hour % site.dayHours) / site.dayHours;
  if (site.id === "moon-pole") return phase < site.sunlitFraction ? 0.03 : -0.05; // sun skims the horizon
  return Math.sin(2 * Math.PI * phase); // >0 day, <0 night
}

/** Solar panel output (kW). Polar panels are vertical and track the low Sun. */
export function solarKw(site: Site, b: Build, s: Pick<SimState, "dust" | "tau">, sun: number): number {
  if (sun <= 0) return 0;
  const eff = 0.3;
  const geom = site.id === "moon-pole" ? 1 : sun;
  const atm = site.body === "mars" ? Math.exp(-0.6 * s.tau) : 1;
  return (site.peakFlux * geom * atm * (1 - s.dust) * b.solarM2 * eff) / 1000;
}

/** Shielding: GCR is hard to stop (slow decline), solar particles are stopped well by regolith. */
export const gcrFactor = (cm: number) => 0.7 * (0.45 + 0.55 * Math.exp(-cm / 60));
export const speFactor = (cm: number) => 0.7 * Math.exp(-cm / 12);

/** Advance the simulation by one hour. Mutates and returns the state. */
export function step(b: Build, s: SimState, rand: () => number): SimState {
  if (s.status !== "running") return s;
  const site = SITES[b.site];
  const day = Math.floor(s.hour / 24);
  const log = (text: string, kind: Event["kind"] = "info") => s.log.unshift({ day, text, kind });
  const habitats = Math.ceil(b.crew / 2);

  // ---------------- random events (per hour probabilities)
  if (s.speHoursLeft <= 0 && rand() < 1 / (24 * 120)) {
    s.speHoursLeft = 18;
    log("Tormenta solar (evento de partículas): la tripulación se refugia bajo el regolito.", "warn");
  }
  if (site.body === "mars" && s.stormHoursLeft <= 0 && rand() < 1 / (24 * 200)) {
    s.stormHoursLeft = 24 * (20 + Math.floor(rand() * 40));
    log("Tormenta de polvo regional: el cielo se oscurece por semanas.", "warn");
  }
  if (b.recycler && s.recyclerDownHours <= 0 && rand() < 1 / (24 * 90)) {
    s.recyclerDownHours = 24 * (2 + Math.floor(rand() * 4));
    log("Falla del reciclador de agua: reparación en curso.", "warn");
  }
  if (site.body === "mars" && s.dust > 0.15 && rand() < 1 / (24 * 60)) {
    s.dust *= 0.4;
    log("Un remolino de viento limpió los paneles solares.", "ok");
  }

  // ---------------- environment
  if (site.body === "mars") {
    s.tau = s.stormHoursLeft > 0 ? 3.5 : 0.5;
    s.dust = Math.min(0.6, s.dust + 0.002 / 24.66); // ~0.2 %/sol, like the MER rovers
    if (s.stormHoursLeft > 0 && --s.stormHoursLeft === 0) log("Terminó la tormenta de polvo.", "ok");
  }
  const sun = sunAt(site, s.hour);
  s.sunElev = sun;

  // ---------------- energy
  const solar = solarKw(site, b, s, sun);
  const reactor = b.reactors * REACTOR_KW;
  const loads: [string, number][] = [
    ["soporte vital", BASE_LOAD_KW + b.crew * PER_CREW.powerKw + (sun <= 0 ? site.nightHeatKw * habitats : 0)],
    ["reciclador", b.recycler && s.recyclerDownHours <= 0 ? 1 : 0],
    ["electrólisis", b.electrolysisKgDay > 0 ? (b.electrolysisKgDay * 6) / 24 : 0], // ~6 kWh per kg O2
    ["minería de hielo", site.ice ? (b.iceKgDay * 3) / 24 : 0], // ~3 kWh per kg water (heat + capture)
    ["ISRU CO₂", site.isruCo2 ? (b.isruKgDay * 25) / 24 : 0], // ~25 kWh per kg O2 (scaled-up MOXIE)
    ["invernadero", b.greenhouseM2 * 0.2], // LED lighting & climate, kW/m²
  ];
  // shed loads from the least critical (end of list) when energy runs out
  let available = solar + reactor + s.battery;
  const on = new Set<string>();
  let used = 0;
  for (const [name, kw] of loads) {
    if (kw <= 0) continue;
    if (available - used >= kw) { used += kw; on.add(name); }
  }
  s.shed = loads.filter(([n, kw]) => kw > 0 && !on.has(n)).map(([n]) => n);
  const net = solar + reactor - used;
  s.battery = Math.min(b.batteryKwh, Math.max(0, s.battery + net));
  s.solarKw = solar; s.reactorKw = reactor; s.loadKw = used;

  // ---------------- life support flows (per hour)
  const h = 1 / 24;
  s.o2 -= b.crew * PER_CREW.o2 * h;
  s.water -= b.crew * PER_CREW.water * h;
  s.food -= b.crew * PER_CREW.food * h;
  if (on.has("reciclador")) s.water += b.crew * PER_CREW.water * h * 0.98; // ISS-class recovery (~98 %)
  if (on.has("minería de hielo")) s.water += b.iceKgDay * h;
  if (on.has("electrólisis")) {
    const o2 = Math.min(b.electrolysisKgDay * h, Math.max(0, s.water) / 1.125);
    s.o2 += o2; s.water -= o2 * 1.125; // 1.125 kg water per kg O2
  }
  if (on.has("ISRU CO₂")) s.o2 += b.isruKgDay * h;
  if (on.has("invernadero")) s.food += b.greenhouseM2 * 0.04 * h; // ~40 g edible food per m² per day

  // ---------------- radiation
  s.dose += site.doseGcr * gcrFactor(b.shieldingCm) * h;
  if (s.speHoursLeft > 0) { s.dose += (60 / 18) * speFactor(b.shieldingCm); s.speHoursLeft--; }
  if (s.recyclerDownHours > 0 && --s.recyclerDownHours === 0) log("Reciclador reparado.", "ok");

  // ---------------- failures & bookkeeping
  s.coldHours = on.has("soporte vital") ? 0 : s.coldHours + 1;
  if (s.shed.length && s.hour % 24 === 0) log(`Energía insuficiente: apagado ${s.shed.join(", ")}.`, "warn");
  const lose = (reason: string) => { s.status = "lost"; s.reason = reason; log(`${reason}`, "bad"); };
  if (s.o2 <= 0) lose("Se acabó el oxígeno.");
  else if (s.water <= 0) lose("Se acabó el agua.");
  else if (s.coldHours >= 12) lose("Sin energía para soporte vital: el hábitat se congeló.");
  else if (s.dose >= CAREER_LIMIT_MSV) lose(`La tripulación alcanzó el límite de radiación de carrera (${CAREER_LIMIT_MSV} mSv).`);
  if (s.food <= 0) {
    s.food = 0;
    if (s.hour % 24 === 0 && ++s.hungryDays >= 10) lose("Diez días sin comida.");
  } else s.hungryDays = 0;

  if (on.has("soporte vital") && !s.shed.length) s.scienceHours += b.crew * 6 / 24; // ~6 h/day of science per astronaut
  s.hour++;
  if (s.hour % 24 === 0) {
    s.history.push({ day: s.hour / 24, o2: s.o2, water: s.water, food: s.food, battery: s.battery, dose: s.dose });
    if (s.history.length > 400) s.history.shift();
  }
  if (s.status === "running" && s.hour >= b.missionDays * 24) {
    s.status = "won";
    s.reason = `¡Misión cumplida! ${b.missionDays} días en ${SITES[b.site].name}.`;
    log(`${s.reason}`, "ok");
  }
  return s;
}

/** Run a whole mission headless (used by tests and by the "simulate" preview). */
export function runMission(b: Build, maxDays = b.missionDays): SimState {
  const s = initState(b), r = rng(b.seed);
  for (let i = 0; i < maxDays * 24 && s.status === "running"; i++) step(b, s, r);
  return s;
}
