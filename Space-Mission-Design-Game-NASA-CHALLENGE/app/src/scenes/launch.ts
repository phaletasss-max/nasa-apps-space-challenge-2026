/**
 * Launch: the integrated vehicle on the pad, flown by the 2D ascent model (game/ascent.ts) mapped onto a
 * real-size Earth (1 scene unit = 1 m). The pad sits at Cape Canaveral (28.5° N); the flight plane points
 * due east. Spent stages and the fairing are jettisoned and fall away; the sky darkens with altitude.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PLANETS } from "../physics/constants";
import { initAscent, stepAscent, type AscentState } from "../game/ascent";
import type { Vehicle } from "../game/catalog";
import { buildWorld } from "./bodies";
import { glowSprite, starfield, type Mode } from "./common";
import { buildRocket, type RocketModel } from "./rocket";

const RE = PLANETS.earth.radius;
const SITE = { lat: 28.5, lon: -80.6 };

interface Debris { obj: THREE.Object3D; v: THREE.Vector3; spin: THREE.Vector3; life: number }

export class LaunchMode implements Mode {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, 1, 1, 9e6);
  controls: OrbitControls;
  state: AscentState | null = null;
  status: "pad" | "flight" | "done" = "pad";
  warp = 1;
  private rocket: RocketModel | null = null;
  private vehicleKey = "";
  private holder = new THREE.Group(); // rocket position/orientation
  private plume = new THREE.Group();
  private plumeCore: THREE.Mesh;
  private plumeGlow = glowSprite("rgba(255,170,70,0.9)", 30, 1);
  private ground = new THREE.Group();
  private globe = new THREE.Group();
  private stars = starfield(3000, 4e6);
  private sun = new THREE.DirectionalLight(0xfff4e0, 2.6);
  private hemi = new THREE.HemisphereLight(0x9cc8ff, 0x3a3a2a, 0.9);
  private smoke: THREE.Points;
  private smokeN = 0;
  private smokeT = 0;
  private debris: Debris[] = [];
  private lastStage = 0;
  private hadFairing = true;
  private rand: () => number = Math.random;
  private prev = new THREE.Vector3();
  private sky = { low: new THREE.Color("#7fb2e5"), high: new THREE.Color("#000000") };

  constructor(dom: HTMLElement) {
    this.controls = new OrbitControls(this.camera, dom);
    this.controls.enableDamping = true;
    this.controls.enabled = false;
    this.controls.minDistance = 20;
    this.controls.maxDistance = 3000;
    this.scene.add(this.hemi, this.sun, this.sun.target, this.ground, this.globe, this.holder, this.stars);
    this.sun.position.set(-3000, 6000, 2500);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.4;
    Object.assign(this.sun.shadow.camera, { left: -120, right: 120, top: 160, bottom: -40, near: 10, far: 12000 });
    this.scene.fog = new THREE.FogExp2("#9cc0e0", 0.00004);

    // plume: inner bright cone + soft glow, additive
    this.plumeCore = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 24, 1, true), new THREE.MeshBasicMaterial({
      color: "#ffd9a0", transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.plumeCore.rotation.x = Math.PI; // tip pointing down
    this.plume.add(this.plumeCore, this.plumeGlow);
    this.plume.visible = false;
    this.holder.add(this.plume);

    // exhaust smoke column
    const n = 2500;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3).fill(0), 3));
    g.setDrawRange(0, 0);
    this.smoke = new THREE.Points(g, new THREE.PointsMaterial({ color: "#e8e4dc", size: 26, transparent: true, opacity: 0.32, depthWrite: false, map: smokeTexture() }));
    this.smoke.frustumCulled = false;
    this.scene.add(this.smoke);

    this.buildPad();
    this.buildGlobe();
  }

  private buildPad() {
    const g = this.ground;
    const land = new THREE.Mesh(new THREE.CircleGeometry(60000, 96), new THREE.MeshStandardMaterial({ color: "#5d6b45", roughness: 1 }));
    land.rotation.x = -Math.PI / 2;
    land.position.y = -1.2;
    land.receiveShadow = true;
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(60000, 120000), new THREE.MeshStandardMaterial({ color: "#1f4f6e", roughness: 0.25, metalness: 0.2 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(32000, 0.4, 0);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(70, 80, 6, 8), new THREE.MeshStandardMaterial({ color: "#9a9a94", roughness: 0.95 }));
    pad.position.y = -3;
    pad.receiveShadow = true;
    const trench = new THREE.Mesh(new THREE.BoxGeometry(14, 6.2, 60), new THREE.MeshStandardMaterial({ color: "#2b2b2b" }));
    trench.position.set(0, -3, 25);
    g.add(land, sea, pad, trench);
    // fixed service structure: lattice tower with crew access arm
    const steel = new THREE.MeshStandardMaterial({ color: "#b6463a", roughness: 0.6, metalness: 0.4 });
    const tower = new THREE.Group();
    for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 110, 0.8), steel);
      leg.position.set(x, 55, z);
      leg.castShadow = true;
      tower.add(leg);
    }
    for (let y = 6; y < 110; y += 6) {
      const ring = new THREE.Mesh(new THREE.BoxGeometry(9, 0.5, 9), steel);
      ring.position.y = y;
      tower.add(ring);
    }
    tower.position.set(-22, 0, 0);
    // lightning protection masts and water tower
    const mastMat = new THREE.MeshStandardMaterial({ color: "#d8d8d8" });
    for (const [x, z] of [[-95, -95], [95, -95], [-95, 95], [95, -20]]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1, 140, 8), mastMat);
      m.position.set(x, 70, z);
      g.add(m);
    }
    const water = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 16), mastMat);
    water.position.set(180, 60, -120);
    const waterLeg = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 55, 8), mastMat);
    waterLeg.position.set(180, 27, -120);
    g.add(tower, water, waterLeg);
    this.ground.userData.arm = tower;
  }

  private buildGlobe() {
    const w = buildWorld("earth", RE, 160);
    w.tilt.rotation.set(0, 0, 0);
    w.clouds?.scale.setScalar((RE + 9000) / (RE * 1.012)); // weather layer near the ground, not at 76 km
    w.sunDir!.set(-0.35, 0.8, 0.45).normalize();
    // rotate so the launch site is "up" (+Y) and local east is +X
    const phi = ((SITE.lon + 180) / 360) * Math.PI * 2, theta = ((90 - SITE.lat) * Math.PI) / 180;
    const s = new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
    const east = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi)).normalize();
    const north = new THREE.Vector3().crossVectors(east, s).normalize();
    const basis = new THREE.Matrix4().makeBasis(east, s, north).invert();
    w.root.quaternion.setFromRotationMatrix(basis);
    w.root.position.set(0, -RE, 0);
    this.globe.add(w.root);
    this.globe.visible = false;
  }

  setVehicle(v: Vehicle) {
    const k = JSON.stringify(v);
    if (k === this.vehicleKey && this.status === "pad") return;
    this.vehicleKey = k;
    if (this.rocket) this.holder.remove(this.rocket.root);
    this.debris.forEach((d) => this.scene.remove(d.obj));
    this.debris = [];
    this.rocket = buildRocket(v);
    this.rocket.parts.find((p) => p.key === "p")!.group.visible = false;
    this.holder.add(this.rocket.root);
    this.plume.position.y = -1;
    this.state = initAscent(v);
    this.status = "pad";
    this.lastStage = 0;
    this.hadFairing = this.state.fairing;
    this.smokeN = 0;
    this.smoke.geometry.setDrawRange(0, 0);
    this.place();
    const h = this.rocket.height;
    this.controls.target.set(0, h * 0.5, 0);
    this.camera.position.set(h * 0.75, h * 0.28, h * 1.15);
    this.prev.copy(this.holder.position);
  }

  ignite(rand: () => number) {
    if (this.status !== "pad" || !this.state) return;
    this.rand = rand;
    this.status = "flight";
    this.plume.visible = true;
  }

  /** Scene position of the ascent state (on a real-radius Earth centred at (0, −R, 0)). */
  private place() {
    const s = this.state;
    if (!s) return;
    const r = Math.hypot(s.x, s.y), th = Math.atan2(s.x, s.y);
    this.holder.position.set(Math.sin(th) * r, Math.cos(th) * r - RE, 0);
    const elev = (s.pitchDeg * Math.PI) / 180;
    const up = new THREE.Vector3(Math.sin(th), Math.cos(th), 0), east = new THREE.Vector3(Math.cos(th), -Math.sin(th), 0);
    const axis = up.multiplyScalar(Math.sin(elev)).add(east.multiplyScalar(Math.cos(elev))).normalize();
    this.holder.quaternion.slerp(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis), this.status === "pad" ? 1 : 0.08);
  }

  private jettison(key: string) {
    const part = this.rocket?.parts.find((p) => p.key === key);
    if (!part) return;
    const world = new THREE.Vector3(), q = new THREE.Quaternion();
    part.group.getWorldPosition(world);
    part.group.getWorldQuaternion(q);
    this.scene.attach(part.group);
    const vel = this.holder.position.clone().sub(this.prev).multiplyScalar(0.9 / Math.max(1e-3, this.lastDt));
    const kick = new THREE.Vector3(0, -6, 0).applyQuaternion(this.holder.quaternion);
    this.debris.push({ obj: part.group, v: vel.add(kick), spin: new THREE.Vector3(this.rand() - 0.5, 0, this.rand() - 0.5).multiplyScalar(0.4), life: 40 });
  }

  private fairingSep() {
    const part = this.rocket?.parts.find((p) => p.key === "fairing");
    if (!part) return;
    const inside = this.rocket!.parts.find((p) => p.key === "p");
    if (inside) inside.group.visible = true;
    for (const m of [...part.solids]) {
      if (!m.name.startsWith("half")) continue;
      this.scene.attach(m);
      const side = m.name === "half0" ? 1 : -1;
      const out = new THREE.Vector3(0, 0, side * 8).applyQuaternion(this.holder.quaternion);
      const vel = this.holder.position.clone().sub(this.prev).multiplyScalar(1 / Math.max(1e-3, this.lastDt)).add(out);
      this.debris.push({ obj: m, v: vel, spin: new THREE.Vector3(side * 0.6, 0, 0), life: 30 });
    }
  }

  private lastDt = 1 / 60;
  update(dtReal: number) {
    const s = this.state;
    if (s && this.status === "flight") {
      this.prev.copy(this.holder.position);
      const simDt = dtReal * this.warp;
      const n = Math.max(1, Math.ceil(simDt / 0.1));
      for (let i = 0; i < n && s.phase === "ascent"; i++) {
        stepAscent(s, simDt / n, this.rand);
        if (s.stage !== this.lastStage) {
          const seq = s.sequence[this.lastStage];
          for (const j of seq.jettison) this.jettison(j === "b" ? "b" : j);
          this.lastStage = s.stage;
        }
        if (this.hadFairing && !s.fairing) { this.hadFairing = false; this.fairingSep(); }
      }
      if (s.phase !== "ascent") { this.status = "done"; if (s.phase === "failed") this.plume.visible = false; }
      this.lastDt = Math.max(1e-3, dtReal);
      this.place();
      // keep the camera locked on the vehicle
      const d = this.holder.position.clone().sub(this.prev);
      this.camera.position.add(d);
      this.controls.target.add(d);
    }
    if (s && this.status !== "pad") this.frameStack(dtReal);
    const h = s ? Math.hypot(s.x, s.y) - RE : 0;
    // atmosphere & environment by altitude
    const k = Math.min(1, Math.max(0, h / 60000));
    (this.scene.background as THREE.Color | null) ?? (this.scene.background = new THREE.Color());
    (this.scene.background as THREE.Color).copy(this.sky.low).lerp(this.sky.high, Math.pow(k, 0.6));
    (this.scene.fog as THREE.FogExp2).density = 0.00004 * Math.exp(-h / 6000);
    (this.stars.material as THREE.PointsMaterial).opacity = Math.max(0, (k - 0.5) * 2);
    this.stars.position.copy(this.camera.position);
    this.ground.visible = h < 30000;
    this.globe.visible = h > 4000;
    this.hemi.intensity = 0.9 - 0.6 * k;
    this.camera.near = h > 20000 ? 10 : 1;
    this.camera.updateProjectionMatrix();

    // plume grows and widens as ambient pressure falls
    if (this.plume.visible && s) {
      const p = Math.exp(-Math.max(0, h) / 8500);
      const stageR = (this.rocket?.maxDiameter ?? 4) / 2;
      const bottom = this.bottomOfStack();
      const len = (s.stage === 0 ? 30 : 12) * (1 + (1 - p) * 1.2);
      const wid = stageR * (0.7 + (1 - p) * 2.4) * (s.stage === 0 ? 1 : 0.5);
      this.plumeCore.scale.set(wid, len, wid);
      this.plumeCore.position.y = bottom - len / 2;
      this.plumeGlow.position.y = bottom - 4;
      this.plumeGlow.scale.setScalar(wid * 8 + 10);
      (this.plumeCore.material as THREE.MeshBasicMaterial).opacity = (0.55 + 0.3 * Math.random()) * (0.3 + 0.7 * p);
      if (s.phase !== "ascent") this.plume.visible = false;
    }
    // smoke trail below ~45 km
    if (s && this.status === "flight" && h < 45000) {
      this.smokeT += dtReal * this.warp;
      if (this.smokeT > 0.25 && this.smokeN < 2500) {
        this.smokeT = 0;
        const pos = new THREE.Vector3(0, this.bottomOfStack() - 6, 0).applyMatrix4(this.holder.matrixWorld);
        (this.smoke.geometry.attributes.position as THREE.BufferAttribute).setXYZ(this.smokeN++, pos.x + (Math.random() - 0.5) * 6, pos.y, pos.z + (Math.random() - 0.5) * 6);
        this.smoke.geometry.attributes.position.needsUpdate = true;
        this.smoke.geometry.setDrawRange(0, this.smokeN);
      }
    }
    (this.smoke.material as THREE.PointsMaterial).size = 26 + h / 400;
    // debris: ballistic fall (gravity toward Earth centre), tumbling
    for (const d of this.debris) {
      if (d.life <= 0) continue;
      const dt = dtReal * this.warp;
      const c = d.obj.position.clone().add(new THREE.Vector3(0, RE, 0));
      d.v.add(c.normalize().multiplyScalar(-9.8 * dt));
      d.obj.position.addScaledVector(d.v, dt);
      d.obj.rotation.x += d.spin.x * dt; d.obj.rotation.z += d.spin.z * dt;
      d.life -= dtReal;
      if (d.life <= 0) d.obj.visible = false;
    }
    this.controls.update();
  }

  /** Aim at the middle of what is still attached and ease the zoom to its size (after staging). */
  private frameStack(dt: number) {
    if (!this.rocket) return;
    const attached = this.rocket.parts.filter((p) => p.group.parent === this.rocket!.root && p.key !== "b");
    if (!attached.length) return;
    const lo = Math.min(...attached.map((p) => p.base)), hi = Math.max(...attached.map((p) => p.base + p.height));
    this.holder.updateMatrixWorld();
    const centre = new THREE.Vector3(0, (lo + hi) / 2, 0).applyMatrix4(this.holder.matrixWorld);
    const k = Math.min(1, dt * 2);
    const shift = centre.clone().sub(this.controls.target).multiplyScalar(k);
    this.controls.target.add(shift);
    this.camera.position.add(shift);
    const want = Math.max(35, (hi - lo) * 2.6);
    const off = this.camera.position.clone().sub(this.controls.target);
    if (off.length() > want * 1.6) this.camera.position.copy(this.controls.target).add(off.setLength(THREE.MathUtils.lerp(off.length(), want, k * 0.5)));
  }

  /** Lowest point of the parts still attached (for the plume origin), in rocket-local units. */
  private bottomOfStack() {
    if (!this.rocket) return 0;
    const attached = this.rocket.parts.filter((p) => p.group.parent === this.rocket!.root && p.key !== "b" && p.key !== "p");
    return attached.length ? Math.min(...attached.map((p) => p.base)) : 0;
  }

  resize(w: number, h: number) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  setActive(a: boolean) { this.controls.enabled = a; }
}

function smokeTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
