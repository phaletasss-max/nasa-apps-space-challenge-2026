import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { initLanding, simulate, stepLanding, type Control, type LandingBody, type LandingState } from "../physics/landing";
import { glowSprite, type Mode } from "./common";
import { skybox, tex } from "./bodies";

/** Fast deterministic value noise + fBm for terrain. */
function hash(x: number, y: number) { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); }
function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, oct = 6) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * noise(x * f, y * f); a *= 0.5; f *= 2.03; } return s; }

interface Style { ground: [number, number, number][]; sky: string; skyHigh: string; fog: number; amp: number; sunElev: number; craters: number }
const STYLE: Record<LandingBody, Style> = {
  mars: { ground: [[0.42, 0.2, 0.1], [0.62, 0.33, 0.18], [0.78, 0.5, 0.32]], sky: "#c99a6c", skyHigh: "#06070c", fog: 1 / 22000, amp: 160, sunElev: 38, craters: 40 },
  moon: { ground: [[0.25, 0.25, 0.26], [0.45, 0.45, 0.46], [0.7, 0.7, 0.7]], sky: "#000000", skyHigh: "#000000", fog: 0, amp: 70, sunElev: 12, craters: 160 },
  venus: { ground: [[0.33, 0.16, 0.07], [0.55, 0.3, 0.12], [0.72, 0.45, 0.2]], sky: "#b8783a", skyHigh: "#e2c07a", fog: 1 / 2500, amp: 90, sunElev: 60, craters: 6 },
};

