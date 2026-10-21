import "./style.css";
import { CAREER_LIMIT_MSV, DEFAULT_BUILD, initState, launchMass, PER_CREW, rng, SITES, step, type Build, type SimState, type SiteId } from "./sim";
import { drawScene } from "./scene";

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const buildEl = document.getElementById("build")!;
const statusEl = document.getElementById("status")!;
const timebar = document.getElementById("timebar")!;
const modal = document.getElementById("modal")!;
const lessons = document.getElementById("lessons")!;

/** Lesson scenarios: each one fails for a different, real reason until the player fixes it. */
const LESSONS: { id: string; name: string; hint: string; build: Build }[] = [
  { id: "artemis", name: "Base Artemis (polo sur)", hint: "Una base equilibrada: ¿aguanta 180 días?", build: { ...DEFAULT_BUILD } },
  { id: "night", name: "La noche lunar", hint: "Solo paneles solares en el ecuador lunar. ¿Qué pasa cuando llegan 14 días de oscuridad?",
    build: { ...DEFAULT_BUILD, site: "moon-eq", reactors: 0, iceKgDay: 0, supplyDays: 180 } },
  { id: "dust", name: "Polvo en Marte", hint: "Una base marciana solar. Las tormentas de polvo pueden durar semanas…",
    build: { ...DEFAULT_BUILD, site: "mars", iceKgDay: 0, isruKgDay: 4, electrolysisKgDay: 0, reactors: 0, solarM2: 400, batteryKwh: 500 } },
  { id: "rad", name: "Radiación", hint: "Misión larga sin blindaje de regolito. ¿Cuántos días hasta el límite de 600 mSv?",
    build: { ...DEFAULT_BUILD, shieldingCm: 0, missionDays: 400, supplyDays: 400, massLimit: 60000 } },
];

let build: Build = { ...DEFAULT_BUILD };
let state: SimState = initState(build);
let rand = rng(build.seed);
let playing = false;
let speed = 24; // simulated hours per real second
let carry = 0;

function reset(b: Build = build) {
  build = { ...b };
  state = initState(build);
  rand = rng(build.seed);
  playing = false;
  carry = 0;
  modal.hidden = true;
  renderBuild();
  renderStatus(true);
}

// ------------------------------------------------------------------ build panel
type NumKey = { [K in keyof Build]: Build[K] extends number ? K : never }[keyof Build];

function slider(key: NumKey, label: string, min: number, max: number, stepV: number, unit: string, help = "") {
  return `<label class="field" title="${help}"><span>${label} <b><output id="${key}-v">${build[key]}</output> ${unit}</b></span>
    <input type="range" data-k="${key}" min="${min}" max="${max}" step="${stepV}" value="${build[key]}"></label>`;
}

