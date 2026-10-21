import { WORLDS } from "../data/worlds";
import { density, fmtTime, gravity, type LandingBody } from "../physics/landing";
import type { SolarMode } from "../scenes/solar";
import type { WorldMode } from "../scenes/world";
import type { LandingMode } from "../scenes/landing";

const n = (v: number, d = 0) => v.toLocaleString("es-PE", { maximumFractionDigits: d, minimumFractionDigits: d });
const lightTime = (au: number) => { const s = au * 499.005; return s < 120 ? `${n(s, 1)} s` : s < 7200 ? `${n(s / 60, 1)} min` : `${n(s / 3600, 1)} h`; };

function facts(id: string) {
  const w = WORLDS[id];
  return `
    <div class="facts">
      <div><span>Diámetro</span><b>${n(w.diameterKm)} km</b></div>
      <div><span>Gravedad</span><b>${n(w.gravity, 1)} m/s² <small>(${n(w.gravity / 9.81, 2)} g)</small></b></div>
      <div><span>Día</span><b>${w.dayHours}</b></div>
      <div><span>Año</span><b>${w.yearDays ? `${n(w.yearDays, w.yearDays < 1000 ? 1 : 0)} días` : "—"}</b></div>
      <div><span>Temperatura</span><b>${w.tempC}</b></div>
      <div><span>Lunas</span><b>${w.moons}</b></div>
    </div>
    <p class="atmo"><b>Atmósfera:</b> ${w.atmosphere}</p>
    <p class="atmo"><b>Misiones:</b> ${w.missions}</p>
    <p class="fact">${w.fact}</p>`;
}

// ------------------------------------------------------------------ planet card (solar view)
let cardKey = "";
export function updatePlanetCard(card: HTMLElement, solar: SolarMode, onEnter: (id: string) => void) {
  const id = solar.selected;
  if (!id) { card.hidden = true; cardKey = ""; return; }
  card.hidden = false;
  if (cardKey !== id) {
    cardKey = id;
    const w = WORLDS[id];
    card.innerHTML = `
      <button class="x" id="card-x" aria-label="Cerrar">Cerrar</button>
      <div class="eyebrow">${w.kind}</div>
      <h2>${w.name}</h2>
      <div class="live" id="card-live"></div>
      ${facts(id)}
      <div class="row">
        <button id="card-follow"></button>
        ${id !== "sun" ? `<button class="primary" id="card-enter">Entrar al mundo</button>` : ""}
      </div>`;
    card.querySelector("#card-x")!.addEventListener("click", () => solar.select(null));
    card.querySelector("#card-follow")!.addEventListener("click", () => { solar.follow = !solar.follow; });
    card.querySelector("#card-enter")?.addEventListener("click", () => onEnter(id));
  }
  const d = solar.distancesAU(id);
  card.querySelector("#card-live")!.innerHTML = id === "sun"
    ? `<span>Luz del Sol a la Tierra: <b>8.3 min</b></span>`
    : `<span>Al Sol: <b>${n(d.sun, 3)} UA</b></span>${id !== "earth" ? `<span>A la Tierra: <b>${id === "moon" ? `${n(d.earth * 149597870.7)} km` : `${n(d.earth, 3)} UA`}</b></span>
       <span>Señal de radio: <b>${lightTime(d.earth)}</b> en llegar</span>` : ""}`;
  card.querySelector("#card-follow")!.textContent = solar.follow ? "Siguiendo" : "Seguir";
}

