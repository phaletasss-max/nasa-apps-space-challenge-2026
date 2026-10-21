/**
 * Procedural launch vehicle built from the design (stage diameters/heights come from vehicle.performance()).
 * Each part is its own group so the VAB can show build progress and the launch scene can jettison it.
 * Parts: "b" (boosters), "s0".."sN" (stages), "fairing" or "capsule" (payload section), "p" (payload inside).
 */
import * as THREE from "three";
import { boosterById, engineById, payloadById, type Vehicle } from "../game/catalog";
import { performance } from "../game/vehicle";

const BOOSTER_DIM: Record<string, { d: number; h: number }> = { "srb-s": { d: 1.6, h: 20 }, "srb-l": { d: 3.7, h: 54 } };

export interface RocketPart { key: string; label: string; group: THREE.Group; base: number; height: number; solids: THREE.Mesh[]; wire: THREE.LineSegments[]; minY: number }
export interface RocketModel { root: THREE.Group; parts: RocketPart[]; height: number; maxDiameter: number; engines: THREE.Group[] }

const skin = (propellant: string) =>
  propellant === "hydrolox" ? new THREE.MeshStandardMaterial({ color: "#c8712e", roughness: 0.85 }) // spray-on foam insulation
    : propellant === "methalox" ? new THREE.MeshStandardMaterial({ color: "#b9bec6", roughness: 0.28, metalness: 0.85 }) // stainless steel
      : new THREE.MeshStandardMaterial({ color: "#eceef1", roughness: 0.55 });
const DARK = new THREE.MeshStandardMaterial({ color: "#1c1f26", roughness: 0.6 });
const METAL = new THREE.MeshStandardMaterial({ color: "#6b6f78", roughness: 0.35, metalness: 0.9 });
const WHITE = new THREE.MeshStandardMaterial({ color: "#f2f3f5", roughness: 0.5 });
const BELL = new THREE.MeshStandardMaterial({ color: "#3a2f2a", roughness: 0.4, metalness: 0.7, side: THREE.DoubleSide });
const WIRE = new THREE.LineBasicMaterial({ color: "#5fd3ff", transparent: true, opacity: 0.55 });

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, y: number, part: RocketPart, x = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat.clone());
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  part.group.add(m);
  part.solids.push(m);
  const w = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), WIRE);
  w.position.copy(m.position);
  w.visible = false;
  part.group.add(w);
  part.wire.push(w);
  return m;
}

function newPart(key: string, label: string, base: number, height: number): RocketPart {
  return { key, label, group: new THREE.Group(), base, height, solids: [], wire: [], minY: base };
}

/** Engine bells arranged like real thrust structures (centre + ring, "octaweb"-style for 9). */
function bells(part: RocketPart, count: number, radius: number, y: number, bellR: number, bellH: number) {
  const pos: [number, number][] = [];
  if (count === 1) pos.push([0, 0]);
  else if (count <= 4) for (let i = 0; i < count; i++) pos.push([Math.cos((i / count) * Math.PI * 2 + Math.PI / 4) * radius * 0.5, Math.sin((i / count) * Math.PI * 2 + Math.PI / 4) * radius * 0.5]);
  else { pos.push([0, 0]); for (let i = 0; i < count - 1; i++) pos.push([Math.cos((i / (count - 1)) * Math.PI * 2) * radius * 0.62, Math.sin((i / (count - 1)) * Math.PI * 2) * radius * 0.62]); }
  const geo = new THREE.CylinderGeometry(bellR * 0.35, bellR, bellH, 20, 1, true);
  const g = new THREE.Group();
  for (const [x, z] of pos) g.add(mesh(geo, BELL, y - bellH / 2, part, x, z));
  part.group.add(g);
  return g;
}

