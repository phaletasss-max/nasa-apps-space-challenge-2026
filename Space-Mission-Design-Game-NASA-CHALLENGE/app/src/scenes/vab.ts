/**
 * Vehicle Assembly Building: the rocket being designed and built. Parts in production are drawn as a
 * blueprint and "grow" with their task progress; before stacking they stand separately on the floor,
 * after the stacking task they are lifted into the integrated vehicle.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Assembly } from "../game/assembly";
import type { Vehicle } from "../game/catalog";
import { label, type Mode } from "./common";
import { buildRocket, setPartProgress, type RocketModel } from "./rocket";

export type VabView = "design" | "build" | "ready";

export class VabMode implements Mode {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 1, 0.5, 2000);
  controls: OrbitControls;
  private rocket: RocketModel | null = null;
  private key = "";
  private targets = new Map<string, THREE.Vector3>();
  private progress = new Map<string, number>();
  private labels: THREE.Object3D[] = [];
  private platforms = new THREE.Group();
  private crane = new THREE.Group();
  private t = 0;

  constructor(dom: HTMLElement) {
    this.controls = new OrbitControls(this.camera, dom);
    this.controls.enableDamping = true;
    this.controls.enabled = false;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.minDistance = 15;
    this.controls.maxDistance = 260;
    this.scene.background = new THREE.Color("#0b0e14");
    this.scene.fog = new THREE.Fog("#0b0e14", 160, 420);
    this.buildHall();
  }

  private buildHall() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xbfd4ff, 0x20242c, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(40, 140, 60);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -90, right: 90, top: 160, bottom: -20, near: 10, far: 400 });
    s.add(key, key.target);
    for (const [x, z] of [[-45, -30], [45, -30], [-45, 40], [45, 40]]) {
      const l = new THREE.PointLight(0xffe6c0, 600, 160, 1.6);
      l.position.set(x, 120, z);
      s.add(l);
    }
    // floor with painted grid and the mobile launcher base
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: "#2a2e36", roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);
    const grid = new THREE.GridHelper(400, 80, "#3c4250", "#30353f");
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.5;
    grid.position.y = 0.02;
    s.add(grid);
    const ml = new THREE.Mesh(new THREE.BoxGeometry(34, 2, 34), new THREE.MeshStandardMaterial({ color: "#3b3f47", roughness: 0.7, metalness: 0.4 }));
    ml.position.y = -0.99;
    ml.receiveShadow = true;
    s.add(ml);
    // hall walls (cut-away: back and sides only) with vertical ribs
    const wallMat = new THREE.MeshStandardMaterial({ color: "#1a1e26", roughness: 0.95, side: THREE.DoubleSide });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(240, 170), wallMat);
    back.position.set(0, 85, -90);
    s.add(back);
    for (const x of [-120, 120]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(200, 170), wallMat);
      side.rotation.y = Math.PI / 2;
      side.position.set(x, 85, 10);
      s.add(side);
    }
    const ribMat = new THREE.MeshStandardMaterial({ color: "#2b313c", roughness: 0.7, metalness: 0.5 });
    for (let x = -110; x <= 110; x += 20) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(1.4, 170, 1.4), ribMat);
      rib.position.set(x, 85, -89);
      s.add(rib);
    }
    // stripe: "safety yellow" line around the work cell
    const stripe = new THREE.Mesh(new THREE.RingGeometry(26, 26.6, 64), new THREE.MeshBasicMaterial({ color: "#c9a227" }));
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.y = 0.03;
    s.add(stripe);
    // overhead bridge crane
    const beam = new THREE.Mesh(new THREE.BoxGeometry(220, 3, 4), ribMat);
    beam.position.y = 150;
    const trolley = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 8), new THREE.MeshStandardMaterial({ color: "#c9a227", roughness: 0.6 }));
    trolley.position.y = 147;
    this.crane.add(beam, trolley);
    s.add(this.crane);
    s.add(this.platforms);
  }

  /** Rebuild the vehicle when its design changes. */
  setVehicle(v: Vehicle) {
    const k = JSON.stringify(v);
    if (k === this.key) return;
    this.key = k;
    if (this.rocket) this.scene.remove(this.rocket.root);
    this.labels.forEach((l) => l.removeFromParent());
    this.labels = [];
    this.rocket = buildRocket(v);
    this.scene.add(this.rocket.root);
    this.targets.clear();
    for (const p of this.rocket.parts) {
      const l = label(p.label, "label part");
      l.position.set(0, p.base + p.height + 1.5, 0);
      p.group.add(l);
      this.labels.push(l);
    }
    this.buildPlatforms(this.rocket.height, this.rocket.maxDiameter);
    this.frame();
  }

  private buildPlatforms(height: number, d: number) {
    this.platforms.clear();
    const mat = new THREE.MeshStandardMaterial({ color: "#4a505c", roughness: 0.6, metalness: 0.6 });
    const glow = new THREE.MeshBasicMaterial({ color: "#ffb347" });
    const r = d / 2 + 3.5;
    for (let y = 12; y < height; y += 14) {
      for (const side of [-1, 1]) {
        const deck = new THREE.Mesh(new THREE.BoxGeometry(10, 0.6, r * 2 + 6), mat);
        deck.position.set(side * (r + 5), y, 0);
        deck.castShadow = true;
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, r * 2 + 6), glow);
        lamp.position.set(side * (r + 0.2), y + 0.5, 0);
        this.platforms.add(deck, lamp);
      }
    }
    for (const x of [-(r + 10), r + 10]) for (const z of [-(r + 3), r + 3]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(1.2, height + 10, 1.2), mat);
      col.position.set(x, (height + 10) / 2, z);
      this.platforms.add(col);
    }
  }

  private frame() {
    if (!this.rocket) return;
    const h = this.rocket.height;
    this.controls.target.set(0, h * 0.48, 0);
    const dist = Math.max(90, h * 2.3);
    this.camera.position.set(dist * 0.6, h * 0.7, dist * 0.8);
  }

  /** Apply the build state: design (solid concept), production progress, or fully integrated. */
  setState(view: VabView, assembly: Assembly | null) {
    if (!this.rocket) return;
    const prog = (ids: string[]) => {
      if (!assembly) return 1;
      const ts = assembly.tasks.filter((t) => ids.some((id) => t.id.startsWith(id)));
      const total = ts.reduce((s, t) => s + t.days, 0);
      return total ? ts.reduce((s, t) => s + t.progress * t.days, 0) / total : 1;
    };
    const stacked = view !== "build" || !!assembly?.tasks.find((t) => t.id === "stack" && t.status === "done");
    const fairingOn = view !== "build" || !!assembly?.tasks.find((t) => t.id === "fairing" && t.status === "done");
    // floor layout while parts are built separately
    const floorParts = this.rocket.parts.filter((p) => p.key !== "p");
    let x = -((floorParts.length - 1) * 18) / 2;
    this.platforms.visible = stacked;
    for (const p of this.rocket.parts) {
      let progress = 1;
      if (view === "build") {
        if (p.key === "b") progress = prog(["b-"]);
        else if (p.key.startsWith("s")) progress = prog([`${p.key}-`]);
        else if (p.key === "p") progress = prog(["p-"]);
        else progress = fairingOn ? 1 : 0; // fairing / capsule closes out in the integration task
      }
      if (p.key === "p") {
        // the payload sits inside the fairing: visible only while the fairing is not yet closed
        p.group.visible = view === "build" && !fairingOn;
        const fairing = this.rocket.parts.find((q) => q.key === "fairing" || q.key === "capsule")!;
        this.targets.set(p.key, stacked ? new THREE.Vector3() : new THREE.Vector3(this.targets.get(fairing.key)?.x ?? x, -fairing.minY, 0));
      } else {
        this.targets.set(p.key, stacked ? new THREE.Vector3() : new THREE.Vector3(x, -p.minY, 0));
        x += 18;
      }
      this.progress.set(p.key, progress);
    }
  }

  update(dt: number) {
    this.t += dt;
    if (this.rocket) for (const p of this.rocket.parts) {
      const tgt = this.targets.get(p.key);
      if (tgt) p.group.position.lerp(tgt, Math.min(1, dt * 1.5));
      setPartProgress(p, this.progress.get(p.key) ?? 1, p.group.position.y + p.base);
    }
    this.crane.position.x = Math.sin(this.t * 0.15) * 30;
    this.controls.update();
  }

  resize(w: number, h: number) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  setActive(a: boolean) { this.controls.enabled = a; }
}