// ------------------------------------------------------------------ world view HUD
export function renderWorldHud(hud: HTMLElement, world: WorldMode, onLand: (b: LandingBody) => void, onBack: () => void) {
  const w = WORLDS[world.id];
  hud.innerHTML = `
    <div class="hud-card left">
      <button class="back" id="back">Sistema solar</button>
      <div class="eyebrow">${w.kind}</div>
      <h2>${w.name}</h2>
      ${facts(world.id)}
      ${w.landing ? `<button class="primary big" id="land">Simular el aterrizaje</button>
        <p class="hint">${w.landing === "mars" ? "Entrada, paracaídas, motores y grúa aérea: los «7 minutos de terror» de Perseverance." :
          w.landing === "moon" ? "Pilota el módulo lunar (o deja el piloto automático), con combustible justo como el Apollo 11." :
          "Descenso tipo Venera: 1 hora cayendo por nubes de ácido hasta 460 °C."}</p>`
        : `<p class="nolanding">${w.noLanding}</p>`}
      <div class="speeds" id="wspeeds">${[[60, "1 min/s"], [600, "10 min/s"], [3600, "1 h/s"], [21600, "6 h/s"]].map(([v, t]) => `<button data-r="${v}">${t}</button>`).join("")}</div>
      <p class="hint">Arrastra para girar alrededor · rueda para acercarte. El planeta gira a su ritmo real acelerado.</p>
    </div>`;
  hud.querySelector("#back")!.addEventListener("click", onBack);
  hud.querySelector("#land")?.addEventListener("click", () => onLand(w.landing!));
  const sync = () => hud.querySelectorAll<HTMLButtonElement>("[data-r]").forEach((b) => b.classList.toggle("on", Number(b.dataset.r) === world.rate));
  hud.querySelectorAll<HTMLButtonElement>("[data-r]").forEach((b) => b.addEventListener("click", () => { world.rate = Number(b.dataset.r); sync(); }));
  sync();
}

// ------------------------------------------------------------------ landing HUD
const PHASE: Record<string, string> = {
  entry: "Entrada atmosférica", parachute: "Paracaídas", freefall: "Caída con disco de frenado", powered: "Descenso propulsado",
  skycrane: "Grúa aérea", descent: "Descenso propulsado", landed: "En la superficie", crashed: "Impacto",
};

