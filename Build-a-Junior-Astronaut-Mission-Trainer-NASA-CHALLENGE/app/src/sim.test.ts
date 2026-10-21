import { describe, expect, it } from "vitest";
import { DEFAULT_BUILD, gcrFactor, launchMass, runMission, SITES, solarKw, speFactor, sunAt, type Build } from "./sim";

describe("environment", () => {
  it("lunar equator: ~14 days of sun then ~14 days of night", () => {
    const site = SITES["moon-eq"];
    expect(sunAt(site, 24 * 7)).toBeGreaterThan(0);
    expect(sunAt(site, 24 * 21)).toBeLessThan(0);
  });
  it("Mars dust storm cuts solar power by more than 80 %", () => {
    const site = SITES.mars, b = { ...DEFAULT_BUILD, site: "mars" as const };
    const clear = solarKw(site, b, { dust: 0, tau: 0.5 }, 1);
    const storm = solarKw(site, b, { dust: 0, tau: 3.5 }, 1);
    expect(storm / clear).toBeLessThan(0.2);
  });
  it("regolith stops solar particles far better than cosmic rays", () => {
    expect(speFactor(50) / speFactor(0)).toBeLessThan(0.05);
    expect(gcrFactor(50) / gcrFactor(0)).toBeGreaterThan(0.6);
  });
});

describe("missions", () => {
  it("the default south-pole base completes its 180-day mission", () => {
    const s = runMission(DEFAULT_BUILD);
    expect(s.status, s.reason).toBe("won");
    expect(launchMass(DEFAULT_BUILD).total).toBeLessThanOrEqual(DEFAULT_BUILD.massLimit);
  });

  const equator: Build = { ...DEFAULT_BUILD, site: "moon-eq", iceKgDay: 0, reactors: 0, batteryKwh: 300 };
  it("solar-only base at the lunar equator freezes during the 14-day night", () => {
    const s = runMission(equator);
    expect(s.status).toBe("lost");
    expect(s.reason).toMatch(/congeló/);
    expect(s.hour / 24).toBeLessThan(30);
  });
  it("…but survives the night with a fission reactor", () => {
    const s = runMission({ ...equator, reactors: 2, supplyDays: 120 });
    expect(s.reason).not.toMatch(/congeló/);
  });

  it("is deterministic for a given seed", () => {
    const a = runMission({ ...DEFAULT_BUILD, site: "mars", isruKgDay: 4, iceKgDay: 0, reactors: 1 });
    const b = runMission({ ...DEFAULT_BUILD, site: "mars", isruKgDay: 4, iceKgDay: 0, reactors: 1 });
    expect(a.log.map((e) => e.text)).toEqual(b.log.map((e) => e.text));
  });
});
