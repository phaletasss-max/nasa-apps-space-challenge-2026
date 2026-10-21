/**
 * UI state (zustand): which screen is open, the simulation speed, and the campaign object.
 * Every action clones the campaign, runs one pure rule from campaign.ts, applies the returned Effect
 * (pause / change screen) and saves to localStorage. All game rules live in campaign.ts.
 */
import { create } from "zustand";
import type { Vehicle } from "./catalog";
import * as R from "./campaign";
import type { Campaign, Effect, Pass } from "./campaign";

export type { Campaign, Mission, MissionPhase, Pass } from "./campaign";
export { contractOf, crewOf, flybyScience, fmtDay, programCost, unlocked, CREDIT_LINE, KEEP_OUT_KM, MAX_TEAMS } from "./campaign";

export type Screen = "menu" | "hub" | "contracts" | "vehicle" | "crew" | "launch" | "ops" | "landing" | "debrief" | "explore" | "orbit" | "credits";

const SAVE_KEY = "dv-mission-control-v1";

interface Store {
  screen: Screen;
  campaign: Campaign | null;
  speed: number; // simulated days per real second
  paused: boolean;
  error: string | null;
  go: (s: Screen) => void;
  newCampaign: (agency: string) => void;
  load: () => boolean;
  hasSave: () => boolean;
  save: () => void;
  setSpeed: (d: number) => void;
  setPaused: (p: boolean) => void;
  clearError: () => void;
  tick: (dtReal: number) => void;
  advanceDays: (n: number) => void;
  acceptContract: (id: string) => void;
  abandonMission: () => void;
  setVehicle: (v: Vehicle) => void;
  saveDesign: (v: Vehicle) => void;
  deleteDesign: (name: string) => void;
  startBuild: () => void;
  setTeams: (n: number) => void;
  hire: (id: string) => void;
  release: (id: string) => void;
  toggleCrew: (id: string) => void;
  scrub: (reason: string) => void;
  beginAscent: () => void;
  depart: (dvLeftUpper: number, events: string[]) => void;
  ascentFailed: (reason: string, events: string[]) => void;
  decide: (name: string, decision: Pass["decision"], dv: number) => void;
  addScience: (n: number) => void;
  arrive: () => void;
  landed: (ok: boolean, text: string) => void;
  reenter: () => void;
  finishMission: (success: boolean, title: string, lines: string[]) => void;
  closeMission: () => void;
}

let tickCarry = 0;

export const useGame = create<Store>((set, get) => {
  /** Clone → apply rule → store → follow the effect. */
  const run = (rule: (c: Campaign) => Effect | void, persist = true) => {
    const c = get().campaign;
    if (!c) return;
    const copy: Campaign = structuredClone(c);
    const eff = rule(copy) || {};
    set({ campaign: copy, ...(eff.pause ? { paused: true } : {}), ...(eff.screen ? { screen: eff.screen } : {}), ...(eff.error ? { error: eff.error } : {}) });
    if (persist) get().save();
  };

  return {
    screen: "menu", campaign: null, speed: 5, paused: true, error: null,
    go: (screen) => { set({ screen }); get().save(); },
    newCampaign: (agency) => {
      const now = new Date();
      const c = R.createCampaign(agency, Math.floor(Math.random() * 1e9), Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      tickCarry = 0;
      set({ campaign: c, screen: "hub", paused: true });
      get().save();
    },
    hasSave: () => { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } },
    load: () => {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        set({ campaign: R.migrate(JSON.parse(raw)), screen: "hub", paused: true });
        return true;
      } catch { return false; }
    },
    save: () => { const c = get().campaign; if (c) try { localStorage.setItem(SAVE_KEY, JSON.stringify(c)); } catch { /* storage unavailable */ } },
    setSpeed: (speed) => set({ speed, paused: false }),
    setPaused: (paused) => set({ paused }),
    clearError: () => set({ error: null }),

    tick: (dtReal) => {
      const { campaign, paused, speed } = get();
      if (!campaign || paused || campaign.over) return;
      tickCarry += speed * dtReal;
      const whole = Math.floor(tickCarry);
      tickCarry -= whole;
      if (whole > 0) run((c) => R.simulateDays(c, whole), campaign.day % 30 === 0);
    },
    // a calendar jump (e.g. "advance to the window"): the clock stays paused afterwards
    advanceDays: (n) => { run((c) => R.simulateDays(c, n)); set({ paused: true }); },

    acceptContract: (id) => run((c) => R.acceptContract(c, id)),
    abandonMission: () => run(R.abandonMission),
    setVehicle: (v) => run((c) => { if (c.mission?.phase === "design") c.mission.vehicle = v; }, false),
    saveDesign: (v) => run((c) => R.saveDesign(c, v)),
    deleteDesign: (name) => run((c) => R.deleteDesign(c, name)),
    startBuild: () => run(R.startBuild),
    setTeams: (n) => run((c) => { c.teams = Math.max(1, Math.min(R.MAX_TEAMS, n)); if (c.mission?.assembly) c.mission.assembly.teams = c.teams; }, false),
    hire: (id) => run((c) => R.hire(c, id)),
    release: (id) => run((c) => R.release(c, id)),
    toggleCrew: (id) => run((c) => R.toggleCrew(c, id)),
    scrub: (reason) => run((c) => R.scrub(c, reason)),
    beginAscent: () => run((c) => { if (c.mission) c.mission.phase = "ascent"; }),
    depart: (dv, events) => run((c) => R.depart(c, dv, events)),
    ascentFailed: (reason, events) => run((c) => {
      for (const e of events) c.news.unshift({ date: c.date, text: e, kind: "info" });
      const crewed = (R.contractOf(c)?.crew ?? 0) > 0;
      // crewed capsules carry a launch abort system: the crew is pulled away from the failing rocket
      return R.finishMission(c, false, "Falla durante el ascenso", crewed ? [reason, "La torre de escape separó la cápsula: la tripulación amerizó a salvo."] : [reason], false, crewed);
    }),
    decide: (name, decision, dv) => run((c) => R.decide(c, name, decision, dv)),
    addScience: (n) => run((c) => { if (c.mission) c.mission.science += n; }),
    arrive: () => run(R.arrive),
    landed: (ok, text) => run((c) => R.landed(c, ok, text)),
    reenter: () => run(R.reenter),
    finishMission: (success, title, lines) => run((c) => R.finishMission(c, success, title, lines)),
    closeMission: () => run(R.closeMission),
  };
});
