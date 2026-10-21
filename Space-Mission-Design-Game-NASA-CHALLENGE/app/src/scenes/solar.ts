import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { AU, DAY, PLANETS, SUN } from "../physics/constants";
import { angleXY, hohmann, nextWindow, planetPosition, semiMajorAxis, transferPoint, type Vec3 } from "../physics/orbits";
import { evaluate, type Budget, type Design } from "../mission";
import { moonGeocentric } from "../data/worlds";
import { ASTEROIDS, asteroidPosition, type Asteroid } from "../game/hazards";
import { buildWorld, skybox, spin, type BuiltWorld } from "./bodies";
import { glowSprite, label, line, setLine, type Mode } from "./common";

const SCALE = 12; // scene units per AU
/** Visual radii (not to scale: real sizes would be invisible at this distance scale). */
export const VIS_RADIUS: Record<string, number> = { sun: 1.4, mercury: 0.22, venus: 0.38, earth: 0.4, moon: 0.11, mars: 0.3, jupiter: 1.15, saturn: 1.0 };
const MOON_VIS_DIST = 1.15;

/** Ecliptic metres -> scene (y-up). */
export const toScene = (p: Vec3) => new THREE.Vector3((p[0] / AU) * SCALE, (p[2] / AU) * SCALE, (-p[1] / AU) * SCALE);

export type Phase = "design" | "to-window" | "cruise" | "arrived" | "failed";

export interface LogEntry { date: number; text: string; kind: "info" | "ok" | "warn" | "bad" }

export interface Plan {
  window: number; arrival: number; tofDays: number; missKm: number; theta0: number; target: string;
  offset: Vec3; budget: Budget;
}

