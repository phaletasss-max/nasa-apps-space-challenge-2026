import { describe, expect, it } from "vitest";
import { DEFAULT_VEHICLE, type Vehicle } from "./catalog";
import { simulateAscent } from "./ascent";

const SLS: Vehicle = { name: "SLS-like", boosters: { id: "srb-l", count: 2 }, stages: [{ engine: "h2", count: 4, propT: 987 }, { engine: "rl", count: 1, propT: 28 }], payload: "capsule" };

describe("ascent", () => {
  it("Falcon 9-class reaches orbit with propellant to spare for the departure burn", () => {
    const s = simulateAscent(DEFAULT_VEHICLE);
    expect(s.phase, s.result + " | " + s.events.map((e) => e.text).join(" / ")).toBe("orbit");
    expect(s.dvLeft).toBeGreaterThan(2500);
    expect(s.maxQ / 1000).toBeGreaterThan(15);
    expect(s.maxQ / 1000).toBeLessThan(60);
    expect(s.events.some((e) => /Max-Q/.test(e.text))).toBe(true);
  });
  it("cannot lift a 26.5 t capsule to orbit", () => {
    const s = simulateAscent({ ...DEFAULT_VEHICLE, payload: "capsule" });
    expect(s.phase).toBe("failed");
  });
  it("SLS-class reaches orbit with boosters separating first", () => {
    const s = simulateAscent(SLS);
    expect(s.phase, s.result + " | " + s.events.map((e) => e.text).join(" / ")).toBe("orbit");
    expect(s.events.findIndex((e) => /boosters/.test(e.text))).toBeGreaterThan(0);
  });
});