function renderBuild() {
  const site = SITES[build.site];
  buildEl.innerHTML = `
    <h2>Diseña tu base</h2>
    <label class="field"><span>Lugar</span><select id="site">${Object.values(SITES).map((s) => `<option value="${s.id}" ${s.id === build.site ? "selected" : ""}>${s.name}</option>`).join("")}</select></label>
    <p class="hint">${site.blurb}</p>
    <div class="mass"><div class="bar"><i id="mass-bar"></i></div><span id="mass-txt"></span></div>
    ${slider("crew", "Tripulación", 1, 6, 1, "personas")}
    <h3>Energía</h3>
    ${slider("solarM2", "Paneles solares", 0, 600, 10, "m²", "30 % de eficiencia; 12 kg/m²")}
    ${slider("batteryKwh", "Baterías", 0, 2000, 50, "kWh", "6 kg por kWh")}
    ${slider("reactors", "Reactores de fisión (10 kW)", 0, 4, 1, "", "Tipo Kilopower: 1 800 kg c/u, funciona de día y de noche")}
    <h3>Soporte vital</h3>
    <label class="check"><input type="checkbox" id="recycler" ${build.recycler ? "checked" : ""}> <span>Reciclador de agua (98 %, como la ISS)</span></label>
    ${slider("electrolysisKgDay", "Electrólisis: O₂ desde agua", 0, 12, 1, "kg/día", "1.125 kg de agua y ~6 kWh por kg de O₂")}
    ${site.isruCo2 ? slider("isruKgDay", "ISRU: O₂ desde CO₂ marciano", 0, 12, 1, "kg/día", "Como MOXIE de Perseverance, pero en grande (~25 kWh/kg)") : ""}
    ${site.ice ? slider("iceKgDay", "Minería de hielo (agua)", 0, 40, 2, "kg/día", "Hielo de cráteres en sombra permanente (~3 kWh/kg)") : ""}
    ${slider("greenhouseM2", "Invernadero", 0, 300, 10, "m²", "~40 g de comida por m² al día; 0.2 kW/m² de luz LED")}
    ${slider("supplyDays", "Víveres traídos desde la Tierra", 10, 400, 10, "días")}
    <h3>Protección</h3>
    ${slider("shieldingCm", "Blindaje de regolito sobre el hábitat", 0, 200, 10, "cm", "Material local: no cuenta en la masa")}
    <h3>Misión</h3>
    ${slider("missionDays", "Duración", 30, 600, 30, "días")}
    <label class="field"><span>Capacidad de los módulos de aterrizaje</span>
      <select id="massLimit">${[25000, 40000, 60000].map((m) => `<option value="${m}" ${m === build.massLimit ? "selected" : ""}>${m / 1000} t</option>`).join("")}</select></label>
    <p class="hint">Cambiar el diseño reinicia la misión.</p>`;

  buildEl.querySelectorAll<HTMLInputElement>("input[type=range]").forEach((el) => el.addEventListener("input", () => {
    const k = el.dataset.k as NumKey;
    buildEl.querySelector(`#${k}-v`)!.textContent = el.value;
    build = { ...build, [k]: Number(el.value) };
    state = initState(build); rand = rng(build.seed); playing = false;
    renderMass(); renderStatus(true);
  }));
  buildEl.querySelector<HTMLSelectElement>("#site")!.addEventListener("change", (e) => {
    const site = (e.target as HTMLSelectElement).value as SiteId;
    reset({ ...build, site, isruKgDay: SITES[site].isruCo2 ? Math.max(build.isruKgDay, 4) : 0, iceKgDay: SITES[site].ice ? Math.max(build.iceKgDay, 12) : 0 });
  });
  buildEl.querySelector<HTMLInputElement>("#recycler")!.addEventListener("change", (e) => reset({ ...build, recycler: (e.target as HTMLInputElement).checked }));
  buildEl.querySelector<HTMLSelectElement>("#massLimit")!.addEventListener("change", (e) => reset({ ...build, massLimit: Number((e.target as HTMLSelectElement).value) }));
  renderMass();
}

function renderMass() {
  const m = launchMass(build);
  const pct = m.total / build.massLimit;
  const bar = buildEl.querySelector<HTMLElement>("#mass-bar")!;
  bar.style.width = `${Math.min(100, pct * 100)}%`;
  bar.className = pct > 1 ? "over" : "";
  buildEl.querySelector("#mass-txt")!.textContent = `Masa a enviar: ${fmt(m.total / 1000, 1)} t de ${build.massLimit / 1000} t${pct > 1 ? " · ¡demasiado pesado!" : ""}`;
}

