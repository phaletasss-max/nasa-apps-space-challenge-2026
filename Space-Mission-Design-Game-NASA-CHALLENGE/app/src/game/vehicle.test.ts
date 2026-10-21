import { describe, expect, it } from "vitest";
import { DEFAULT_VEHICLE, type Vehicle } from "./catalog";
import { DV_TO_LEO, performance, readiness } from "./vehicle";

const MARS = { dvDeparture: 3600, dvArrival: 1100, crew: 0, label: "Marte" };
const TLI = { dvDeparture: 3150, dvArrival: 900, crew: 4, label: "la Luna" };

// Falcon 9-class: 9 × Merlin-class + 1 × MVac-class, ~411 t + ~108 t of propellant
const F9: Vehicle = DEFAULT_VEHICLE;
// SLS Block 1-class: two 5-segment SRBs, core with 4 × RS-25-class (~987 t), ICPS with 1 × RL10-class (~28 t)
const SLS: Vehicle = { name: "SLS-like", boosters: { id: "srb-l", count: 2 }, stages: [{ engine: "h2", count: 4, propT: 987 }, { engine: "rl", count: 1, propT: 28 }], payload: "capsule" };

describe("vehicle performance", () => {
  it("Falcon 9-class: liftoff mass ~550 t and T/W ~1.4", () => {
    const p = performance(F9);
    expect(p.liftoffMass / 1000).toBeGreaterThan(520);
    expect(p.liftoffMass / 1000).toBeLessThan(600);
    expect(p.liftoffTwr).toBeGreaterThan(1.2);
    expect(p.liftoffTwr).toBeLessThan(1.6);
  });
  it("Falcon 9-class can send a 2.8 t orbiter to Mars", () => {
    const p = performance(F9);
    const r = readiness(p, F9, MARS);
    expect(r.dvMarginLaunch, r.issues.join(" ")).toBeGreaterThan(0);
  });
  it("…but cannot put a 26.5 t crew capsule in orbit", () => {
    const v = { ...F9, payload: "capsule" };
    expect(performance(v).dvLaunch).toBeLessThan(DV_TO_LEO);
  });
  it("SLS-class sends the crew capsule to the Moon (Artemis-like)", () => {
    const p = performance(SLS);
    const r = readiness(p, SLS, TLI);
    expect(r.ok, r.issues.join(" ")).toBe(true);
    expect(p.liftoffMass / 1e6).toBeGreaterThan(2.3); // ~2 600 t real
    expect(p.liftoffMass / 1e6).toBeLessThan(2.9);
  });
});