let lastEvents = -1;
export function renderLandingHud(hud: HTMLElement, L: LandingMode, actions: { back: () => void; retry: () => void; base: (() => void) | null }) {
  const body = L.body;
  lastEvents = -1;
  hud.innerHTML = `
    <div class="hud-card left landing">
      <button class="back" id="back">Volver al mundo</button>
      <div class="phase-badge" id="phase"></div>
      <div class="tele" id="tele"></div>
      ${body === "moon" ? `
        <div class="pilot">
          <div class="seg"><button id="auto">Automático</button><button id="manual">Manual</button></div>
          <p class="hint" id="keys">Manual: <kbd>W</kbd>/<kbd>S</kbd> empuje · <kbd>A</kbd>/<kbd>D</kbd> inclinar el motor (frenar lo horizontal)</p>
          <div class="bar"><span>Empuje</span><i id="thr"></i></div>
        </div>` : ""}
      <div class="bar fuel"><span>Combustible</span><i id="fuel"></i></div>
      <div class="speeds">${[[1, "1× real"], [2, "2×"], [5, "5×"], [20, "20×"], [60, "60×"]].map(([v, t]) => `<button data-w="${v}">${t}</button>`).join("")}</div>
    </div>
    <div class="hud-card right landing-log"><h3>Bitácora de descenso</h3><ol id="events"></ol></div>
    <div class="result" id="result" hidden></div>`;
  hud.querySelector("#back")!.addEventListener("click", actions.back);
  hud.querySelectorAll<HTMLButtonElement>("[data-w]").forEach((b) => b.addEventListener("click", () => { L.warp = Number(b.dataset.w); }));
  if (body === "moon") {
    hud.querySelector("#auto")!.addEventListener("click", () => { L.ctrl.auto = true; });
    hud.querySelector("#manual")!.addEventListener("click", () => { L.ctrl.auto = false; L.ctrl.throttle = L.s.throttle; L.ctrl.pitch = L.s.pitch; });
  }
  const R = hud.querySelector<HTMLElement>("#result")!;
  return () => {
    const s = L.s;
    hud.querySelector("#phase")!.textContent = PHASE[s.phase] ?? s.phase;
    const rho = density(body, s.h);
    const rows: [string, string][] = [
      ["T+", fmtTime(s.t)], ["Altitud", s.h > 5000 ? `${n(s.h / 1000, 1)} km` : `${n(s.h)} m`],
      ["Vel. vertical", `${n(-s.vz, Math.abs(s.vz) < 20 ? 1 : 0)} m/s ↓`], ["Vel. horizontal", `${n(s.vx, Math.abs(s.vx) < 20 ? 1 : 0)} m/s`],
    ];
    if (body !== "moon") rows.push(["Carga g", `${n(s.gload, 1)} g (máx ${n(s.peakG, 0)})`], ["Calentamiento", `${n(s.heat)} W/cm²`], ["Densidad aire", `${rho < 0.01 ? rho.toExponential(1) : n(rho, 3)} kg/m³`]);
    else rows.push(["Gravedad", `${gravity("moon")} m/s²`], ["Inclinación", `${n((s.pitch * 180) / Math.PI)}°`]);
    hud.querySelector("#tele")!.innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("");
    const fuelMax = body === "moon" ? 900 : 390;
    (hud.querySelector("#fuel") as HTMLElement).style.width = `${body === "venus" ? 0 : (s.fuel / fuelMax) * 100}%`;
    (hud.querySelector(".fuel") as HTMLElement).style.display = body === "venus" ? "none" : "";
    if (body === "moon") {
      (hud.querySelector("#thr") as HTMLElement).style.width = `${s.throttle * 100}%`;
      hud.querySelector("#auto")!.classList.toggle("on", L.ctrl.auto);
      hud.querySelector("#manual")!.classList.toggle("on", !L.ctrl.auto);
    }
    hud.querySelectorAll<HTMLButtonElement>("[data-w]").forEach((b) => b.classList.toggle("on", Number(b.dataset.w) === L.warp));
    if (s.events.length !== lastEvents) {
      lastEvents = s.events.length;
      hud.querySelector("#events")!.innerHTML = [...s.events].reverse().map((e) => `<li><time>T+ ${fmtTime(e.t)}</time>${e.text}</li>`).join("");
    }
    const done = s.phase === "landed" || s.phase === "crashed";
    if (done && R.hidden) {
      R.hidden = false;
      const ok = s.phase === "landed";
      const extra = body === "venus" && ok ? "<p>En la superficie: 460 °C y 92 bar. Venera 13 transmitió durante 127 minutos antes de rendirse al calor.</p>" :
        body === "mars" && ok ? "<p>La etapa de descenso se aleja volando y se estrella a distancia segura. En la Tierra lo sabrán unos minutos después: la señal viaja a la velocidad de la luz.</p>" :
        body === "moon" && ok ? "<p>«Houston, aquí Base Tranquilidad. El Águila ha alunizado.» — Apollo 11, 1969.</p>" : "";
      R.innerHTML = `<div class="card"><h2>${ok ? "Aterrizaje exitoso" : "Aterrizaje fallido"}</h2><p>${s.result}</p>${extra}
        <div class="row"><button id="retry">Reintentar</button>${ok && actions.base ? `<button class="primary" id="base">Construir una base aquí</button>` : ""}<button id="back2">Volver al mundo</button></div></div>`;
      R.querySelector("#retry")!.addEventListener("click", () => { R.hidden = true; actions.retry(); });
      R.querySelector("#back2")!.addEventListener("click", actions.back);
      R.querySelector("#base")?.addEventListener("click", actions.base!);
    } else if (!done && !R.hidden) R.hidden = true;
  };
}

/** Manual lunar controls (W/S throttle, A/D pitch). */
export function bindLanderKeys(L: LandingMode, isActive: () => boolean) {
  const held = new Set<string>();
  window.addEventListener("keydown", (e) => { if (isActive()) held.add(e.key.toLowerCase()); });
  window.addEventListener("keyup", (e) => held.delete(e.key.toLowerCase()));
  return (dt: number) => {
    if (!isActive() || L.body !== "moon" || L.ctrl.auto) return;
    if (held.has("w")) L.ctrl.throttle = Math.min(1, L.ctrl.throttle + dt * 0.6);
    if (held.has("s")) L.ctrl.throttle = Math.max(0, L.ctrl.throttle - dt * 0.6);
    if (held.has("a")) L.ctrl.pitch = Math.min(0.8, L.ctrl.pitch + dt * 0.6);
    if (held.has("d")) L.ctrl.pitch = Math.max(-0.8, L.ctrl.pitch - dt * 0.6);
  };
}
