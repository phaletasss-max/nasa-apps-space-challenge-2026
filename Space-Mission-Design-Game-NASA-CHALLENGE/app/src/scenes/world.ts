import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { WORLDS } from "../data/worlds";
import { buildWorld, skybox, spin, tex, type BuiltWorld } from "./bodies";
import { glowSprite, label, type Mode } from "./common";

const R = 10; // planet radius in scene units

/** Close-up of one world, lit from the real Sun direction, with our orbiter circling it. */
export class WorldMode implements Mode {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
  controls: OrbitControls;
  id = "mars";
  date = Date.now();
  rate = 600; // simulated seconds per real second
  private world: BuiltWorld | null = null;
  private sunLight = new THREE.DirectionalLight(0xffffff, 2.6);
  private sunSprite = glowSprite("rgba(255,230,180,0.9)", 60, 1);
  private craft = new THREE.Group();
  private craftAngle = 0;
  private holder = new THREE.Group();

  constructor(dom: HTMLElement) {
    this.camera.position.set(0, 6, 34);
    this.controls = new OrbitControls(this.camera, dom);
    this.controls.enableDamping = true;
    this.controls.minDistance = R * 1.15;
    this.controls.maxDistance = R * 12;
    this.controls.enabled = false;
    this.scene.add(skybox(3000), new THREE.AmbientLight(0xffffff, 0.07), this.sunLight, this.sunSprite, this.holder);
    this.craft.add(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.25), new THREE.MeshStandardMaterial({ color: "#d9dde6", metalness: 0.6, roughness: 0.3 })));
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.02, 0.3), new THREE.MeshStandardMaterial({ color: "#2a4fa8", metalness: 0.3, roughness: 0.4 }));
    this.craft.add(panel, glowSprite("rgba(125,249,255,0.45)", 1.4), label("Tu nave", "label craft"));
    this.scene.add(this.craft);
  }

  /** Show a world; sunDir = direction from the world to the Sun (scene coords of the solar view). */
  setWorld(id: string, dateMs: number, sunDir: THREE.Vector3) {
    this.id = id;
    this.date = dateMs;
    this.holder.clear();
    this.world = buildWorld(id, R, 128);
    if (id === "venus") {
      // show the cloud deck; the radar-mapped surface is what the lander sees
      (this.world.body.material as THREE.MeshStandardMaterial).map = tex("venus_atmosphere.jpg");
    }
    this.holder.add(this.world.root);
    const d = sunDir.clone().normalize();
    this.sunLight.position.copy(d.clone().multiplyScalar(100));
    this.sunSprite.position.copy(d.clone().multiplyScalar(1500));
    if (this.world.sunDir) this.world.sunDir.copy(d);
    const big = WORLDS[id].diameterKm > 50000;
    this.controls.maxDistance = R * (big ? 14 : 12);
    this.camera.position.set(d.x * 20 + 18, 8, d.z * 20 + 24).setLength(R * (id === "saturn" ? 5.2 : 3.4));
    this.controls.target.set(0, 0, 0);
    this.craft.visible = id !== "sun";
    spin(this.world, this.date);
  }

  update(dt: number) {
    this.date += this.rate * 1000 * dt;
    if (this.world) spin(this.world, this.date);
    this.craftAngle += dt * 0.25;
    const r = R * 1.45;
    this.craft.position.set(r * Math.cos(this.craftAngle), r * 0.25 * Math.sin(this.craftAngle), r * Math.sin(this.craftAngle));
    this.craft.lookAt(0, 0, 0);
    this.controls.update();
  }

  resize(w: number, h: number) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  setActive(active: boolean) { this.controls.enabled = active; }
}
