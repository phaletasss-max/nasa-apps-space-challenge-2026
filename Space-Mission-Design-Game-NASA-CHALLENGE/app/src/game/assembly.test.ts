import { describe, expect, it } from "vitest";
import { DEFAULT_VEHICLE } from "./catalog";
import { planAssembly, projectCompletion, stepDay } from "./assembly";
import { rngFrom } from "./rng";

const START = Date.UTC(2026, 9, 14);
const days = (ms: number) => (ms - START) / 864e5;

describe("assembly schedule", () => {
  it("builds a dependency graph ending with roll-out", () => {
    const a = planAssembly(DEFAULT_VEHICLE, START);
    expect(a.tasks.at(-1)!.id).toBe("rollout");
    expect(a.tasks.find((t) => t.id === "stack")!.deps.length).toBe(DEFAULT_VEHICLE.stages.length);
  });
  it("is limited by the long payload build (~10–20 months for a science orbiter)", () => {
    const d = days(projectCompletion(planAssembly(DEFAULT_VEHICLE, START, 3)));
    expect(d).toBeGreaterThan(280); // spare teams double up on the critical payload build
    expect(d).toBeLessThan(600);
  });
  it("more engineering teams finish sooner (diminishing returns)", () => {
    const d1 = days(projectCompletion(planAssembly(DEFAULT_VEHICLE, START, 1)));
    const d3 = days(projectCompletion(planAssembly(DEFAULT_VEHICLE, START, 3)));
    const d8 = days(projectCompletion(planAssembly(DEFAULT_VEHICLE, START, 8)));
    expect(d3).toBeLessThan(d1);
    expect(d8).toBeLessThan(d3);
    expect(d3 / d8).toBeLessThan(d1 / d3 + 1);
  });
  it("a random run completes, costs money and logs events", () => {
    const a = planAssembly(DEFAULT_VEHICLE, START, 4);
    const r = rngFrom(11);
    for (let i = 0; i < 3000 && !a.complete; i++) stepDay(a, r);
    expect(a.complete).toBe(true);
    expect(a.spent).toBeGreaterThan(300);
    expect(a.log.length).toBeGreaterThan(10);
  });
});
