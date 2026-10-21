import * as THREE from "three";
import { spinAngle, WORLDS } from "../data/worlds";

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();

export function tex(file: string): THREE.Texture {
  if (!cache.has(file)) {
    const t = loader.load(`${import.meta.env.BASE_URL}textures/${file}`);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    cache.set(file, t);
  }
  return cache.get(file)!;
}

/** Milky Way sky sphere (rendered behind everything). */
export function skybox(radius: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24),
    new THREE.MeshBasicMaterial({ map: tex("stars_milky_way.jpg"), side: THREE.BackSide, depthWrite: false, color: 0x8a8a9a }));
  m.renderOrder = -1;
  return m;
}

const ATMO_COLOR: Record<string, [string, number]> = {
  earth: ["#5aa8ff", 1.1], venus: ["#ffd99a", 1.4], mars: ["#e8955a", 0.55], jupiter: ["#e6d2b0", 0.45], saturn: ["#f0e2b8", 0.45],
};

/** Fresnel rim glow on a slightly larger sphere (additive). */
export function atmosphere(id: string, radius: number): THREE.Mesh | null {
  const a = ATMO_COLOR[id];
  if (!a) return null;
  const mat = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(a[0]) }, strength: { value: a[1] } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 color; uniform float strength; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - max(dot(vN, vV), 0.0), 3.0) * strength; gl_FragColor = vec4(color * f, f); }`,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.FrontSide,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius * 1.06, 64, 32), mat);
}

/** Earth: day texture on the lit side, city lights on the night side. */
function earthMaterial(sunDir: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { day: { value: tex("earth_daymap.jpg") }, night: { value: tex("earth_nightmap.jpg") }, sunDir: { value: sunDir } },
    vertexShader: `varying vec2 vUv; varying vec3 vNw;
      void main(){ vUv = uv; vNw = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D day; uniform sampler2D night; uniform vec3 sunDir; varying vec2 vUv; varying vec3 vNw;
      void main(){
        float l = dot(normalize(vNw), normalize(sunDir));
        vec3 d = texture2D(day, vUv).rgb * (0.08 + 1.1 * max(l, 0.0));
        vec3 n = texture2D(night, vUv).rgb * 1.6 * smoothstep(0.15, -0.25, l);
        gl_FragColor = vec4(d + n, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

export interface BuiltWorld {
  id: string;
  root: THREE.Group; // positioned in the scene
  tilt: THREE.Group; // obliquity
  body: THREE.Mesh; // spins
  clouds?: THREE.Mesh;
  sunDir?: THREE.Vector3; // world-space direction to the Sun (Earth shader)
}

/** Ring with radial UVs so a 1D ring texture maps from inner to outer edge. */
function ring(inner: number, outer: number): THREE.Mesh {
  const g = new THREE.RingGeometry(inner, outer, 128, 1);
  const pos = g.attributes.position, uv = g.attributes.uv, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5); }
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex("saturn_ring.png"), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

export function buildWorld(id: string, radius: number, segments = 64): BuiltWorld {
  const w = WORLDS[id];
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.rotation.z = (w.tiltDeg * Math.PI) / 180;
  root.add(tilt);
  let body: THREE.Mesh;
  let sunDir: THREE.Vector3 | undefined;
  if (id === "sun") {
    body = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, segments / 2), new THREE.MeshBasicMaterial({ map: tex(w.texture), color: 0xffe0b0 }));
  } else if (id === "earth") {
    sunDir = new THREE.Vector3(1, 0, 0);
    body = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, segments / 2), earthMaterial(sunDir));
  } else {
    body = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, segments / 2),
      new THREE.MeshStandardMaterial({ map: tex(w.texture), roughness: 0.95, metalness: 0 }));
  }
  tilt.add(body);
  const built: BuiltWorld = { id, root, tilt, body, sunDir };
  if (id === "earth") {
    built.clouds = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.012, segments, segments / 2),
      new THREE.MeshStandardMaterial({ alphaMap: tex("earth_clouds.jpg"), color: 0xffffff, transparent: true, depthWrite: false }));
    tilt.add(built.clouds);
  }
  if (id === "saturn") tilt.add(ring(radius * 1.24, radius * 2.27));
  const atmo = atmosphere(id, radius);
  if (atmo) root.add(atmo);
  return built;
}

/** Rotate a built world to its real prime-meridian angle at a date. */
export function spin(w: BuiltWorld, dateMs: number) {
  w.body.rotation.y = spinAngle(WORLDS[w.id], dateMs);
  if (w.clouds) w.clouds.rotation.y = w.body.rotation.y * 1.0003 + dateMs / 3.6e9; // clouds drift slowly
}
