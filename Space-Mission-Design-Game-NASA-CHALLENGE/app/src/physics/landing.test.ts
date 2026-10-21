import { describe, expect, it } from "vitest";
import { initLanding, simulate, stepLanding } from "./landing";

describe("Mars EDL (Perseverance-like)", () => {
  const s = simulate("mars");
  const ev = (re: RegExp) => s.events.find((e) => re.test(e.text));
  it("lands softly in about 7 minutes", () => {
    expect(s.phase, s.result).toBe("landed");
    expect(Math.abs(s.vz)).toBeLessThan(1.5);
    expect(s.t).toBeGreaterThan(330);
    expect(s.t).toBeLessThan(540);
  });
  it("deploys the parachute high and supersonic (~8–14 km)", () => {
    const chute = ev(/Paracaídas/)!;
    const km = Number(/a ([\d.]+) km/.exec(chute.text)![1]);
    expect(km).toBeGreaterThan(7);
    expect(km).toBeLessThan(14.5);
  });
  it("reaches entry heating of tens to ~200 W/cm² and >5 g", () => {
    expect(s.peakHeat).toBeGreaterThan(30);
    expect(s.peakHeat).toBeLessThan(250);
    expect(s.peakG).toBeGreaterThan(5);
  });
});

describe("Moon (Apollo-like LM)", () => {
  it("autopilot lands safely with fuel to spare", () => {
    const s = simulate("moon");
    expect(s.phase, s.result).toBe("landed");
    expect(s.fuel).toBeGreaterThan(0);
  });
  it("without thrust it crashes", () => {
    const s = initLanding("moon");
    while (s.phase === "descent") stepLanding(s, 0.05, { auto: false, throttle: 0, pitch: 0 });
    expect(s.phase).toBe("crashed");
  });
});

describe("Venus (Venera-like)", () => {
  it("reaches the surface in roughly an hour at a few m/s", () => {
    const s = simulate("venus");
    expect(s.phase, s.result).toBe("landed");
    expect(s.t / 60).toBeGreaterThan(35);
    expect(s.t / 60).toBeLessThan(100);
    expect(Math.abs(s.vz)).toBeLessThan(12);
  });
});
