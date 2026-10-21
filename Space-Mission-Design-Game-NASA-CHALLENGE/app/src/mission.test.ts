import { describe, expect, it } from "vitest";
import { captureDv, DEFAULT_DESIGN, evaluate } from "./mission";
import { PLANETS } from "./physics/constants";
import { hohmann, semiMajorAxis } from "./physics/orbits";

describe("capture Δv", () => {
  it("reproduces Juno's Jupiter orbit insertion (~0.54 km/s into a 53-day orbit)", () => {
    // Juno: perijove ≈ 1.06 RJ, apojove ≈ 112 RJ. Same formula as captureDv, with Juno's geometry.
    const { gm, radius } = PLANETS.jupiter;
    const vInf = hohmann(semiMajorAxis("earth"), semiMajorAxis("jupiter")).dv2;
    const rp = 1.06 * radius, a = (rp + 112 * radius) / 2;
    const dv = Math.sqrt(vInf ** 2 + (2 * gm) / rp) - Math.sqrt(gm * (2 / rp - 1 / a));
    expect(dv / 1000).toBeCloseTo(0.54, 1);
  });
  it("flyby is free; circular capture costs more than elliptical", () => {
    expect(captureDv("mars", 2650, "flyby")).toBe(0);
    expect(captureDv("mars", 2650, "circular")).toBeGreaterThan(captureDv("mars", 2650, "elliptical"));
  });
});

describe("budget", () => {
  it("the default Mars design is feasible", () => {
    const b = evaluate(DEFAULT_DESIGN);
    expect(b.feasible).toBe(true);
    expect(b.tofDays).toBeGreaterThan(250);
  });
  it("solar-only Saturn mission fails on power", () => {
    const b = evaluate({ ...DEFAULT_DESIGN, target: "saturn", capture: "flyby", launcher: "heavy", propellant: 9000 });
    expect(b.checks.find((c) => c.id === "power")!.ok).toBe(false);
    const withRtg = evaluate({ ...DEFAULT_DESIGN, target: "saturn", capture: "flyby", launcher: "heavy", propellant: 9000, rtg: 3 });
    expect(withRtg.checks.find((c) => c.id === "power")!.ok).toBe(true);
  });
});
