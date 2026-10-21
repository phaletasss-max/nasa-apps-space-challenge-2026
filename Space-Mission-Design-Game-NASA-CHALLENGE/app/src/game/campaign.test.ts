import { describe, expect, it } from "vitest";
import * as R from "./campaign";
import { crewReady, initShip, shipDay } from "./crewcare";
import { generateCandidates } from "./crew";
import { rngFrom } from "./rng";

const DAY = 86400000;
const T0 = Date.UTC(2026, 9, 14);
const fresh = () => R.createCampaign("Prueba", 12345, T0);

/** Skip production: mark the vehicle built and on the pad. */
function onPad(c: R.Campaign) { c.mission!.phase = "ready"; }

describe("crew condition model", () => {
  it("accumulates deep-space dose like MSL/RAD and keeps a trained crew healthy", () => {
    const crew = generateCandidates(7).slice(0, 4);
    const s = initShip(crew);
    const r = rngFrom(3);
    for (let d = 0; d < 180; d++) shipDay(s, crew, r, true);
    expect(s.crew[0].doseMsv).toBeCloseTo(324, 0); // 1.8 mSv/day × 180 days
    expect(Math.min(...s.crew.map((c) => c.health))).toBeGreaterThan(45);
    expect(s.science).toBeGreaterThan(50);
    expect(crewReady(s).ok).toBe(true);
  });
  it("blocks a landing when a crew member is too ill", () => {
    const crew = generateCandidates(7).slice(0, 2);
    const s = initShip(crew);
    s.crew[1].health = 30;
    expect(crewReady(s).ok).toBe(false);
  });
});

describe("crewed lunar landing, end to end", () => {
  it("lands, works on the surface, returns and re-enters", () => {
    const c = fresh();
    c.reputation = 100;
    expect(R.acceptContract(c, "crew-landing").screen).toBe("vehicle");
    expect(c.mission!.vehicle.payload).toBe("crew-lander");
    const crewIds = c.candidates.slice(0, 4).map((a) => a.id);
    for (const id of crewIds) { R.hire(c, id); R.toggleCrew(c, id); }
    expect(c.mission!.crewIds.length).toBe(4);
    onPad(c);
    expect(R.depart(c, 3200, []).screen).toBe("ops");
    expect(c.mission!.ship!.crew.length).toBe(4);
    for (let i = 0; i < 10 && c.mission!.phase === "cruise"; i++) R.simulateDays(c, 1);
    expect(c.mission!.phase).toBe("arrived");
    const a = R.arrive(c);
    expect(a.screen).toBe("landing");
    expect(R.landed(c, true, "Contacto a 1.2 m/s.").screen).toBe("ops");
    expect(c.mission!.phase).toBe("surface");
    for (let i = 0; i < 10 && c.mission!.phase === "surface"; i++) R.simulateDays(c, 1);
    expect(c.mission!.phase).toBe("return");
    for (let i = 0; i < 10 && c.mission!.phase === "return"; i++) R.simulateDays(c, 1);
    expect(c.mission!.phase).toBe("reentry");
    const before = c.budget;
    expect(R.reenter(c).screen).toBe("debrief");
    expect(c.mission!.result!.success).toBe(true);
    expect(c.budget - before).toBeCloseTo(5200, 0);
    for (const id of crewIds) expect(c.candidates.find((x) => x.id === id)!.flights).toBeGreaterThan(0);
  });

  it("a failed crewed landing loses the crew and costs heavy reputation", () => {
    const c = fresh();
    c.reputation = 100;
    R.acceptContract(c, "crew-landing");
    const ids = c.candidates.slice(0, 4).map((a) => a.id);
    c.mission!.vehicle.payload = "crew-lander";
    for (const id of ids) { R.hire(c, id); R.toggleCrew(c, id); }
    onPad(c);
    R.depart(c, 3200, []);
    for (let i = 0; i < 10 && c.mission!.phase === "cruise"; i++) R.simulateDays(c, 1);
    R.arrive(c);
    R.landed(c, false, "Impacto a 9 m/s.");
    expect(c.mission!.result!.crewLost).toBe(true);
    expect(c.reputation).toBe(75);
    expect(c.candidates.filter((a) => a.lost).length).toBe(4);
  });
});

describe("finances", () => {
  it("refuses to freeze a design the agency cannot pay even with credit", () => {
    const c = fresh();
    R.acceptContract(c, "lunar-orbiter");
    c.budget = -250;
    const eff = R.startBuild(c);
    expect(eff.error).toMatch(/hardware/);
    expect(c.mission!.phase).toBe("design");
  });
  it("goes bankrupt when debt exceeds the credit line", () => {
    const c = fresh();
    c.budget = -R.CREDIT_LINE + 1;
    c.teams = 10;
    const eff = R.simulateDays(c, 30);
    expect(c.over).toBeDefined();
    expect(eff.pause).toBe(true);
  });
  it("charges interest on a negative balance", () => {
    const c = fresh();
    c.budget = -100; c.teams = 0;
    R.simulateDays(c, 365);
    expect(c.budget).toBeLessThan(-105);
  });
});

describe("design library", () => {
  it("keeps one entry per name, newest first", () => {
    const c = fresh();
    R.acceptContract(c, "lunar-orbiter");
    const v = c.mission!.vehicle;
    R.saveDesign(c, v);
    R.saveDesign(c, { ...v, name: "Otro" });
    R.saveDesign(c, v);
    expect(c.designs.map((d) => d.name)).toEqual([v.name, "Otro"]);
    R.deleteDesign(c, "Otro");
    expect(c.designs.length).toBe(1);
  });
});

describe("save migration", () => {
  it("fills fields missing in old saves", () => {
    const old = fresh() as Partial<R.Campaign>;
    delete old.designs;
    const c = R.migrate(old as R.Campaign);
    expect(c.designs).toEqual([]);
  });
});

it("window rollover keeps the mission alive", () => {
  const c = fresh();
  R.acceptContract(c, "mars-orbiter");
  const w = c.mission!.window!;
  R.simulateDays(c, Math.ceil((w - c.date) / DAY) + 40);
  for (let i = 0; i < 5 && c.mission!.window === w; i++) R.simulateDays(c, 10);
  expect(c.mission!.window).toBeGreaterThan(w + 600 * DAY);
});