// ------------------------------------------------------------------ status panel
let lastLog = -1;
function renderStatus(force = false) {
  const s = state, b = build;
  const daily = (k: "o2" | "water" | "food") => b.crew * PER_CREW[k];
  const daysLeft = (v: number, k: "o2" | "water" | "food") => v / daily(k);
  const gauge = (icon: string, name: string, v: number, k: "o2" | "water" | "food") => {
    const d = daysLeft(v, k);
    const cls = d < 10 ? "bad" : d < 30 ? "warn" : "ok";
    return `<div class="gauge ${cls}"><span>${icon} ${name}</span><b>${fmt(v)} kg</b><em>${d > 999 ? "∞" : fmt(d)} días</em><i style="width:${Math.min(100, (d / b.missionDays) * 100)}%"></i></div>`;
  };
  const charge = b.batteryKwh ? s.battery / b.batteryKwh : 0;
  const doseP = s.dose / CAREER_LIMIT_MSV;
  const day = Math.floor(s.hour / 24);
  statusEl.querySelector("#gauges")
    ? (statusEl.querySelector("#gauges")!.innerHTML = gaugesHtml())
    : (statusEl.innerHTML = `
      <h2>Estado de la base</h2>
      <div id="gauges">${gaugesHtml()}</div>
      <h3>Historial</h3>
      <canvas id="chart" width="600" height="190"></canvas>
      <div class="legend"><span class="o2">O₂</span><span class="water">Agua</span><span class="food">Comida</span><span class="bat">Batería</span></div>
      <h3>Bitácora</h3>
      <ol class="log" id="log"></ol>`);

  function gaugesHtml() {
    return `
      <div class="daybar"><b>Día ${day}</b> de ${b.missionDays}<i style="width:${Math.min(100, (day / b.missionDays) * 100)}%"></i></div>
      ${gauge("", "Oxígeno", s.o2, "o2")}${gauge("", "Agua", s.water, "water")}${gauge("", "Comida", s.food, "food")}
      <div class="gauge ${charge < 0.15 ? "bad" : charge < 0.4 ? "warn" : "ok"}"><span>Batería</span><b>${fmt(s.battery)} kWh</b><em>${fmt(charge * 100)} %</em><i style="width:${charge * 100}%"></i></div>
      <div class="gauge ${doseP > 0.8 ? "bad" : doseP > 0.5 ? "warn" : "ok"}"><span>Dosis</span><b>${fmt(s.dose)} mSv</b><em>límite ${CAREER_LIMIT_MSV}</em><i style="width:${doseP * 100}%"></i></div>
      <div class="power">
        <div><span>Solar</span><b>${fmt(s.solarKw, 1)} kW</b></div>
        <div><span>Reactor</span><b>${fmt(s.reactorKw, 1)} kW</b></div>
        <div><span>Consumo</span><b>${fmt(s.loadKw, 1)} kW</b></div>
        <div><span>Ciencia</span><b>${fmt(s.scienceHours)} h</b></div>
      </div>
      ${s.shed.length ? `<p class="shed">Apagado por falta de energía: ${s.shed.join(", ")}</p>` : ""}`;
  }

  drawChart();
  if (force || s.log.length !== lastLog) {
    lastLog = s.log.length;
    statusEl.querySelector("#log")!.innerHTML = s.log.slice(0, 40).map((e) => `<li class="${e.kind}"><time>Día ${e.day}</time>${e.text}</li>`).join("");
  }
}

function drawChart() {
  const c = statusEl.querySelector<HTMLCanvasElement>("#chart");
  if (!c) return;
  const g = c.getContext("2d")!, W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  g.strokeStyle = "rgba(255,255,255,0.08)";
  for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(0, (H * k) / 4); g.lineTo(W, (H * k) / 4); g.stroke(); }
  const hist = state.history;
  if (hist.length < 2) return;
  const n = Math.max(build.missionDays, hist[hist.length - 1].day);
  const series: [string, (h: (typeof hist)[number]) => number][] = [
    ["#7df9ff", (h) => h.o2 / (build.crew * PER_CREW.o2)],
    ["#5aa0ff", (h) => h.water / (build.crew * PER_CREW.water)],
    ["#8be28b", (h) => h.food / (build.crew * PER_CREW.food)],
    ["#ffd166", (h) => (h.battery / Math.max(1, build.batteryKwh)) * 100],
  ];
  const maxDays = Math.max(60, ...hist.map((h) => Math.max(series[0][1](h), series[1][1](h), series[2][1](h))));
  for (const [col, f] of series) {
    g.strokeStyle = col; g.lineWidth = 2; g.beginPath();
    hist.forEach((h, i) => {
      const x = (h.day / n) * W, v = col === "#ffd166" ? f(h) / 100 : f(h) / maxDays;
      const y = H - Math.max(0, Math.min(1, v)) * (H - 6) - 3;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    });
    g.stroke();
  }
}

// ------------------------------------------------------------------ lessons, time bar, outcome
function renderLessons() {
  lessons.innerHTML = LESSONS.map((l) => `<button data-l="${l.id}" title="${l.hint}">${l.name}</button>`).join("");
  lessons.querySelectorAll<HTMLButtonElement>("button").forEach((btn) => btn.addEventListener("click", () => {
    const l = LESSONS.find((x) => x.id === btn.dataset.l)!;
    reset(l.build);
    showModal(`<h2>${l.name}</h2><p>${l.hint}</p><button class="primary" id="go">Empezar</button>`, () => { playing = true; });
  }));
}

