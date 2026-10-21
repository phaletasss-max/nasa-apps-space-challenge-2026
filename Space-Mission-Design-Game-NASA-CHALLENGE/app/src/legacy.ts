/**
 * The free-play simulators (solar-system explorer with worlds and landings; Earth-orbit flight school),
 * driven by the original vanilla panels. Opened from the main menu.
 */
import { engine } from "./engine";
import { DEFAULT_DESIGN, type Design } from "./mission";
import type { LandingBody } from "./physics/landing";
import { renderMissionPanels, renderSolarTimebar } from "./ui/mission-panel";
import { bindOrbitKeys, renderOrbitPanels, renderOrbitTimebar } from "./ui/orbit-panel";
import { renderLandingHud, renderWorldHud, updatePlanetCard } from "./ui/worlds-ui";

const $ = (id: string) => document.getElementById(id)!;
const left = $("left"), right = $("right"), timebar = $("timebar"), card = $("card"), hud = $("hud"), pickHint = $("pick-hint");
type Sub = "solar" | "orbit" | "world" | "landing";

let open = false;
let sub: Sub = "solar";
let design: Design = { ...DEFAULT_DESIGN };
let landingHudUpdate: (() => void) | null = null;
let unhook: (() => void) | null = null;
let uiTimer = 0;
const { solar, orbit, world, landing } = engine;

bindOrbitKeys(orbit, () => open && sub === "orbit");

function setDesign(d: Design) { design = d; solar.setDesign(d); }

function hideAll() {
  left.hidden = right.hidden = timebar.hidden = card.hidden = pickHint.hidden = true;
  hud.replaceChildren();
  landingHudUpdate = null;
}

function go(mode: Sub) {
  sub = mode;
  engine.show(mode);
  hideAll();
  const panels = mode === "solar" || mode === "orbit";
  left.hidden = right.hidden = timebar.hidden = !panels;
  if (mode === "solar") {
    renderMissionPanels(left, right, solar, design, setDesign);
    renderSolarTimebar(timebar, solar);
    pickHint.hidden = !!solar.selected;
  } else if (mode === "orbit") {
    renderOrbitPanels(left, right, orbit);
    renderOrbitTimebar(timebar, orbit);
  } else if (mode === "world") {
    renderWorldHud(hud, world, (b) => land(b), () => go("solar"));
  } else {
    landingHudUpdate = renderLandingHud(hud, landing, { back: () => go("world"), retry: () => landing.start(landing.body), base: null });
  }
  listeners.forEach((f) => f(sub));
}

function enter(id: string) {
  world.setWorld(id, solar.date, solar.positionOf("sun").sub(solar.positionOf(id)));
  go("world");
}

function land(body: LandingBody) {
  landing.start(body);
  go("landing");
}

const listeners = new Set<(s: Sub) => void>();
export const sandbox = {
  get sub() { return sub; },
  onChange(f: (s: Sub) => void) { listeners.add(f); return () => { listeners.delete(f); }; },
  open(mode: "solar" | "orbit") {
    if (!open) {
      open = true;
      solar.setExternal(false);
      solar.date = Date.now();
      solar.rate = 86400;
      solar.playing = true;
      solar.controls.autoRotate = false;
      setDesign(design);
      unhook = engine.onFrame((dt) => {
        uiTimer += dt;
        if (uiTimer < 0.1) return;
        uiTimer = 0;
        if (sub === "solar") { updatePlanetCard(card, solar, enter); if (solar.selected) pickHint.hidden = true; }
        landingHudUpdate?.();
      });
    }
    go(mode);
  },
  close() {
    if (!open) return;
    open = false;
    unhook?.();
    hideAll();
    solar.reset();
    solar.select(null);
  },
};
