import type { OrbitMode } from "../scenes/orbit";

let update: (() => void) | null = null;
let registered = false;
let step = 50; // m/s per burn

const km = (m: number) => (Number.isFinite(m) ? Math.round(m / 1000).toLocaleString("es-PE") : "∞");

export function renderOrbitPanels(left: HTMLElement, right: HTMLElement, o: OrbitMode) {
  left.innerHTML = `
    <h2>Pilotea la nave</h2>
    <p class="hint">Cada impulso cambia tu órbita al instante (maniobra impulsiva). Las maniobras rinden más en el periapsis: es el efecto Oberth.</p>
    <label class="field"><span>Tamaño del impulso</span>
      <div class="seg" id="steps">${[10, 50, 100, 500].map((s) => `<button data-v="${s}" class="${s === step ? "on" : ""}">${s} m/s</button>`).join("")}</div></label>
    <div class="burns">
      <button data-b="pro" title="W">Progrado <kbd>W</kbd></button>
      <button data-b="retro" title="S">Retrógrado <kbd>S</kbd></button>
      <button data-b="out" title="D">↗ Radial afuera <kbd>D</kbd></button>
      <button data-b="in" title="A">↙ Radial adentro <kbd>A</kbd></button>
    </div>
    <h3>Escenarios</h3>
    <div class="row wrap">
      <button data-p="leo">Órbita baja (400 km, como la ISS)</button>
      <button data-p="gto">Transferencia a GEO</button>
      <button data-p="geo">Geoestacionaria</button>
    </div>
    <p class="hint">Tu nave tiene ~2.9 km/s de Δv. Desde 400 km no alcanza para GEO (~3.9 km/s) ni para escapar (~3.2 km/s):
      empieza desde <b>Transferencia a GEO</b> y quema en el apogeo para circularizar, o en el perigeo para escapar (Oberth).</p>
    <p class="hint">Naranja punteado = órbita prevista · cian = rastro real · amarillo = anillo GEO.</p>`;
  left.querySelectorAll<HTMLButtonElement>("#steps button").forEach((b) => b.addEventListener("click", () => {
    step = Number(b.dataset.v);
    left.querySelectorAll("#steps button").forEach((x) => x.classList.toggle("on", x === b));
  }));
  left.querySelectorAll<HTMLButtonElement>("[data-b]").forEach((b) => b.addEventListener("click", () => fire(o, b.dataset.b!)));
  left.querySelectorAll<HTMLButtonElement>("[data-p]").forEach((b) => b.addEventListener("click", () => o.preset(b.dataset.p as "leo" | "gto" | "geo")));

  right.innerHTML = `
    <h2>Telemetría</h2>
    <div class="status" id="status"></div>
    <div class="telemetry" id="tele"></div>
    <div class="fuel"><div id="fuel"></div></div>
    <h3>Objetivos</h3>
    <ul class="goals" id="goals"></ul>`;

  update = () => {
    if (!right.querySelector("#tele")) return; // another mode's panels are mounted
    const el = o.elements;
    const STATUS: Record<string, [string, string]> = {
      flying: ["ok", "En órbita"], crashed: ["bad", "Impacto con la Tierra"], reentry: ["warn", "Reentrada atmosférica"],
      escaped: ["ok", "Escape de la Tierra"],
    };
    const [cls, txt] = el.e >= 1 && o.status === "flying" ? ["ok", "Trayectoria de escape (hiperbólica)"] : STATUS[o.status];
    right.querySelector("#status")!.className = `status ${cls}`;
    right.querySelector("#status")!.textContent = txt;
    right.querySelector("#tele")!.innerHTML = [
      ["Altitud", `${km(o.altitude)} km`], ["Velocidad", `${(o.speed / 1000).toFixed(2)} km/s`],
      ["Periapsis", `${km(el.rp - 6.371e6)} km`], ["Apoapsis", `${km(el.ra - 6.371e6)} km`],
      ["Periodo", Number.isFinite(el.period) ? `${(el.period / 3600).toFixed(2)} h` : "—"], ["Excentricidad", el.e.toFixed(3)],
      ["Δv restante", `${(o.dvLeft / 1000).toFixed(2)} km/s`], ["Δv usado", `${(o.dvUsed / 1000).toFixed(2)} km/s`],
    ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("");
    (right.querySelector("#fuel") as HTMLElement).style.width = `${(o.craft.prop / 1500) * 100}%`;
    right.querySelector("#goals")!.innerHTML = o.goals.map((g) => `<li class="${g.done ? "done" : ""}">${g.done ? "Cumplido:" : "Pendiente:"} ${g.text}</li>`).join("");
  };
  if (!registered) { o.onChange(() => update?.()); registered = true; }
  update();
}

function fire(o: OrbitMode, kind: string) {
  const [p, r] = kind === "pro" ? [step, 0] : kind === "retro" ? [-step, 0] : kind === "out" ? [0, step] : [0, -step];
  if (!o.doBurn(p, r)) document.body.animate([{ filter: "hue-rotate(0)" }, { filter: "hue-rotate(160deg)" }, { filter: "none" }], 300);
}

export function bindOrbitKeys(o: OrbitMode, isActive: () => boolean) {
  window.addEventListener("keydown", (e) => {
    if (!isActive() || (e.target as HTMLElement).tagName === "INPUT") return;
    const k = { w: "pro", s: "retro", d: "out", a: "in" }[e.key.toLowerCase()];
    if (k) fire(o, k);
  });
}

let timeUpdate: (() => void) | null = null;
let timeRegistered = false;

export function renderOrbitTimebar(bar: HTMLElement, o: OrbitMode) {
  bar.innerHTML = `
    <span class="date" id="t"></span>
    <div class="speeds">${[1, 10, 60, 600, 3600].map((s) => `<button data-w="${s}">${s}×</button>`).join("")}</div>
    <span class="phase">Tiempo acelerado: ${"<b id='w'></b>"}</span>`;
  bar.querySelectorAll<HTMLButtonElement>("[data-w]").forEach((b) => b.addEventListener("click", () => { o.warp = Number(b.dataset.w); }));
  timeUpdate = () => {
    if (!bar.querySelector("#t")) return;
    const h = Math.floor(o.t / 3600), m = Math.floor((o.t % 3600) / 60);
    bar.querySelector("#t")!.textContent = `T+ ${h} h ${String(m).padStart(2, "0")} min`;
    bar.querySelector("#w")!.textContent = `${o.warp}×`;
    bar.querySelectorAll<HTMLButtonElement>("[data-w]").forEach((b) => b.classList.toggle("on", Number(b.dataset.w) === o.warp));
  };
  if (!timeRegistered) { o.onChange(() => timeUpdate?.()); timeRegistered = true; }
  timeUpdate();
}