function renderTimebar() {
  timebar.innerHTML = `
    <button id="play" class="primary"></button>
    <div class="speeds">${[[1, "1 h/s"], [24, "1 día/s"], [240, "10 días/s"], [720, "30 días/s"]].map(([v, t]) => `<button data-s="${v}">${t}</button>`).join("")}</div>
    <button id="reset">Reiniciar</button>`;
  timebar.querySelector("#play")!.addEventListener("click", () => {
    if (state.status !== "running") reset();
    playing = !playing;
  });
  timebar.querySelector("#reset")!.addEventListener("click", () => reset());
  timebar.querySelectorAll<HTMLButtonElement>("[data-s]").forEach((b) => b.addEventListener("click", () => { speed = Number(b.dataset.s); }));
}

function updateTimebar() {
  timebar.querySelector("#play")!.textContent = playing ? "Pausa" : state.status === "running" ? (state.hour ? "Continuar" : "Iniciar misión") : "Otra vez";
  timebar.querySelectorAll<HTMLButtonElement>("[data-s]").forEach((b) => b.classList.toggle("on", Number(b.dataset.s) === speed));
}

function showModal(html: string, onGo?: () => void) {
  modal.innerHTML = `<div class="card">${html}</div>`;
  modal.hidden = false;
  modal.querySelector("#go")?.addEventListener("click", () => { modal.hidden = true; onGo?.(); });
}

function outcome() {
  const s = state, won = s.status === "won";
  showModal(`
    <h2>${won ? "¡Misión cumplida!" : "Misión fallida"}</h2>
    <p>${s.reason}</p>
    <div class="power">
      <div><span>Días</span><b>${Math.floor(s.hour / 24)}</b></div>
      <div><span>Ciencia</span><b>${fmt(s.scienceHours)} h</b></div>
      <div><span>Dosis</span><b>${fmt(s.dose)} mSv</b></div>
      <div><span>Masa</span><b>${fmt(launchMass(build).total / 1000, 1)} t</b></div>
    </div>
    <p class="hint">${won ? "Prueba con menos masa, más tripulación o una misión más larga." : "Ajusta el diseño (izquierda) y vuelve a intentarlo."}</p>
    <button class="primary" id="go">Cerrar</button>`);
}

// ------------------------------------------------------------------ loop
function resize() {
  const dpr = Math.min(window.devicePixelRatio, 2);
  canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener("resize", resize);
resize();

let last = performance.now(), uiTimer = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (playing && state.status === "running") {
    if (launchMass(build).total > build.massLimit) {
      playing = false;
      showModal(`<h2>Demasiado pesado</h2><p>Tu base pesa ${fmt(launchMass(build).total / 1000, 1)} t y los módulos de aterrizaje solo llevan ${build.massLimit / 1000} t. Reduce paneles, baterías, víveres o tripulación.</p><button class="primary" id="go">Entendido</button>`);
    } else {
      carry += speed * dt;
      const hours = Math.min(24 * 40, Math.floor(carry));
      carry -= hours;
      for (let i = 0; i < hours && state.status === "running"; i++) step(build, state, rand);
      if (state.status !== "running") { playing = false; outcome(); }
    }
  }
  const side = innerWidth > 1000 ? 344 : 0; // keep the base in the strip between the side panels
  drawScene(ctx, innerWidth, innerHeight, build, state, now / 1000, { l: side, r: side });
  uiTimer += dt;
  if (uiTimer > 0.15) { uiTimer = 0; renderStatus(); updateTimebar(); }
  requestAnimationFrame(frame);
}

const fmt = (v: number, d = 0) => v.toLocaleString("es-PE", { maximumFractionDigits: d, minimumFractionDigits: d });

renderLessons();
renderTimebar();
// ?site=mars|moon-pole|moon-eq — opened from the mission sandbox after a successful landing
const fromLanding = new URLSearchParams(location.search).get("site") as SiteId | null;
if (fromLanding && fromLanding in SITES) {
  const site = SITES[fromLanding];
  reset({ ...build, site: fromLanding, isruKgDay: site.isruCo2 ? 4 : 0, iceKgDay: site.ice ? 12 : 0, electrolysisKgDay: site.isruCo2 ? 0 : 4 });
  showModal(`<h2>Aterrizaste en ${site.name}</h2><p>${site.blurb}</p><p>Ahora diseña la base que mantendrá viva a tu tripulación.</p><button class="primary" id="go">Empezar a construir</button>`);
} else reset(build);
if (import.meta.env.DEV) Object.assign(window, { __sim: { get state() { return state; }, get build() { return build; }, step: () => step(build, state, rand) } });
requestAnimationFrame(frame);