export class SolarMode implements Mode {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, 1, 0.01, 6000);
  controls: OrbitControls;
  date = Date.now();
  rate = 86400; // simulated seconds per real second (1 day/s)
  playing = true;
  phase: Phase = "design";
  plan: Plan | null = null;
  log: LogEntry[] = [];
  design!: Design;
  selected: string | null = null;
  follow = true;
  private bodies = new Map<string, BuiltWorld>();
  private craft: THREE.Group;
  private trail: THREE.Line;
  private trailPts: THREE.Vector3[] = [];
  private preview: THREE.Line;
  private listeners: (() => void)[] = [];
  private orbitAngle = 0;
  private raycaster = new THREE.Raycaster();
  private lastTarget = new THREE.Vector3();
  private flyTo: { dist: number; t: number } | null = null;
  private dom: HTMLElement;

  constructor(dom: HTMLElement) {
    this.dom = dom;
    this.camera.position.set(0, 38, 62);
    this.controls = new OrbitControls(this.camera, dom);
    this.controls.enableDamping = true;
    this.controls.maxDistance = 900;
    this.controls.minDistance = 0.3;

    this.scene.add(skybox(2500));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.06));
    this.scene.add(new THREE.PointLight(0xfff2d6, 3.4, 0, 0));

    const sun = buildWorld("sun", VIS_RADIUS.sun);
    sun.root.add(glowSprite("rgba(255,180,70,0.55)", 16));
    sun.root.add(label("Sol", "label sun"));
    this.scene.add(sun.root);
    this.bodies.set("sun", sun);

    for (const [id, body] of Object.entries(PLANETS)) {
      const w = buildWorld(id, VIS_RADIUS[id], 48);
      w.root.add(label(body.name.es));
      this.scene.add(w.root);
      this.bodies.set(id, w);
      const a = semiMajorAxis(id), period = 2 * Math.PI * Math.sqrt(a ** 3 / SUN.gm) * 1000;
      const pts = Array.from({ length: 361 }, (_, k) => toScene(planetPosition(id, this.date + (period * k) / 360)));
      this.scene.add(line(pts, body.color, 0.22));
    }
    const moon = buildWorld("moon", VIS_RADIUS.moon, 32);
    moon.root.add(label("Luna", "label small-moon"));
    this.scene.add(moon.root);
    this.bodies.set("moon", moon);

    this.craft = new THREE.Group();
    this.craft.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.1), new THREE.MeshBasicMaterial({ color: "#7df9ff" })),
      glowSprite("rgba(125,249,255,0.6)", 1.6));
    this.craft.add(label("Nave", "label craft"));
    this.craft.visible = false;
    this.scene.add(this.craft);
    this.trail = line([], "#7df9ff", 0.9);
    this.preview = line([], "#ffd166", 0.75, true);
    this.scene.add(this.trail, this.preview);
    this.placeBodies();
    this.bindPicking();
  }

  onChange(fn: () => void) { this.listeners.push(fn); }
  private emit() { this.listeners.forEach((f) => f()); }
  private push(text: string, kind: LogEntry["kind"] = "info") { this.log.unshift({ date: this.date, text, kind }); }

  // ---------------------------------------------------------------- selection & camera
  private bindPicking() {
    let down: { x: number; y: number } | null = null;
    this.dom.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; });
    this.dom.addEventListener("pointerup", (e) => {
      if (!this.controls.enabled || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const r = this.dom.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.camera);
      const meshes = [...this.bodies.values()].map((b) => b.body);
      const hit = this.raycaster.intersectObjects(meshes, false)[0];
      if (hit) this.select([...this.bodies.values()].find((b) => b.body === hit.object)!.id);
    });
  }

  select(id: string | null) {
    this.selected = id;
    this.follow = true;
    if (id) {
      this.lastTarget.copy(this.controls.target);
      this.flyTo = { dist: VIS_RADIUS[id] * (id === "sun" ? 9 : 7), t: 0 };
    }
    this.emit();
  }

  /** Current position of a body in scene units. */
  positionOf(id: string): THREE.Vector3 { return this.bodies.get(id)!.root.position.clone(); }

  /** Distances (AU) from the Sun and from the Earth, for the info card. */
  distancesAU(id: string): { sun: number; earth: number } {
    const p = this.positionOf(id).divideScalar(SCALE), e = this.positionOf("earth").divideScalar(SCALE);
    if (id === "moon") return { sun: p.length(), earth: moonGeocentric(this.date).km * 1000 / AU };
    return { sun: p.length(), earth: p.distanceTo(e) };
  }

  private updateCamera(dtReal: number) {
    if (this.selected && this.follow) {
      const target = this.positionOf(this.selected);
      const delta = target.clone().sub(this.controls.target);
      if (this.flyTo) {
        this.flyTo.t = Math.min(1, this.flyTo.t + dtReal * 0.9);
        const k = 1 - Math.pow(1 - this.flyTo.t, 3);
        this.controls.target.lerp(target, k);
        const offset = this.camera.position.clone().sub(this.controls.target);
        offset.setLength(THREE.MathUtils.lerp(offset.length(), this.flyTo.dist, k * 0.25));
        this.camera.position.copy(this.controls.target).add(offset);
        if (this.flyTo.t >= 1) this.flyTo = null;
      } else {
        this.controls.target.add(delta);
        this.camera.position.add(delta);
      }
    }
    this.controls.update();
  }

  // ---------------------------------------------------------------- mission (unchanged logic)
  setDesign(d: Design) {
    this.design = d;
    if (this.phase !== "design") return;
    this.plan = this.makePlan(d, this.date);
    this.drawPreview();
    this.emit();
  }

  private makePlan(d: Design, from: number): Plan | null {
    const nominal = nextWindow("earth", d.target, from);
    if (nominal === null) return null;
    const r1 = semiMajorAxis("earth"), r2 = semiMajorAxis(d.target);
    const h = hohmann(r1, r2);
    const missAt = (dep: number) => {
      const theta0 = angleXY(planetPosition("earth", dep));
      const end = transferPoint(h, r1, r2, theta0, 1);
      const actual = planetPosition(d.target, dep + h.tof * 1000);
      const offset: Vec3 = [actual[0] - end[0], actual[1] - end[1], actual[2] - end[2]];
      return { theta0, offset, miss: Math.hypot(...offset) };
    };
    // The phase-angle window assumes circular orbits; real planets speed up and slow down on their
    // ellipses, so pick the departure day (±45 d, never in the past) where the ideal arc misses least.
    let window = nominal, best = missAt(nominal);
    for (let k = -45; k <= 45; k++) {
      const dep = nominal + k * DAY * 1000;
      if (dep < from) continue;
      const m = missAt(dep);
      if (m.miss < best.miss) { best = m; window = dep; }
    }
    return { window, arrival: window + h.tof * 1000, tofDays: h.tof / DAY, missKm: best.miss / 1000, theta0: best.theta0,
      target: d.target, offset: best.offset, budget: evaluate(d) };
  }

  /** Spacecraft heliocentric position at fraction s of the cruise (Hohmann arc + smooth course correction). */
  private cruisePos(s: number): Vec3 {
    const p = this.plan!;
    const r1 = semiMajorAxis("earth"), r2 = semiMajorAxis(p.target);
    const h = hohmann(r1, r2);
    const base = transferPoint(h, r1, r2, p.theta0, s);
    const b0 = transferPoint(h, r1, r2, p.theta0, 0);
    const start = planetPosition("earth", p.window);
    // Ideal circular-orbit Hohmann arc, nudged to leave from Earth's real position and to meet the
    // target's real position (what trajectory-correction manoeuvres do in a real mission).
    const w = s * s * (3 - 2 * s);
    return [0, 1, 2].map((i) => base[i] + (start[i] - b0[i]) * (1 - w) + p.offset[i] * w) as Vec3;
  }

  private drawPreview() {
    if (!this.plan) return setLine(this.preview, []);
    setLine(this.preview, Array.from({ length: 121 }, (_, k) => toScene(this.cruisePos(k / 120))));
  }

  launch() {
    if (this.phase !== "design" || !this.plan) return;
    const launchCheck = this.plan.budget.checks.find((c) => c.id === "launch")!;
    if (!launchCheck.ok) {
      this.phase = "failed";
      this.push(`El cohete no puede despegar: ${launchCheck.detail}.`, "bad");
      return this.emit();
    }
    this.phase = "to-window";
    this.playing = true;
    this.push(`Esperando la ventana de lanzamiento del ${fmtDate(this.plan.window)}…`);
    this.emit();
  }

  reset() {
    this.phase = "design";
    this.craft.visible = false;
    this.trailPts = [];
    setLine(this.trail, []);
    this.log = [];
    this.setDesign(this.design);
  }

  /** Jump the clock to the real current time (design phase only). */
  now() {
    if (this.phase !== "design") return;
    this.date = Date.now();
    this.rate = 1;
    this.placeBodies();
    this.setDesign(this.design);
  }

  private placeBodies() {
    for (const [id, w] of this.bodies) {
      if (id === "sun") w.root.position.set(0, 0, 0);
      else if (id === "moon") {
        const m = moonGeocentric(this.date), e = this.bodies.get("earth")!.root.position;
        const dir: Vec3 = [Math.cos(m.latRad) * Math.cos(m.lonRad), Math.cos(m.latRad) * Math.sin(m.lonRad), Math.sin(m.latRad)];
        w.root.position.set(e.x + dir[0] * MOON_VIS_DIST, e.y + dir[2] * MOON_VIS_DIST, e.z - dir[1] * MOON_VIS_DIST);
      } else w.root.position.copy(toScene(planetPosition(id, this.date)));
      spin(w, this.date);
      if (w.sunDir) w.sunDir.copy(w.root.position).negate().normalize();
    }
  }

  update(dtReal: number) {
    if (this.playing) {
      const p = this.plan;
      let rate = this.rate;
      if (this.phase === "to-window" && p) rate = Math.max(rate, Math.min(120 * DAY, (p.window - this.date) / 1000 / 1.5));
      if (this.phase === "cruise") rate = Math.max(rate, 20 * DAY);
      const next = this.date + rate * 1000 * dtReal;
      if (this.phase === "to-window" && p && next >= p.window) { this.date = p.window; this.depart(); }
      else if (this.phase === "cruise" && p && next >= p.arrival) { this.date = p.arrival; this.arrive(); }
      else this.date = next;
      this.placeBodies();

      if (this.phase === "cruise" && p) {
        const s = (this.date - p.window) / (p.arrival - p.window);
        const pos = toScene(this.cruisePos(s));
        this.craft.position.copy(pos);
        this.trailPts.push(pos);
        setLine(this.trail, this.trailPts);
      } else if (this.phase === "arrived" && p) {
        this.orbitAngle += dtReal * 2;
        const c = this.positionOf(p.target), r = VIS_RADIUS[p.target] * 1.9;
        this.craft.position.set(c.x + r * Math.cos(this.orbitAngle), c.y + 0.15 * Math.sin(this.orbitAngle * 2), c.z + r * Math.sin(this.orbitAngle));
      }
    }
    this.updateCamera(dtReal);
    this.emit();
  }

  private depart() {
    const p = this.plan!, b = p.budget;
    if (b.dvAvailable < b.dvDeparture) {
      this.phase = "failed";
      this.push(`Sin Δv para escapar de la Tierra: necesitas ${(b.dvDeparture / 1000).toFixed(2)} km/s y tienes ${(b.dvAvailable / 1000).toFixed(2)} km/s.`, "bad");
      return;
    }
    this.phase = "cruise";
    this.craft.visible = true;
    this.push(`Lanzamiento e inyección trans-${PLANETS[p.target].name.es} (${(b.dvDeparture / 1000).toFixed(2)} km/s).`, "ok");
    this.push(`Corrección de trayectoria prevista: la elipse de Hohmann ideal fallaría por ${fmtKm(p.missKm)} km (órbitas reales no son circulares ni coplanares).`, "warn");
  }

  private arrive() {
    const p = this.plan!, b = p.budget, d = this.design;
    const name = PLANETS[p.target].name.es;
    this.push(`Llegada a ${name} tras ${Math.round(p.tofDays)} días.`, "ok");
    let fraction = 1;
    if (d.capture !== "flyby" && b.dvAvailable < b.dvDeparture + b.dvCapture) {
      this.push(`No queda combustible para frenar (${(b.dvCapture / 1000).toFixed(2)} km/s): la nave pasa de largo. Solo ciencia de sobrevuelo.`, "warn");
      fraction *= 0.35;
    } else if (d.capture === "flyby") {
      this.push("Sobrevuelo: unas horas de observación cercana.", "info");
      fraction *= 0.4;
    } else {
      this.push(`Inserción orbital ${d.capture === "circular" ? "circular" : "elíptica"} (${(b.dvCapture / 1000).toFixed(2)} km/s). Puedes entrar al mundo y aterrizar.`, "ok");
    }
    if (b.powerAvailable < b.powerNeeded) {
      const f = b.powerAvailable / b.powerNeeded;
      this.push(`Energía insuficiente: ${Math.round(b.powerAvailable)} W de ${Math.round(b.powerNeeded)} W. Los instrumentos trabajan ${Math.round(f * 100)}% del tiempo.`, "warn");
      fraction *= f;
    }
    if (b.dataCapacityMbDay < b.dataNeededMbDay) {
      const f = b.dataCapacityMbDay / b.dataNeededMbDay;
      this.push(`El enlace solo baja el ${Math.round(f * 100)}% de los datos a ${b.maxEarthDistance.toFixed(1)} UA.`, "warn");
      fraction *= f;
    }
    const score = Math.round(b.science * 100 * fraction);
    this.phase = "arrived";
    this.rate = DAY;
    this.select(p.target);
    this.push(fraction > 0.95 ? `Misión exitosa. Ciencia: ${score} puntos.` : `Misión parcial. Ciencia: ${score} puntos.`, fraction > 0.95 ? "ok" : "warn");
  }

  // ---------------------------------------------------------------- campaign hooks (Δv Mission Control)
  external = false;
  private gameTrack = line([], "#ffd166", 0.9);
  private gameDone = line([], "#7df9ff", 0.95);
  private hazards = new THREE.Group();
  private belt: THREE.Points | null = null;
  private beltDate = 0;
  private byName = new Map<string, Asteroid>(ASTEROIDS.map((a) => [a.name, a]));

  /** Hand the clock to the campaign (no internal mission logic, no auto-advance). */
  setExternal(on: boolean) {
    this.external = on;
    this.playing = !on;
    if (!this.gameTrack.parent) this.scene.add(this.gameTrack, this.gameDone, this.hazards);
    if (on) {
      this.phase = "design"; this.plan = null; this.log = [];
      setLine(this.preview, []); this.trailPts = []; setLine(this.trail, []);
      this.craft.visible = false;
    } else { setLine(this.gameTrack, []); setLine(this.gameDone, []); this.hazards.clear(); this.showBelt(false); }
  }

  setDate(ms: number) { this.date = ms; this.placeBodies(); if (this.belt?.visible && Math.abs(ms - this.beltDate) > 86400000) this.updateBelt(); }

  /** Moon position in scene units (drawn at an exaggerated distance from the Earth). */
  sceneMoon(): THREE.Vector3 { return this.positionOf("moon"); }

  /** Cruise path in scene units; `doneFrac` of it drawn as flown. */
  setGameTrack(points: THREE.Vector3[], doneFrac: number) {
    const k = Math.max(0, Math.min(points.length, Math.round(points.length * doneFrac)));
    setLine(this.gameTrack, points.slice(Math.max(0, k - 1)));
    setLine(this.gameDone, points.slice(0, k));
  }

  setGameCraft(p: THREE.Vector3 | null) {
    this.craft.visible = !!p;
    if (p) this.craft.position.copy(p);
  }

  /** Predicted close approaches: marker + name at the asteroid's current position. */
  setHazards(list: { name: string; level: "alert" | "watch" | "flyby"; selected: boolean; done: boolean }[]) {
    this.hazards.clear();
    for (const h of list) {
      const a = this.byName.get(h.name);
      if (!a || h.done) continue;
      const color = h.level === "alert" ? "#ff5d6c" : h.level === "flyby" ? "#3ecf8e" : "#ffb347";
      const g = new THREE.Group();
      g.position.copy(toScene(asteroidPosition(a, this.date)));
      g.add(new THREE.Mesh(new THREE.SphereGeometry(h.selected ? 0.07 : 0.045, 10, 8), new THREE.MeshBasicMaterial({ color })));
      g.add(glowSprite(color === "#ff5d6c" ? "rgba(255,93,108,0.7)" : color === "#3ecf8e" ? "rgba(62,207,142,0.6)" : "rgba(255,179,71,0.6)", h.selected ? 1.4 : 0.7));
      if (h.selected || h.level === "alert") g.add(label(h.name, `label hazard ${h.level}`));
      this.hazards.add(g);
    }
  }

  /** The whole catalogue (7 000+ real asteroids) as a point cloud. */
  showBelt(on: boolean) {
    if (on && !this.belt) {
      const n = ASTEROIDS.length, g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const col = new Float32Array(n * 3);
      ASTEROIDS.forEach((a, i) => col.set(a.pha ? [1, 0.36, 0.42] : a.neo ? [1, 0.66, 0.3] : [0.55, 0.58, 0.64], i * 3));
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      this.belt = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false }));
      this.belt.frustumCulled = false;
      this.scene.add(this.belt);
    }
    if (this.belt) { this.belt.visible = on; if (on) this.updateBelt(); }
  }

  private updateBelt() {
    if (!this.belt) return;
    const pos = this.belt.geometry.attributes.position as THREE.BufferAttribute;
    ASTEROIDS.forEach((a, i) => {
      const v = toScene(asteroidPosition(a, this.date));
      if (Number.isFinite(v.x + v.y + v.z)) pos.setXYZ(i, v.x, v.y, v.z); else pos.setXYZ(i, 0, 1e5, 0); // outside the far plane
    });
    pos.needsUpdate = true;
    this.belt.geometry.computeBoundingSphere();
    this.beltDate = this.date;
  }

  resize(w: number, h: number) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  setActive(active: boolean) { this.controls.enabled = active; }
}

export const fmtDate = (t: number) => new Date(t).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
export const fmtDateTime = (t: number) => new Date(t).toLocaleString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const fmtKm = (km: number) => (km >= 1e6 ? `${(km / 1e6).toFixed(1)} millones de` : Math.round(km).toLocaleString("es-PE"));
