/**
 * Rendering engine shared by the campaign UI (React) and the original sandboxes: one WebGL renderer,
 * one CSS2D label layer, and a set of scenes ("modes") of which exactly one is active.
 */
import * as THREE from "three";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { SolarMode } from "./scenes/solar";
import { OrbitMode } from "./scenes/orbit";
import { WorldMode } from "./scenes/world";
import { LandingMode } from "./scenes/landing";
import { VabMode } from "./scenes/vab";
import { LaunchMode } from "./scenes/launch";
import { bindLanderKeys } from "./ui/worlds-ui";
import type { Mode } from "./scenes/common";

export type ModeId = "solar" | "orbit" | "world" | "landing" | "vab" | "launch";

const canvas = document.getElementById("gl") as HTMLCanvasElement;
const labelsEl = document.getElementById("labels")!;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;
const css = new CSS2DRenderer({ element: labelsEl });

const solar = new SolarMode(canvas);
const orbit = new OrbitMode(canvas);
const world = new WorldMode(canvas);
const landing = new LandingMode(canvas);
const vab = new VabMode(canvas);
const launch = new LaunchMode(canvas);
const modes: Record<ModeId, Mode> = { solar, orbit, world, landing, vab, launch };

let active: ModeId = "solar";
const hooks = new Set<(dt: number) => void>();
const landerKeys = bindLanderKeys(landing, () => active === "landing");

export const engine = {
  solar, orbit, world, landing, vab, launch, labelsEl,
  get active() { return active; },
  show(mode: ModeId) {
    if (mode === active) return;
    active = mode;
    (Object.keys(modes) as ModeId[]).forEach((m) => modes[m].setActive(m === mode));
    labelsEl.replaceChildren(); // CSS2D labels belong to one scene at a time
  },
  /** Run fn every frame (returns an unsubscribe function). */
  onFrame(fn: (dt: number) => void) { hooks.add(fn); return () => { hooks.delete(fn); }; },
  frame(dt: number) {
    const m = modes[active];
    if (active === "landing") landerKeys(dt);
    hooks.forEach((h) => h(dt));
    m.update(dt);
    renderer.render(m.scene, m.camera);
    css.render(m.scene, m.camera);
  },
};

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  css.setSize(w, h);
  Object.values(modes).forEach((m) => m.resize(w, h));
}
window.addEventListener("resize", resize);
resize();
Object.values(modes).forEach((m, i) => m.setActive(i === 0));

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => engine.frame(Math.min(clock.getDelta(), 0.1)));
// console debugging only: drive the app frame by frame even when the tab is hidden
if (import.meta.env.DEV) Object.assign(window, { __engine: engine, __frame: (dt: number) => engine.frame(dt) });
