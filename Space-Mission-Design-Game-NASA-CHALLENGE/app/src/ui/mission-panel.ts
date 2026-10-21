import { PLANETS } from "../physics/constants";
import { INSTRUMENTS, LAUNCHERS, type Capture, type Design } from "../mission";
import { fmtDate, fmtDateTime, type SolarMode } from "../scenes/solar";

let update: (() => void) | null = null;
let registered = false;

const TARGETS = ["venus", "mars", "jupiter", "saturn"];
const n = (v: number, d = 0) => v.toLocaleString("es-PE", { maximumFractionDigits: d, minimumFractionDigits: d });

export function renderMissionPanels(left: HTMLElement, right: HTMLElement, solar: SolarMode, design: Design, set: (d: Design) => void) {
  let d = { ...design };
  const commit = (patch: Partial<Design>) => { d = { ...d, ...patch }; set(d); };

  left.innerHTML = `
    <h2>Diseña tu misión</h2>
    <label class="field"><span>Destino</span>
      <select id="target">${TARGETS.map((t) => `<option value="${t}" ${t === d.target ? "selected" : ""}>${PLANETS[t].name.es}</option>`).join("")}</select></label>
    <label class="field"><span>Cohete lanzador (capacidad a órbita baja)</span>
      <select id="launcher">${LAUNCHERS.map((l) => `<option value="${l.id}" ${l.id === d.launcher ? "selected" : ""}>${l.name} · ${n(l.leo / 1000)} t</option>`).join("")}</select></label>
    <fieldset><legend>Instrumentos científicos</legend>
      ${INSTRUMENTS.map((i) => `<label class="check"><input type="checkbox" value="${i.id}" ${d.instruments.includes(i.id) ? "checked" : ""}>
        <span>${i.name}</span><em>${i.mass} kg · ${i.power} W</em></label>`).join("")}
    </fieldset>
    ${slider("propellant", "Combustible", d.propellant, 200, 30000, 100, "kg")}
    ${slider("isp", "Impulso específico del motor (Isp)", d.isp, 220, 460, 5, "s")}
    ${slider("solarArea", "Paneles solares", d.solarArea, 0, 80, 1, "m²")}
    ${slider("rtg", "Generadores nucleares RTG (110 W c/u)", d.rtg, 0, 4, 1, "")}
    <label class="field"><span>Al llegar…</span>
      <select id="capture">
        <option value="flyby" ${d.capture === "flyby" ? "selected" : ""}>Sobrevuelo (no frena: 0 Δv)</option>
        <option value="elliptical" ${d.capture === "elliptical" ? "selected" : ""}>Órbita elíptica (frenado moderado)</option>
        <option value="circular" ${d.capture === "circular" ? "selected" : ""}>Órbita circular baja (frenado fuerte)</option>
      </select></label>
    <p class="hint">Tip: Isp alto = motor más eficiente. Lejos del Sol los paneles rinden poco (cae con 1/d²).</p>`;

  const bindSlider = (id: keyof Design) => {
    const el = left.querySelector<HTMLInputElement>(`#${id}`)!;
    const out = left.querySelector<HTMLElement>(`#${id}-v`)!;
    el.addEventListener("input", () => { out.textContent = n(Number(el.value)); commit({ [id]: Number(el.value) } as Partial<Design>); });
  };
  (["propellant", "isp", "solarArea", "rtg"] as const).forEach(bindSlider);
  left.querySelector<HTMLSelectElement>("#target")!.addEventListener("change", (e) => commit({ target: (e.target as HTMLSelectElement).value }));
  left.querySelector<HTMLSelectElement>("#launcher")!.addEventListener("change", (e) => commit({ launcher: (e.target as HTMLSelectElement).value as Design["launcher"] }));
  left.querySelector<HTMLSelectElement>("#capture")!.addEventListener("change", (e) => commit({ capture: (e.target as HTMLSelectElement).value as Capture }));
  left.querySelectorAll<HTMLInputElement>("fieldset input").forEach((cb) => cb.addEventListener("change", () =>
    commit({ instruments: [...left.querySelectorAll<HTMLInputElement>("fieldset input:checked")].map((x) => x.value) })));

  right.innerHTML = `
    <h2>Plan de vuelo</h2>
    <div class="plan" id="plan"></div>
    <div class="dvbar"><div class="dv-need" id="dv-need"></div><div class="dv-have" id="dv-have"></div></div>
    <div class="dv-legend" id="dv-legend"></div>
    <ul class="checks" id="checks"></ul>
    <div class="row"><button class="primary" id="launch">Lanzar</button><button id="reset">Reiniciar</button></div>
    <h3>Bitácora</h3>
    <ol class="log" id="log"></ol>`;
  right.querySelector("#launch")!.addEventListener("click", () => solar.launch());
  right.querySelector("#reset")!.addEventListener("click", () => solar.reset());

  let lastKey = "";
  update = () => {
    if (!right.querySelector("#plan")) return; // another mode's panels are mounted
    const p = solar.plan;
    const key = JSON.stringify([solar.design, solar.phase, solar.log.length]);
    if (key === lastKey || !p) return;
    lastKey = key;
    const b = p.budget;
    right.querySelector("#plan")!.innerHTML = `
      <div><span>Próxima ventana</span><b>${fmtDate(p.window)}</b></div>
      <div><span>Viaje (Hohmann)</span><b>${n(p.tofDays)} días</b></div>
      <div><span>Masa total</span><b>${n(b.wetMass)} kg</b></div>
      <div><span>Ciencia potencial</span><b>${b.science * 100} pts</b></div>`;
    const max = Math.max(b.dvAvailable, b.dvRequired) * 1.05;
    (right.querySelector("#dv-need") as HTMLElement).style.width = `${(b.dvRequired / max) * 100}%`;
    (right.querySelector("#dv-have") as HTMLElement).style.width = `${(b.dvAvailable / max) * 100}%`;
    right.querySelector("#dv-legend")!.innerHTML =
      `<span class="have">■ Δv disponible ${n(b.dvAvailable / 1000, 2)} km/s</span><span class="need">■ necesario ${n(b.dvRequired / 1000, 2)} km/s (salida ${n(b.dvDeparture / 1000, 2)} + captura ${n(b.dvCapture / 1000, 2)} + 5 %)</span>`;
    right.querySelector("#checks")!.innerHTML = b.checks.map((c) =>
      `<li class="${c.ok ? "ok" : "bad"}"><b>${c.label}</b><span>${c.detail}</span></li>`).join("");
    const launch = right.querySelector<HTMLButtonElement>("#launch")!;
    launch.disabled = solar.phase !== "design";
    launch.textContent = b.feasible ? "Lanzar" : "Lanzar de todos modos";
    left.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select").forEach((el) => (el.disabled = solar.phase !== "design"));
    right.querySelector("#log")!.innerHTML = solar.log.map((l) => `<li class="${l.kind}"><time>${fmtDate(l.date)}</time>${l.text}</li>`).join("");
  };
  if (!registered) { solar.onChange(() => update?.()); registered = true; }
  update();
}

