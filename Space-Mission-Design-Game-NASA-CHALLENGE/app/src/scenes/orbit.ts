import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { G0, PLANETS } from "../physics/constants";
import { burn, circularState, elementsOf, rk4, type Elements, type State, type Vec3 } from "../physics/orbits";
import { glowSprite, label, line, setLine, starfield, type Mode } from "./common";

const R_E = PLANETS.earth.radius;
const GM = PLANETS.earth.gm;
const toScene = (r: Vec3) => new THREE.Vector3(r[0] / R_E, r[2] / R_E, -r[1] / R_E); // 1 unit = Earth radius
const GEO = 35786e3;

export interface Goal { id: string; text: string; done: boolean }

export interface Craft { dry: number; prop: number; isp: number }

export class OrbitMode implements Mode {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, 1, 0.01, 4000);
  controls: OrbitControls;
  state: State = circularState(GM, R_E + 400e3);
  craft: Craft = { dry: 1000, prop: 1500, isp: 320 };
  warp = 60; // simulated seconds per real second
  t = 0;
  status: "flying" | "crashed" | "reentry" | "escaped" = "flying";
  dvUsed = 0;
  goals: Goal[] = [
    { id: "gto", text: "Sube tu apoapsis por encima de 35 786 km (órbita de transferencia geoestacionaria)", done: false },
    { id: "geo", text: "Circulariza en órbita geoestacionaria (35 786 km ± 500 km, e < 0.01)", done: false },
    { id: "escape", text: "Escapa de la Tierra (energía orbital positiva)", done: false },
    { id: "reentry", text: "Haz una reentrada controlada (periapsis < 100 km)", done: false },
  ];
  private earth: THREE.Mesh;
  private ship: THREE.Group;
  private trail: THREE.Line;
  private trailPts: THREE.Vector3[] = [];
  private predicted: THREE.Line;
  private listeners: (() => void)[] = [];

  constructor(dom: HTMLElement) {
    this.camera.position.set(0, 3.5, 6);
    this.controls = new OrbitControls(this.camera, dom);
    this.controls.enableDamping = true;
    this.controls.minDistance = 1.3;
    this.controls.maxDistance = 120;
    this.controls.enabled = false;

    this.scene.add(starfield(3000, 1500));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(-8, 3, 5);
    this.scene.add(sun);

    const tex = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/earth_daymap.jpg`);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    this.scene.add(this.earth);
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.025, 64, 32),
      new THREE.MeshBasicMaterial({ color: "#4f8cff", transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, side: THREE.BackSide }));
    this.scene.add(atmo, glowSprite("rgba(79,140,255,0.35)", 2.9, 0));

    // reference rings: LEO 400 km and GEO
    const ring = (altM: number, color: string) => line(
      Array.from({ length: 181 }, (_, k) => { const a = (k / 180) * Math.PI * 2, r = (R_E + altM) / R_E; return new THREE.Vector3(r * Math.cos(a), 0, r * Math.sin(a)); }),
      color, 0.25, true);
    const geo = ring(GEO, "#ffd166");
    geo.add(label("GEO 35 786 km", "label small"));
    (geo.children[0] as THREE.Object3D).position.set((R_E + GEO) / R_E, 0, 0);
    this.scene.add(geo);

    this.ship = new THREE.Group();
    this.ship.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.05), new THREE.MeshBasicMaterial({ color: "#7df9ff" })),
      glowSprite("rgba(125,249,255,0.7)", 0.6));
    this.scene.add(this.ship);
    this.trail = line([], "#7df9ff", 0.85);
    this.predicted = line([], "#ff8a1f", 0.7, true);
    this.scene.add(this.trail, this.predicted);
    this.refresh();
  }

  onChange(fn: () => void) { this.listeners.push(fn); }
  private emit() { this.listeners.forEach((f) => f()); }

  get elements(): Elements { return elementsOf(this.state, GM); }
  get altitude() { return Math.hypot(...this.state.r) - R_E; }
  get speed() { return Math.hypot(...this.state.v); }
  get mass() { return this.craft.dry + this.craft.prop; }
  get dvLeft() { return this.craft.isp * G0 * Math.log(this.mass / this.craft.dry); }

  /** Impulsive burn; consumes propellant by the rocket equation. Returns false if not enough propellant. */
  doBurn(prograde: number, radial: number): boolean {
    if (this.status !== "flying") return false;
    const dv = Math.hypot(prograde, radial);
    if (dv > this.dvLeft + 1e-6) return false;
    const m1 = this.mass / Math.exp(dv / (this.craft.isp * G0));
    this.craft.prop -= this.mass - m1;
    this.dvUsed += dv;
    this.state = burn(this.state, prograde, radial);
    this.refresh();
    return true;
  }

  preset(kind: "leo" | "gto" | "geo") {
    const alt = kind === "geo" ? GEO : 400e3;
    this.state = circularState(GM, R_E + alt);
    if (kind === "gto") {
      // Hohmann perigee burn from 400 km so that apogee lands exactly at GEO altitude (≈2.40 km/s)
      const r1 = R_E + alt, r2 = R_E + GEO;
      this.state = burn(this.state, Math.sqrt(GM * (2 / r1 - 2 / (r1 + r2))) - Math.sqrt(GM / r1), 0);
    }
    this.craft = { dry: 1000, prop: 1500, isp: 320 };
    this.status = "flying";
    this.dvUsed = 0;
    this.trailPts = [];
    this.goals.forEach((g) => (g.done = false));
    this.refresh();
    // frame the whole orbit: camera distance ∝ apoapsis (in Earth radii)
    this.camera.position.setLength(Math.max(6, (this.elements.ra / R_E) * 2.4));
  }

  /** Recompute predicted conic (one period, or an outbound hyperbolic arc). */
  private refresh() {
    const el = this.elements;
    const pts: THREE.Vector3[] = [];
    let s = this.state;
    const span = el.e < 1 ? el.period : 86400 * 3;
    const n = 400;
    for (let i = 0; i <= n; i++) {
      pts.push(toScene(s.r));
      for (let k = 0; k < 4; k++) s = rk4(s, span / n / 4, GM);
      if (Math.hypot(...s.r) < R_E) break;
    }
    setLine(this.predicted, pts);
    this.checkGoals();
    this.emit();
  }

  private checkGoals() {
    const el = this.elements;
    const done = (id: string) => { const g = this.goals.find((x) => x.id === id)!; g.done = true; };
    if (el.e < 1 && el.ra - R_E > GEO) done("gto");
    if (el.e < 0.01 && Math.abs(el.a - R_E - GEO) < 500e3) done("geo");
    if (el.energy > 0) done("escape");
    if (el.rp - R_E < 100e3 && el.rp - R_E > 0 && this.altitude > 100e3) done("reentry");
  }

  update(dtReal: number) {
    this.controls.update();
    this.earth.rotation.y += (dtReal * this.warp * 2 * Math.PI) / 86164;
    if (this.status === "flying") {
      let left = dtReal * this.warp;
      while (left > 0) {
        const dt = Math.min(left, 5);
        this.state = rk4(this.state, dt, GM);
        this.t += dt;
        left -= dt;
        const alt = this.altitude;
        if (alt < 0) { this.status = "crashed"; break; }
        if (alt < 100e3 && this.elements.rp - R_E < 100e3) { this.status = "reentry"; break; }
        if (Math.hypot(...this.state.r) > 3e9) { this.status = "escaped"; break; }
      }
      const p = toScene(this.state.r);
      this.ship.position.copy(p);
      this.trailPts.push(p);
      if (this.trailPts.length > 1500) this.trailPts.shift();
      setLine(this.trail, this.trailPts);
      if (this.status !== "flying") this.refresh();
    }
    this.emit();
  }

  resize(w: number, h: number) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  setActive(active: boolean) { this.controls.enabled = active; }
}
