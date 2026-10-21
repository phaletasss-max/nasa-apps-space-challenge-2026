import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

/** Random starfield on a large sphere. */
export function starfield(count = 4000, radius = 900): THREE.Points {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1, phi = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos.set([radius * s * Math.cos(phi), radius * u, radius * s * Math.sin(phi)], i * 3);
    const t = Math.random();
    col.set(t < 0.15 ? [1, 0.85, 0.7] : t < 0.3 ? [0.75, 0.85, 1] : [1, 1, 1], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.85 }));
}

/** Soft radial glow sprite (additive), e.g. for the Sun or an atmosphere halo. */
export function glowSprite(color: string, size: number, strength = 1): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, `rgba(255,255,255,${strength})`);
  grad.addColorStop(0.2, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  sprite.scale.set(size, size, 1);
  return sprite;
}

/** HTML label that follows a 3D object. */
export function label(text: string, cls = "label"): CSS2DObject {
  const el = document.createElement("div");
  el.className = cls;
  el.textContent = text;
  const o = new CSS2DObject(el);
  o.center.set(0.5, -0.6);
  return o;
}

/** Polyline from points (updatable). */
export function line(points: THREE.Vector3[], color: string, opacity = 0.6, dashed = false): THREE.Line {
  const g = new THREE.BufferGeometry().setFromPoints(points);
  const m = dashed
    ? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 0.6, gapSize: 0.4 })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  const l = new THREE.Line(g, m);
  if (dashed) l.computeLineDistances();
  return l;
}

export function setLine(l: THREE.Line, points: THREE.Vector3[]) {
  l.geometry.dispose();
  l.geometry = new THREE.BufferGeometry().setFromPoints(points);
  if (l.material instanceof THREE.LineDashedMaterial) l.computeLineDistances();
}

export interface Mode {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  update(dtReal: number): void;
  resize(w: number, h: number): void;
  setActive(active: boolean): void;
}