export function buildRocket(v: Vehicle): RocketModel {
  const perf = performance(v);
  const root = new THREE.Group();
  const parts: RocketPart[] = [];
  const engines: THREE.Group[] = [];
  const core = perf.stages.filter((s) => s.label !== "Boosters");
  let y = 0, maxD = 0;
  core.forEach((s, i) => {
    const spec = v.stages[i], e = engineById(spec.engine);
    const r = s.diameter / 2;
    maxD = Math.max(maxD, s.diameter);
    const bellH = Math.min(4, 1.2 + (e.ispVac > 340 ? 1.8 : 0.6) + (e.thrustVac > 1500 ? 0.8 : 0));
    const bellR = Math.min(r * (spec.count === 1 ? 0.7 : 0.28), e.thrustVac > 1500 ? 1.2 : 0.75) + (spec.count === 1 && e.ispVac > 340 ? 0.4 : 0);
    const start = i === 0 ? bellH : y;
    const part = newPart(`s${i}`, `Etapa ${i + 1}`, start - (i === 0 ? bellH : 0), s.height + (i === 0 ? bellH : 0));
    engines.push(bells(part, spec.count, r, start, bellR, bellH));
    mesh(new THREE.CylinderGeometry(r, r, s.height, 48), skin(e.propellant), start + s.height / 2, part);
    // dark interstage band at the top of each stage, plus a thin ring at the base
    mesh(new THREE.CylinderGeometry(r * 1.002, r * 1.002, Math.min(3, s.height * 0.08), 48), DARK, start + s.height - Math.min(3, s.height * 0.08) / 2, part);
    mesh(new THREE.CylinderGeometry(r * 1.01, r * 1.01, 0.4, 48), METAL, start + 0.2, part);
    // interstage adapter when the next stage is narrower
    const next = core[i + 1];
    let top = start + s.height;
    if (next && next.diameter < s.diameter - 0.05) {
      const h = (s.diameter - next.diameter) * 0.9 + 0.5;
      mesh(new THREE.CylinderGeometry(next.diameter / 2, r, h, 48), DARK, top + h / 2, part);
      top += h;
    }
    part.height = top - part.base;
    y = top;
    parts.push(part);
  });

  // ---- payload section
  const pay = payloadById(v.payload);
  const topR = core[core.length - 1].diameter / 2;
  if (pay.crew) {
    const part = newPart("capsule", "Cápsula y módulo de servicio", y, 0);
    const smH = 4, cr = Math.max(2.5, topR);
    mesh(new THREE.CylinderGeometry(cr, topR, 1.2, 48), DARK, y + 0.6, part);
    mesh(new THREE.CylinderGeometry(cr, cr, smH, 48), WHITE, y + 1.2 + smH / 2, part);
    const cy = y + 1.2 + smH;
    mesh(new THREE.CylinderGeometry(cr * 0.38, cr, 3.3, 48), new THREE.MeshStandardMaterial({ color: "#d8dadf", roughness: 0.4, metalness: 0.3 }), cy + 1.65, part);
    // launch abort system tower
    mesh(new THREE.CylinderGeometry(0.35, cr * 0.4, 2.2, 24), WHITE, cy + 3.3 + 1.1, part);
    mesh(new THREE.CylinderGeometry(0.25, 0.35, 5.5, 16), WHITE, cy + 4.4 + 2.75, part);
    mesh(new THREE.ConeGeometry(0.25, 1.4, 16), DARK, cy + 9.9 + 0.7, part);
    if (pay.kind === "crew-lander") mesh(new THREE.CylinderGeometry(cr, cr, 6, 48), WHITE, y - 0.01, part);
    part.height = cy + 11.3 - y;
    parts.push(part);
    y += part.height;
  } else {
    const fr = Math.max(topR, 2.1);
    const part = newPart("fairing", "Carenado de carga útil", y, 0);
    if (fr > topR + 0.05) mesh(new THREE.CylinderGeometry(fr, topR, 1.2, 48), DARK, y + 0.6, part);
    const base = y + (fr > topR + 0.05 ? 1.2 : 0);
    const cylH = 5 + pay.mass / 1500;
    const pts: THREE.Vector2[] = [];
    for (let k = 0; k <= 24; k++) { const t = k / 24; pts.push(new THREE.Vector2(fr * Math.sqrt(Math.max(0, 1 - t * t)) * 0.98 + 0.02 * fr, cylH + t * fr * 2.2)); }
    pts.unshift(new THREE.Vector2(fr, 0));
    for (const side of [0, 1]) {
      const half = mesh(new THREE.LatheGeometry(pts, 32, side * Math.PI, Math.PI), WHITE, base, part);
      half.name = `half${side}`;
    }
    // payload inside (visible in the VAB through the blueprint)
    const inner = newPart("p", pay.name, base, 3);
    mesh(new THREE.BoxGeometry(fr * 0.9, Math.min(cylH, 4), fr * 0.9), new THREE.MeshStandardMaterial({ color: "#d4a542", roughness: 0.3, metalness: 0.7 }), base + Math.min(cylH, 4) / 2 + 0.3, inner);
    inner.group.visible = false;
    parts.push(inner);
    part.height = base + cylH + fr * 2.2 - y;
    parts.push(part);
    y += part.height;
  }

  // ---- boosters strapped to the first stage
  if (v.boosters && v.boosters.count) {
    const b = boosterById(v.boosters.id), dim = BOOSTER_DIM[b.id] ?? { d: 2, h: 25 };
    const part = newPart("b", `${v.boosters.count} × ${b.name}`, 0, dim.h + 3);
    const coreR = core[0].diameter / 2;
    for (let i = 0; i < v.boosters.count; i++) {
      const a = (i / v.boosters.count) * Math.PI * 2 + Math.PI / 2;
      const x = Math.cos(a) * (coreR + dim.d / 2 + 0.15), z = Math.sin(a) * (coreR + dim.d / 2 + 0.15);
      mesh(new THREE.CylinderGeometry(dim.d * 0.42, dim.d * 0.55, 2, 20, 1, true), BELL, 1, part, x, z);
      mesh(new THREE.CylinderGeometry(dim.d / 2, dim.d / 2, dim.h, 28), WHITE, 2 + dim.h / 2, part, x, z);
      mesh(new THREE.ConeGeometry(dim.d / 2, dim.d * 1.4, 28), WHITE, 2 + dim.h + dim.d * 0.7, part, x, z);
      for (const k of [0.3, 0.6]) mesh(new THREE.CylinderGeometry(dim.d / 2 + 0.03, dim.d / 2 + 0.03, 0.35, 28), DARK, 2 + dim.h * k, part, x, z);
    }
    parts.unshift(part);
  }

  for (const p of parts) { root.add(p.group); p.minY = new THREE.Box3().setFromObject(p.group).min.y; }
  return { root, parts, height: y, maxDiameter: maxD, engines };
}

/** Show a part as a blueprint (wireframe) with the solid "growing" from the bottom up to `progress`. */
export function setPartProgress(p: RocketPart, progress: number, worldBaseY: number) {
  const done = progress >= 1;
  const cut = worldBaseY + p.height * progress;
  for (const w of p.wire) w.visible = !done;
  for (const m of p.solids) {
    const mat = m.material as THREE.MeshStandardMaterial;
    m.visible = progress > 0.001;
    const plane: THREE.Plane = (m.userData.clip ??= new THREE.Plane(new THREE.Vector3(0, -1, 0), 0));
    plane.constant = cut;
    const want = done ? null : [plane];
    if ((mat.clippingPlanes === null || mat.clippingPlanes.length === 0) !== (want === null)) { mat.clippingPlanes = want; mat.needsUpdate = true; }
  }
}
