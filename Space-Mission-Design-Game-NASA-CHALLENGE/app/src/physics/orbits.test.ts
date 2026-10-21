import { describe, expect, it } from "vitest";
import { AU, DAY, PLANETS } from "./constants";
import {
  burn, circularState, dvFromParking, elementsOf, hohmann, nextWindow, norm, phaseAngle, planetPosition,
  propellantFor, rk4, rocketDv, semiMajorAxis, solarPower, solveKepler, type State,
} from "./orbits";

const OCT13 = Date.UTC(2026, 9, 13);

// JPL Horizons, heliocentric ecliptic J2000 vectors (AU) for 2026-10-13 00:00 TDB.
const HORIZONS: Record<string, [number, number, number]> = {
  earth: [9.418302506458947e-1, 3.299069580952288e-1, -2.299180860138469e-5],
  mars: [-3.41519587686747e-2, 1.572054281994216, 3.378190644810731e-2],
  jupiter: [-3.559263203829718, 3.941139664198542, 6.326221744259986e-2],
};

describe("planet positions", () => {
  it("solves Kepler's equation", () => {
    for (const e of [0, 0.1, 0.5, 0.9]) {
      const E = solveKepler(1.234, e);
      expect(E - e * Math.sin(E)).toBeCloseTo(1.234, 10);
    }
  });

  it("matches JPL Horizons within 0.01 AU (approximate elements, 1800–2050)", () => {
    for (const [id, ref] of Object.entries(HORIZONS)) {
      const p = planetPosition(id, OCT13).map((x) => x / AU);
      const err = Math.hypot(p[0] - ref[0], p[1] - ref[1], p[2] - ref[2]);
      expect(err, id).toBeLessThan(0.01);
    }
  });
});

describe("Hohmann Earth → Mars (textbook values)", () => {
  const h = hohmann(semiMajorAxis("earth"), semiMajorAxis("mars"));
  it("heliocentric Δv ≈ 2.94 + 2.65 km/s, ~259 days, Mars ~44° ahead", () => {
    expect(h.dv1 / 1000).toBeCloseTo(2.94, 1);
    expect(h.dv2 / 1000).toBeCloseTo(2.65, 1);
    expect(h.tof / DAY).toBeGreaterThan(255);
    expect(h.tof / DAY).toBeLessThan(262);
    expect((h.phase * 180) / Math.PI).toBeCloseTo(44.3, 0);
  });
  it("departure from a 200 km LEO costs ≈ 3.6 km/s", () => {
    const dv = dvFromParking(h.dv1, PLANETS.earth.gm, PLANETS.earth.radius + 200e3);
    expect(dv / 1000).toBeCloseTo(3.6, 1);
  });
  it("finds the next launch window where the phase angle matches", () => {
    const t = nextWindow("earth", "mars", OCT13)!;
    expect(t).not.toBeNull();
    expect((phaseAngle("earth", "mars", t) * 180) / Math.PI).toBeCloseTo((h.phase * 180) / Math.PI, 0);
  });
});

describe("rocket and power", () => {
  it("Tsiolkovsky round-trips with propellantFor", () => {
    const prop = propellantFor(4000, 450, 1000);
    expect(rocketDv(450, 1000 + prop, 1000)).toBeCloseTo(4000, 6);
  });
  it("solar power falls with 1/d² (Mars ≈ 43% of Earth)", () => {
    expect(solarPower(1.524 * AU, 1, 1) / solarPower(AU, 1, 1)).toBeCloseTo(0.43, 2);
  });
});

describe("two-body sandbox (RK4)", () => {
  const gm = PLANETS.earth.gm;
  const r0 = PLANETS.earth.radius + 400e3;
  it("keeps a circular orbit circular and conserves energy over one period", () => {
    let s: State = circularState(gm, r0);
    const e0 = elementsOf(s, gm);
    const steps = 2000, dt = e0.period / steps;
    for (let i = 0; i < steps; i++) s = rk4(s, dt, gm);
    const e1 = elementsOf(s, gm);
    expect(Math.abs(e1.energy - e0.energy) / Math.abs(e0.energy)).toBeLessThan(1e-8);
    expect(norm(s.r)).toBeCloseTo(r0, -1);
  });
  it("a prograde burn raises apoapsis; retrograde lowers periapsis", () => {
    const s = circularState(gm, r0);
    const up = elementsOf(burn(s, 100, 0), gm);
    expect(up.ra).toBeGreaterThan(r0 + 300e3);
    expect(up.rp).toBeCloseTo(r0, -2);
    const down = elementsOf(burn(s, -100, 0), gm);
    expect(down.rp).toBeLessThan(r0 - 300e3);
  });
});
