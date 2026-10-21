import { describe, expect, it } from "vitest";
import { generateCandidates } from "./crew";
import { createHabitat, stepMinute } from "./interior";
import { rngFrom } from "./rng";

const crew = generateCandidates(3).slice(0, 4);

describe("crew generation", () => {
  it("creates distinct people with a strong primary skill per role", () => {
    const c = generateCandidates(5);
    expect(new Set(c.map((x) => x.name)).size).toBe(c.length);
    expect(c.find((x) => x.role === "doctor")!.skills.medicine).toBeGreaterThanOrEqual(7);
  });
});

describe("life on board (3 days)", () => {
  const h = createHabitat(crew);
  const r = rngFrom(1);
  for (let i = 0; i < 3 * 1440; i++) stepMinute(h, r);

  it("everyone sleeps ~7–9 h per day, eats 3 meals and exercises ~2.5 h", () => {
    for (const a of h.agents) {
      if (a.ill) continue;
      expect(a.stats.sleepMin / 3 / 60, a.name).toBeGreaterThan(6.5);
      expect(a.stats.meals, a.name).toBeGreaterThanOrEqual(8);
      expect(a.stats.exerciseMin / 3 / 60, a.name).toBeGreaterThan(1.8);
    }
  });
  it("needs stay in range and the lab produces science", () => {
    for (const a of h.agents) for (const v of Object.values(a.needs)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
    expect(h.science).toBeGreaterThan(1);
  });
  it("faults get repaired by the crew", () => {
    const h2 = createHabitat(crew, 9 * 60);
    h2.systems.water = 40;
    for (let i = 0; i < 1440; i++) stepMinute(h2, () => 0.99);
    expect(h2.systems.water).toBe(100);
    expect(h2.log.some((l) => /reparó/.test(l.text))).toBe(true);
  });
});
