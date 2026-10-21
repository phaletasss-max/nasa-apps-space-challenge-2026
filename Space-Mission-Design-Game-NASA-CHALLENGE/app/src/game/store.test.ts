import { describe, expect, it } from "vitest";
import { useGame } from "./store";
import { simulateAscent } from "./ascent";
import { planTransfer, transferPosition } from "./trajectory";
import { planetPosition } from "../physics/orbits";
import { AU } from "../physics/constants";

const DAY = 86400000;

describe("trajectory", () => {
  it("Mars transfer starts at the Earth and ends at Mars", () => {
    const t = planTransfer("mars", Date.UTC(2026, 9, 14))!;
    expect(t.tofDays).toBeGreaterThan(250);
    expect(t.tofDays).toBeLessThan(270);
    const d0 = transferPosition(t, t.window), e = planetPosition("earth", t.window);
    const d1 = transferPosition(t, t.arrival), m = planetPosition("mars", t.arrival);
    expect(Math.hypot(d0[0] - e[0], d0[1] - e[1], d0[2] - e[2]) / AU).toBeLessThan(0.01);
    expect(Math.hypot(d1[0] - m[0], d1[1] - m[1], d1[2] - m[2]) / AU).toBeLessThan(0.01);
  });
});

describe("campaign", () => {
  it("flies a lunar orbiter contract end to end", () => {
    const g = useGame.getState;
    g().newCampaign("Agencia de prueba");
    useGame.setState((s) => ({ campaign: { ...s.campaign!, seed: 12345 } })); // deterministic random events
    g().acceptContract("lunar-orbiter");
    expect(g().campaign!.mission!.phase).toBe("design");
    g().startBuild();
    expect(g().campaign!.mission!.phase).toBe("building");
    for (let i = 0; i < 40 && g().campaign!.mission!.phase === "building"; i++) g().advanceDays(30);
    const m = g().campaign!.mission!;
    expect(m.phase).toBe("ready");
    expect(m.assembly!.spent).toBeGreaterThan(300);

    const ascent = simulateAscent(m.vehicle);
    expect(ascent.phase).toBe("orbit");
    g().beginAscent();
    g().depart(ascent.dvLeft, []);
    const c = g().campaign!;
    expect(c.mission!.phase).toBe("cruise");
    expect(c.mission!.transfer!.target).toBe("moon");
    expect(c.mission!.dvMargin).toBeGreaterThan(0);

    for (let i = 0; i < 10 && g().campaign!.mission!.phase === "cruise"; i++) g().advanceDays(1);
    expect(g().campaign!.mission!.phase).toBe("arrived");
    const before = g().campaign!.budget;
    g().arrive();
    const after = g().campaign!;
    expect(after.mission!.phase).toBe("complete");
    expect(after.budget - before).toBeCloseTo(650, 0);
    expect(after.reputation).toBeGreaterThan(20);
    g().closeMission();
    expect(g().campaign!.mission).toBeNull();
    expect(g().campaign!.history[0].success).toBe(true);
    expect(g().campaign!.date).toBeGreaterThan(Date.UTC(2026, 0, 1) + 100 * DAY);
  });

  it("predicts real asteroid encounters on a Jupiter cruise", () => {
    const g = useGame.getState;
    g().newCampaign("Agencia Júpiter");
    useGame.setState((s) => ({ campaign: { ...s.campaign!, reputation: 80 } }));
    g().acceptContract("jupiter-flyby");
    useGame.setState((s) => ({ campaign: { ...s.campaign!, mission: { ...s.campaign!.mission!, phase: "ascent" } } }));
    g().depart(7000, []);
    const m = g().campaign!.mission!;
    expect(m.phase).toBe("cruise");
    expect(m.passes.length).toBeGreaterThan(0); // the route crosses the main belt
    const p = m.passes[0];
    g().decide(p.name, "flyby", 0.5);
    expect(g().campaign!.mission!.passes[0].decision).toBe("flyby");
    expect(g().campaign!.mission!.dvSpent).toBeCloseTo(0.5);
  });
});
