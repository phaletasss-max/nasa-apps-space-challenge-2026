import { describe, expect, it } from "vitest";
import { AU } from "../physics/constants";
import { planetPosition } from "../physics/orbits";
import { ASTEROIDS, asteroidPosition, avoidDv, diameterFromH, predictEncounters } from "./hazards";

const OCT14 = Date.UTC(2026, 9, 14);
// JPL Horizons heliocentric ecliptic J2000 vectors (AU), 2026-10-14 00:00 TDB
const HORIZONS: Record<string, [number, number, number]> = {
  "1 Ceres": [0.1444032491176219, 2.658925491604962, 0.05757355138652854],
  "4 Vesta": [2.305379996032443, 0.8275773047876033, -0.3052882805073761],
  "433 Eros": [0.07632564224267613, -1.702415039196127, -0.1712869864670205],
};

describe("asteroid catalogue", () => {
  it("loads thousands of real objects", () => {
    expect(ASTEROIDS.length).toBeGreaterThan(5000);
    expect(ASTEROIDS.some((a) => a.neo)).toBe(true);
  });
  it("two-body propagation matches JPL Horizons within 0.002 au", () => {
    for (const [prefix, ref] of Object.entries(HORIZONS)) {
      const a = ASTEROIDS.find((x) => x.name.startsWith(prefix + " "))!;
      expect(a, prefix).toBeDefined();
      const p = asteroidPosition(a, OCT14).map((v) => v / AU);
      expect(Math.hypot(p[0] - ref[0], p[1] - ref[1], p[2] - ref[2]), prefix).toBeLessThan(0.002);
    }
  });
  it("estimates size from absolute magnitude (H=15 ≈ 3.6 km at 14 % albedo)", () => {
    expect(diameterFromH(15)).toBeCloseTo(3.55, 1);
  });
});

describe("encounters", () => {
  it("a trajectory that sits on Ceres reports a near-zero miss distance", () => {
    const ceres = ASTEROIDS.find((x) => x.name.startsWith("1 Ceres "))!;
    const enc = predictEncounters((t) => asteroidPosition(ceres, t), OCT14, OCT14 + 100 * 864e5, OCT14);
    expect(enc[0].asteroid.name).toMatch(/Ceres/);
    expect(enc[0].missKm).toBeLessThan(1);
    expect(enc[0].level).toBe("alert");
  });
  it("an Earth-like path at 1 au never meets main-belt asteroids", () => {
    const enc = predictEncounters((t) => planetPosition("earth", t), OCT14, OCT14 + 200 * 864e5, OCT14);
    expect(enc.every((e) => e.asteroid.neo || e.asteroid.a < 1.8)).toBe(true);
  });
  it("earlier corrections are cheaper (Δv ∝ 1/lead time)", () => {
    expect(avoidDv(1e9, 100 * 86400)).toBeCloseTo(115.7, 0);
    expect(avoidDv(1e9, 10 * 86400)).toBeGreaterThan(avoidDv(1e9, 100 * 86400) * 9.9);
  });
});