function slider(id: string, labelText: string, value: number, min: number, max: number, step: number, unit: string) {
  return `<label class="field"><span>${labelText} <b><output id="${id}-v">${n(value)}</output> ${unit}</b></span>
    <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
}

let timeUpdate: (() => void) | null = null;
let timeRegistered = false;

export function renderSolarTimebar(bar: HTMLElement, solar: SolarMode) {
  const RATES: [number, string][] = [[1, "1× real"], [3600, "1 h/s"], [86400, "1 día/s"], [864000, "10 d/s"], [2592000, "1 mes/s"], [31557600, "1 año/s"]];
  bar.innerHTML = `
    <button id="play">Pausa</button>
    <button id="now" title="Volver a la fecha y hora actuales">⟳ Ahora</button>
    <span class="date" id="date"></span>
    <div class="speeds">${RATES.map(([v, t]) => `<button data-s="${v}">${t}</button>`).join("")}</div>
    <span class="phase" id="phase"></span>`;
  bar.querySelector("#play")!.addEventListener("click", () => { solar.playing = !solar.playing; });
  bar.querySelector("#now")!.addEventListener("click", () => solar.now());
  bar.querySelectorAll<HTMLButtonElement>("[data-s]").forEach((b) => b.addEventListener("click", () => { solar.rate = Number(b.dataset.s); }));
  const PH: Record<string, string> = { design: "Diseño", "to-window": "Esperando ventana", cruise: "En crucero", arrived: "En destino", failed: "Misión fallida" };
  timeUpdate = () => {
    if (!bar.querySelector("#date")) return;
    bar.querySelector("#date")!.textContent = solar.rate <= 3600 ? fmtDateTime(solar.date) : fmtDate(solar.date);
    bar.querySelector("#play")!.textContent = solar.playing ? "Pausa" : "Reanudar";
    bar.querySelector("#phase")!.textContent = PH[solar.phase];
    (bar.querySelector("#now") as HTMLButtonElement).disabled = solar.phase !== "design";
    bar.querySelectorAll<HTMLButtonElement>("[data-s]").forEach((b) => b.classList.toggle("on", Number(b.dataset.s) === solar.rate));
  };
  if (!timeRegistered) { solar.onChange(() => timeUpdate?.()); timeRegistered = true; }
  timeUpdate();
}