export class LandingMode implements Mode {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(55, 1, 0.5, 60000);
  controls: OrbitControls;
  body: LandingBody = "mars";
  s: LandingState = initLanding("mars");
  ctrl: Control = { auto: true, throttle: 0.3, pitch: 0 };
  warp = 1;
  playing = true;
  private xFinal = 0;
  private terrain: THREE.Mesh | null = null;
  private farGround: THREE.Mesh | null = null;
  private rocks: THREE.InstancedMesh | null = null;
  private sky: THREE.Mesh;
  private sun = new THREE.DirectionalLight(0xffffff, 3);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 0.35);
  private earthSprite = glowSprite("rgba(90,150,255,0.95)", 1, 1);
  private lander = new THREE.Group();
  private parts: Record<string, THREE.Object3D> = {};
  private plumes: THREE.Mesh[] = [];
  private plasma = glowSprite("rgba(255,140,60,0.95)", 30, 1);
  private dust: THREE.Points;
  private dustVel: Float32Array;
  private shield: { obj: THREE.Object3D; v: THREE.Vector3 } | null = null;
  private lastPos = new THREE.Vector3();
  private craters: { x: number; z: number; r: number }[] = [];

  constructor(dom: HTMLElement) {
    this.controls = new OrbitControls(this.camera, dom);
    this.controls.enableDamping = true;
    this.controls.enabled = false;
    this.sky = skybox(50000);
    this.scene.add(this.sky, this.sun, this.sun.target, this.hemi, this.lander, this.plasma, this.earthSprite);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = sc.bottom = -40; sc.right = sc.top = 40; sc.near = 1; sc.far = 400;
    // dust particles kicked up by the engines
    const n = 1500;
    this.dustVel = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3).fill(-1e6), 3));
    this.dust = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.35, color: 0xc8b8a0, transparent: true, opacity: 0.55, depthWrite: false }));
    this.scene.add(this.dust);
  }

  start(body: LandingBody) {
    this.body = body;
    this.s = initLanding(body);
    this.ctrl = { auto: true, throttle: 0.3, pitch: 0 };
    this.playing = true;
    this.warp = body === "venus" ? 20 : body === "mars" ? 2 : 1;
    this.xFinal = simulate(body).x; // autopilot lands at the scene origin
    this.buildWorld();
    this.buildLander();
    this.shield = null;
    const p = this.landerPos();
    this.controls.target.copy(p);
    this.camera.position.copy(p).add(new THREE.Vector3(-14, 5, 18));
    this.lastPos.copy(p);
  }

  /** Terrain height (m) at scene x,z. Flattened landing ellipse at the origin. */
  heightAt(x: number, z: number) {
    const st = STYLE[this.body];
    let h = (fbm(x / 1800, z / 1800) - 0.5) * st.amp * 2 + (fbm(x / 160, z / 160, 4) - 0.5) * st.amp * 0.12;
    for (const c of this.craters) {
      const d = Math.hypot(x - c.x, z - c.z) / c.r;
      if (d < 1.25) h += d < 1 ? -c.r * 0.22 * (1 - d * d) : c.r * 0.08 * Math.cos(((d - 1) / 0.25) * Math.PI / 2);
    }
    const flat = Math.min(1, Math.hypot(x, z) / 260);
    return h * (flat * flat * (3 - 2 * flat));
  }

  private buildWorld() {
    const st = STYLE[this.body];
    if (this.terrain) { this.scene.remove(this.terrain); this.terrain.geometry.dispose(); }
    if (this.farGround) this.scene.remove(this.farGround);
    if (this.rocks) this.scene.remove(this.rocks);
    let seed = 1;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    this.craters = Array.from({ length: st.craters }, () => {
      const r = 8 + Math.pow(rnd(), 3) * 900;
      return { x: (rnd() - 0.5) * 30000, z: (rnd() - 0.5) * 30000, r };
    }).filter((c) => Math.hypot(c.x, c.z) > c.r * 1.5 + 300);

    // adaptive grid: dense near the landing site, coarse far away
    const N = 300, half = 15000;
    const geo = new THREE.PlaneGeometry(1, 1, N, N);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3);
    const warpC = (u: number) => Math.sign(u) * u * u * half;
    for (let i = 0; i < pos.count; i++) {
      const x = warpC(pos.getX(i) * 2), z = warpC(pos.getZ(i) * 2);
      const y = this.heightAt(x, z);
      pos.setXYZ(i, x, y, z);
      const t = Math.max(0, Math.min(1, 0.5 + y / (st.amp * 2) + (hash(x * 0.05, z * 0.05) - 0.5) * 0.15));
      const [c0, c1, c2] = st.ground, k = t < 0.5 ? t * 2 : (t - 0.5) * 2, A = t < 0.5 ? c0 : c1, B = t < 0.5 ? c1 : c2;
      colors.set([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    this.terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: false }));
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);

    // far ground seen from high altitude: the real planet map
    const map = tex(this.body === "venus" ? "venus_surface.jpg" : this.body === "moon" ? "moon.jpg" : "mars.jpg");
    this.farGround = new THREE.Mesh(new THREE.PlaneGeometry(2.4e6, 1.2e6), new THREE.MeshBasicMaterial({ map, color: 0xb0b0b0 }));
    this.farGround.rotation.x = -Math.PI / 2;
    this.farGround.position.y = -st.amp * 2.5;
    this.scene.add(this.farGround);

    // rocks near the site
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockCol = st.ground[1];
    this.rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: new THREE.Color(...rockCol).multiplyScalar(0.8), roughness: 1, flatShading: true }), 500);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    for (let i = 0; i < 500; i++) {
      const r = 15 + Math.pow(rnd(), 0.6) * 900, a = rnd() * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const size = 0.15 + Math.pow(rnd(), 4) * 2.2;
      q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3));
      sc.set(size, size * (0.5 + rnd() * 0.5), size);
      m.compose(new THREE.Vector3(x, this.heightAt(x, z) + size * 0.3, z), q, sc);
      this.rocks.setMatrixAt(i, m);
    }
    this.rocks.castShadow = this.rocks.receiveShadow = true;
    this.scene.add(this.rocks);

    // light & sky
    const el = (st.sunElev * Math.PI) / 180;
    this.sun.position.set(Math.cos(el) * 200, Math.sin(el) * 200, 60);
    this.sun.intensity = this.body === "venus" ? 0.9 : this.body === "mars" ? 2.4 : 3.2;
    this.sun.color.set(this.body === "venus" ? 0xffc890 : 0xffffff);
    this.hemi.color.set(this.body === "mars" ? 0xe0b090 : this.body === "venus" ? 0xd8a060 : 0x9aa0aa);
    this.hemi.intensity = this.body === "moon" ? 0.08 : 0.45;
    this.earthSprite.visible = this.body === "moon";
    this.sky.visible = this.body === "moon";
  }

  private buildLander() {
    this.lander.clear();
    this.plumes = [];
    this.parts = {};
    const metal = (c: string, m = 0.6, r = 0.35) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r });
    const add = (name: string, o: THREE.Object3D) => { this.parts[name] = o; this.lander.add(o); o.traverse((c) => { c.castShadow = true; }); return o; };
    const plume = (len: number, r: number) => {
      const g = new THREE.ConeGeometry(r, len, 16, 1, true);
      g.translate(0, -len / 2, 0);
      const p = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x9fc8ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      p.castShadow = false;
      this.plumes.push(p);
      return p;
    };

    if (this.body === "moon") {
      const lm = new THREE.Group();
      const descent = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 1.7, 8), metal("#c9a23a", 0.9, 0.35));
      descent.position.y = 2.2;
      const ascent = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 2.4), metal("#9aa0aa", 0.5, 0.5));
      ascent.position.y = 4.1;
      const window = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.05), new THREE.MeshBasicMaterial({ color: 0x111827 }));
      window.position.set(0, 4.4, 1.22);
      lm.add(descent, ascent, window);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2), metal("#d8d8d8"));
        leg.position.set(Math.cos(a) * 2.6, 1.3, Math.sin(a) * 2.6);
        leg.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 16), metal("#d8d8d8"));
        pad.position.set(Math.cos(a) * 3.2, 0.05, Math.sin(a) * 3.2);
        lm.add(leg, pad);
      }
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.75, 0.9, 16, 1, true), metal("#3a3a3a", 0.8, 0.4));
      bell.position.y = 1.0;
      const pl = plume(9, 0.75); pl.position.y = 0.55;
      lm.add(bell, pl);
      add("lm", lm);
      return;
    }
    if (this.body === "venus") {
      const shell = new THREE.Mesh(new THREE.SphereGeometry(1.6, 32, 16), metal("#e8e2d0", 0.2, 0.6));
      add("shell", shell);
      const probe = new THREE.Group();
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.0, 32, 16), metal("#e9e9ea", 0.4, 0.4));
      const plate = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.12, 8, 32), metal("#bfc4cc"));
      plate.rotation.x = Math.PI / 2; plate.position.y = 0.4;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.35, 24), metal("#8f959e"));
      ring.position.y = -0.9;
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.2, 1.6, 12), metal("#d0d0d0"));
      ant.position.y = 1.6;
      probe.add(sphere, plate, ring, ant);
      add("probe", probe).visible = false;
      add("chute", this.parachute(9, 22, "#ffffff", "#e0e0e0")).visible = false;
      return;
    }
    // Mars: aeroshell → parachute → powered descent stage with rover (sky crane)
    const shell = new THREE.Group();
    const back = new THREE.Mesh(new THREE.ConeGeometry(2.25, 2.6, 32, 1, true), metal("#e4e4e0", 0.3, 0.5));
    back.position.y = 1.3;
    const heat = new THREE.Mesh(new THREE.SphereGeometry(2.35, 32, 8, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38), metal("#6b4a2e", 0.1, 0.9));
    heat.position.y = 1.3;
    shell.add(back);
    add("shell", shell);
    add("heat", heat);
    add("chute", this.parachute(10.75, 45, "#f5f5f5", "#e2582b")).visible = false;
    const stage = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.7, 2.8), metal("#c7c9cc", 0.7, 0.35));
    stage.add(frame);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const p = plume(3.2, 0.22); p.position.set(Math.cos(a) * 1.7, -0.35, Math.sin(a) * 1.7); p.rotation.z = Math.cos(a) * 0.25; p.rotation.x = -Math.sin(a) * 0.25;
      stage.add(p);
    }
    stage.position.y = 3.5;
    add("stage", stage).visible = false;
    const rover = new THREE.Group();
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 1.5), metal("#e8e8e8", 0.4, 0.5));
    chassis.position.y = 0.95;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.3), metal("#dcdcdc"));
    mast.position.set(0.7, 1.85, 0.4);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.25), metal("#cfcfcf"));
    head.position.set(0.7, 2.55, 0.4);
    rover.add(chassis, mast, head);
    for (let k = 0; k < 6; k++) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.4, 16), metal("#555", 0.3, 0.8));
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(-0.9 + (k % 3) * 0.9, 0.26, k < 3 ? 0.95 : -0.95);
      rover.add(wheel);
    }
    add("rover", rover).visible = false;
    const cables = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.6, 1.2, 0), new THREE.Vector3(-0.6, 3.2, 0), new THREE.Vector3(0.6, 1.2, 0), new THREE.Vector3(0.6, 3.2, 0),
      new THREE.Vector3(0, 1.2, -0.5), new THREE.Vector3(0, 3.2, -0.5)]), new THREE.LineBasicMaterial({ color: 0xffffff }));
    add("cables", cables).visible = false;
  }

  private parachute(radius: number, height: number, c1: string, c2: string) {
    const g = new THREE.Group();
    const segs = 24;
    for (let k = 0; k < segs; k++) {
      const geo = new THREE.SphereGeometry(radius, 2, 8, (k / segs) * Math.PI * 2, (Math.PI * 2) / segs, 0, Math.PI / 2.4);
      g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: k % 4 < 2 ? c1 : c2, side: THREE.DoubleSide, roughness: 0.8 })));
    }
    g.children.forEach((c) => (c.position.y = height));
    const lines: THREE.Vector3[] = [];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, r = radius * Math.sin(Math.PI / 2.4);
      lines.push(new THREE.Vector3(0, 2.5, 0), new THREE.Vector3(Math.cos(a) * r, height + radius * Math.cos(Math.PI / 2.4), Math.sin(a) * r));
    }
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), new THREE.LineBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.6 })));
    return g;
  }

  /** Scene position of the vehicle (x downrange mapped so the autopilot lands at the origin). */
  landerPos() { return new THREE.Vector3(this.s.x - this.xFinal, this.s.h + this.heightAt(this.s.x - this.xFinal, 0), 0); }

  update(dtReal: number) {
    const s = this.s;
    if (this.playing && s.phase !== "landed" && s.phase !== "crashed") {
      let simT = dtReal * this.warp;
      while (simT > 1e-6) { const dt = Math.min(0.05, simT); stepLanding(s, dt, this.ctrl); simT -= dt; }
    }
    const p = this.landerPos();
    this.lander.position.copy(p);

    // orientation: entry vehicles fly heat-shield first; powered/LM vehicles tilt with thrust
    const v = new THREE.Vector3(s.vx, s.vz, 0);
    if (s.phase === "entry" && v.length() > 1) {
      this.lander.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), v.clone().normalize());
    } else {
      this.lander.quaternion.setFromEuler(new THREE.Euler(0, 0, s.pitch));
    }
    this.updateParts();
    this.updateEffects(dtReal, p);

    // camera: keep following the vehicle, user can orbit/zoom freely
    const delta = p.clone().sub(this.lastPos);
    this.camera.position.add(delta);
    this.controls.target.add(delta);
    this.lastPos.copy(p);
    const h = Math.max(1, s.h);
    this.camera.near = Math.max(0.3, Math.min(50, h * 0.0004));
    this.camera.far = Math.max(60000, h * 25);
    this.camera.updateProjectionMatrix();
    this.controls.update();

    // sky & fog by altitude
    const st = STYLE[this.body];
    const k = this.body === "venus" ? Math.min(1, s.h / 90000) : Math.min(1, s.h / 60000);
    const col = new THREE.Color(st.sky).lerp(new THREE.Color(st.skyHigh), k);
    this.scene.background = col;
    if (st.fog) {
      let density = st.fog * (1 - k * 0.9);
      if (this.body === "venus" && s.h > 47000 && s.h < 70000) density = 1 / 300; // inside the sulfuric-acid cloud deck
      this.scene.fog = new THREE.FogExp2(col.getHex(), density);
    } else this.scene.fog = null;
    this.sky.position.copy(this.camera.position);
    this.earthSprite.position.copy(this.camera.position).add(new THREE.Vector3(-0.4, 0.55, -1).multiplyScalar(4000));
    this.earthSprite.scale.setScalar(120);
    this.sun.target.position.copy(p);
    this.sun.position.copy(p).add(new THREE.Vector3(Math.cos((st.sunElev * Math.PI) / 180) * 150, Math.sin((st.sunElev * Math.PI) / 180) * 150, 50));
  }

  private updateParts() {
    const s = this.s, P = this.parts;
    if (!P.shell && !P.lm && !P.probe) return; // start() not called yet
    if (this.body === "mars") {
      const pre = s.phase === "entry" || s.phase === "parachute";
      P.shell.visible = pre;
      P.chute.visible = s.phase === "parachute";
      if (P.heat.visible && s.phase === "parachute" && s.mass < 3300 && !this.shield) {
        // heat shield separation: let it fall away
        P.heat.visible = false;
        const clone = P.heat.clone();
        clone.position.copy(this.lander.position).add(new THREE.Vector3(0, 1.3, 0));
        this.scene.add(clone);
        this.shield = { obj: clone, v: new THREE.Vector3(s.vx * 0.2, s.vz, 0) };
      }
      if (s.phase === "entry") P.heat.visible = true;
      const powered = s.phase === "powered" || s.phase === "skycrane" || s.phase === "landed" || s.phase === "crashed";
      P.stage.visible = powered && s.phase !== "landed";
      P.rover.visible = powered || (s.phase === "parachute" && s.mass < 3300);
      P.cables.visible = s.phase === "skycrane";
      P.rover.position.y = s.phase === "skycrane" || s.phase === "landed" ? 0 : 1.8;
      if (s.phase === "skycrane") P.stage.position.y = 3.5 + Math.min(7.5, Math.max(0, 21 - s.h) * 0.5);
      if (s.phase === "landed") P.stage.visible = false; // flies away to crash at a safe distance
    } else if (this.body === "venus") {
      P.shell.visible = s.phase === "entry";
      P.probe.visible = s.phase !== "entry";
      P.chute.visible = s.phase === "parachute";
    }
    const thr = this.body === "mars" ? (s.phase === "powered" || s.phase === "skycrane" ? s.throttle : 0) : this.body === "moon" ? s.throttle : 0;
    for (const p of this.plumes) {
      p.visible = thr > 0.02 && s.phase !== "landed" && s.phase !== "crashed";
      p.scale.set(1, 0.4 + thr * 1.2 + Math.random() * 0.15, 1);
    }
  }

  private updateEffects(dt: number, p: THREE.Vector3) {
    const s = this.s;
    // entry plasma glow
    this.plasma.visible = s.heat > 2;
    if (this.plasma.visible) {
      const v = new THREE.Vector3(s.vx, s.vz, 0).normalize();
      this.plasma.position.copy(p).add(v.multiplyScalar(3));
      const k = Math.min(1, s.heat / (this.body === "venus" ? 1500 : 60));
      this.plasma.scale.setScalar(8 + 40 * k + Math.random() * 3);
      (this.plasma.material as THREE.SpriteMaterial).opacity = 0.35 + 0.65 * k;
    }
    // falling heat shield
    if (this.shield) {
      this.shield.v.y -= 3.71 * dt * this.warp;
      this.shield.obj.position.addScaledVector(this.shield.v, dt * this.warp);
      this.shield.obj.rotation.z += dt;
      if (this.shield.obj.position.y < -500) { this.scene.remove(this.shield.obj); this.shield = null; }
    }
    // dust from the engines near the ground
    const pos = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    const thrusting = s.throttle > 0.05 && s.h < 40 && (this.body === "moon" || s.phase === "powered" || s.phase === "skycrane");
    for (let i = 0; i < pos.count; i++) {
      if (thrusting && Math.random() < 0.02 * s.throttle * (1 - s.h / 40)) {
        const a = Math.random() * Math.PI * 2, sp = 5 + Math.random() * 20;
        pos.setXYZ(i, p.x, this.heightAt(p.x, 0) + 0.3, p.z);
        this.dustVel.set([Math.cos(a) * sp, 0.5 + Math.random() * 2, Math.sin(a) * sp], i * 3);
      } else if (pos.getY(i) > -1e5) {
        pos.setXYZ(i, pos.getX(i) + this.dustVel[i * 3] * dt, pos.getY(i) + this.dustVel[i * 3 + 1] * dt, pos.getZ(i) + this.dustVel[i * 3 + 2] * dt);
        this.dustVel[i * 3 + 1] -= (this.body === "moon" ? 1.62 : 3.71) * dt;
        if (pos.getY(i) < this.heightAt(pos.getX(i), pos.getZ(i)) - 1) pos.setY(i, -1e6);
      }
    }
    pos.needsUpdate = true;
  }

  resize(w: number, h: number) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  setActive(active: boolean) { this.controls.enabled = active; }
}
