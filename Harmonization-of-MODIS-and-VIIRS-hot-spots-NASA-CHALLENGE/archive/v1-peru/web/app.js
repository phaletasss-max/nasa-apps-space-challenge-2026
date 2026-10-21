// FireCal Perú — frontend estático (Leaflet + ECharts). Todo se calcula en el navegador
// a partir de grid.json (series crudas por celda 0.25°) y calib.json (factores k).

const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const Y0 = 2000, YFIRST = 2001, YLAST = 2025;
const YEARS = Array.from({ length: YLAST - YFIRST + 1 }, (_, i) => YFIRST + i);
const COL = { modis: "#6aa9ff", viirs: "#ff7a1a", harm: "#ffd166", naive: "#c77dff", muted: "#9aa0a8", line: "#2a2f38" };
const FIRE = ["#3b0f1f", "#8a1c2b", "#d4441c", "#ff8a1f", "#ffd166", "#fff3c4"];

const PRESETS = {
  tambopata: { name: "Amazonía · Tambopata y La Pampa (Madre de Dios)", bounds: [[-13.4, -70.6], [-12.0, -68.7]] },
  andes: { name: "Andes norte · Amazonas + Cajamarca + Áncash", deps: ["AMAZONAS", "CAJAMARCA", "ANCASH"] },
  cana: { name: "Costa norte · valles cañeros (Lambayeque–La Libertad)", bounds: [[-8.3, -79.8], [-6.4, -78.9]] },
};

const state = { mode: "harm", cal: "count", year: 2024, sel: null };
let G, C, VAL, cells, map, cellLayer, depLayer, drawRect;
const charts = {};

const fmt = (n) => Math.round(n).toLocaleString("es-PE");
const mIdx = (y, moy) => (y - Y0) * 12 + moy;

async function init() {
  const [g, c, v, deps] = await Promise.all(
    ["grid.json", "calib.json", "validation.json", "departments.geojson"].map((f) => fetch(`data/${f}`).then((r) => r.json()))
  );
  G = g; C = c; VAL = v;
  cells = G.cells.map(([x, y, dep, ms, M, V], i) => ({
    i, dep, ms, M, V,
    s: G.lat0 + y * G.res, w: G.lon0 + x * G.res,
    lat: G.lat0 + (y + 0.5) * G.res, lon: G.lon0 + (x + 0.5) * G.res,
  }));
  // intensidad media anual armonizada por celda (para el mapa)
  for (const cell of cells) cell.mean = sumYears(series([cell]).harm) / YEARS.length;

  initMap(deps);
  initCharts();
  bindUi();
  selectAll();
}

// ------------------------------------------------------------------ series
function series(sel) {
  const n = G.last + 1;
  const M = new Float64Array(n), V = new Float64Array(n);
  const H = new Float64Array(n), Hlo = new Float64Array(n), Hhi = new Float64Array(n);
  for (const c of sel) {
    const k = C.k[c.dep], lo = C.lo[c.dep], hi = C.hi[c.dep];
    for (let j = 0; j < c.ms.length; j++) {
      const m = c.ms[j], a = c.M[j], b = c.V[j];
      M[m] += a; V[m] += b;
      if (m < G.switch) {
        const moy = m % 12;
        H[m] += a * k[moy]; Hlo[m] += a * lo[moy]; Hhi[m] += a * hi[moy];
      } else { H[m] += b; Hlo[m] += b; Hhi[m] += b; }
    }
  }
  const naive = new Float64Array(n);
  for (let m = 0; m < n; m++) naive[m] = m < G.switch ? M[m] : V[m];
  return { modis: M, viirs: V, harm: H, lo: Hlo, hi: Hhi, naive };
}

const sumYears = (arr) => YEARS.reduce((s, y) => s + yearTotal(arr, y), 0);
function yearTotal(arr, y) { let s = 0; for (let k = 0; k < 12; k++) s += arr[mIdx(y, k)] || 0; return s; }

function quantile(sorted, p) {
  const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

function climatology(arr) {
  return MES.map((_, moy) => {
    const v = YEARS.map((y) => arr[mIdx(y, moy)]).sort((a, b) => a - b);
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1)) || 1;
    return { mean, sd, p10: quantile(v, 0.1), p50: quantile(v, 0.5), p90: quantile(v, 0.9) };
  });
}

// ------------------------------------------------------------------ mapa
function fireColor(v) {
  if (v <= 0) return null;
  const t = Math.min(1, Math.log10(1 + v) / Math.log10(301));
  return FIRE[Math.min(FIRE.length - 1, Math.floor(t * FIRE.length))];
}

function initMap(deps) {
  map = L.map("map", { zoomControl: true, preferCanvas: true }).setView([-9.3, -75.0], 5);
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
    attribution: "Base: Esri, HERE, Garmin, © OpenStreetMap · Datos: NASA FIRMS", maxZoom: 12,
  }).addTo(map);

  const renderer = L.canvas({ padding: 0.3 });
  cellLayer = L.layerGroup(cells.filter((c) => c.mean > 0).map((c) => L.rectangle(
    [[c.s, c.w], [c.s + G.res, c.w + G.res]],
    { renderer, stroke: false, fillColor: fireColor(c.mean), fillOpacity: 0.85, interactive: false }
  ))).addTo(map);

  depLayer = L.geoJSON(deps, {
    style: () => ({ color: "#5a6170", weight: 0.8, fill: true, fillOpacity: 0, fillColor: "#fff" }),
    onEachFeature: (f, layer) => {
      layer.bindTooltip(titleCase(f.properties.NOMBDEP), { sticky: true });
      layer.on("click", () => { if (!document.body.classList.contains("drawing")) selectDeps([f.properties.NOMBDEP]); });
    },
  }).addTo(map);
}

function highlight(depNames, bounds) {
  depLayer.setStyle((f) => depNames && depNames.includes(f.properties.NOMBDEP)
    ? { color: "#ffd166", weight: 2.2, fillOpacity: 0.06, fillColor: "#ffd166" }
    : { color: "#5a6170", weight: 0.8, fillOpacity: 0 });
  if (drawRect) { map.removeLayer(drawRect); drawRect = null; }
  if (bounds) drawRect = L.rectangle(bounds, { color: "#ffd166", weight: 2, fillOpacity: 0.05, interactive: false }).addTo(map);
}

// ------------------------------------------------------------------ selección
function selectAll() {
  highlight(null, null);
  map.setView([-9.3, -75.0], 5);
  setSelection("Todo Perú", cells);
}

function selectDeps(names, label) {
  const ids = names.map((n) => C.deps.indexOf(n));
  highlight(names, null);
  const sel = cells.filter((c) => ids.includes(c.dep));
  const b = L.latLngBounds(sel.map((c) => [c.lat, c.lon]));
  if (b.isValid()) map.fitBounds(b.pad(0.15));
  setSelection(label || names.map(titleCase).join(" + "), sel);
}

function selectBounds(bounds, label) {
  const b = L.latLngBounds(bounds);
  highlight(null, b);
  map.fitBounds(b.pad(0.4));
  setSelection(label || "Área dibujada", cells.filter((c) => b.contains([c.lat, c.lon])));
}

function setSelection(name, sel) {
  state.sel = { name, cells: sel, s: series(sel) };
  document.getElementById("selName").textContent = name;
  const deps = [...new Set(sel.map((c) => C.deps[c.dep]))];
  document.getElementById("selMeta").innerHTML =
    `${sel.length.toLocaleString("es-PE")} celdas de 0.25°<br>${deps.length > 4 ? deps.length + " departamentos" : deps.map(titleCase).join(", ")}`;
  render();
}

function enableDraw() {
  const btn = document.getElementById("btnDraw");
  document.body.classList.add("drawing"); btn.classList.add("on");
  map.dragging.disable();
  let start = null, rect = null;
  const down = (e) => { start = e.latlng; rect = L.rectangle([start, start], { color: "#ffd166", weight: 2, fillOpacity: 0.08, interactive: false }).addTo(map); };
  const move = (e) => { if (rect) rect.setBounds([start, e.latlng]); };
  const up = (e) => {
    if (!rect) return;
    const b = L.latLngBounds(start, e.latlng); map.removeLayer(rect);
    map.off("mousedown", down).off("mousemove", move).off("mouseup", up);
    map.dragging.enable(); document.body.classList.remove("drawing"); btn.classList.remove("on");
    if (Math.abs(b.getNorth() - b.getSouth()) > 0.05) selectBounds(b);
  };
  map.on("mousedown", down).on("mousemove", move).on("mouseup", up);
}

// ------------------------------------------------------------------ UI
function bindUi() {
  document.querySelectorAll(".mode button").forEach((b) => b.addEventListener("click", () => {
    state.mode = b.dataset.mode;
    document.querySelectorAll(".mode button").forEach((x) => x.classList.toggle("on", x === b));
    render();
  }));
  document.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => {
    state.cal = b.dataset.cal;
    document.querySelectorAll(".seg button").forEach((x) => x.classList.toggle("on", x === b));
    renderCalendar();
  }));
  document.getElementById("btnAll").addEventListener("click", selectAll);
  document.getElementById("btnDraw").addEventListener("click", enableDraw);
  document.querySelectorAll(".preset").forEach((b) => b.addEventListener("click", () => {
    const p = PRESETS[b.dataset.preset];
    p.deps ? selectDeps(p.deps, p.name) : selectBounds(p.bounds, p.name);
  }));
  window.addEventListener("resize", () => Object.values(charts).forEach((c) => c.resize()));
}

function initCharts() {
  for (const id of ["calendar", "annual", "clim", "valid", "ratio"]) {
    charts[id] = echarts.init(document.getElementById(id), "dark", { renderer: "canvas" });
  }
  charts.calendar.on("click", (p) => { const y = Y0 + (p.data ? p.data[1] : 0); if (y >= YFIRST) { state.year = y; renderClim(); renderKpis(); } });
  charts.annual.on("click", (p) => { const y = Number(p.name); if (y) { state.year = y; renderClim(); renderKpis(); } });
  // el bloque de método está colapsado: redimensionar al abrir
  document.getElementById("method").addEventListener("toggle", () => { charts.valid.resize(); charts.ratio.resize(); });
  renderValidation();
}

const base = { backgroundColor: "transparent", textStyle: { fontFamily: "Inter" }, animationDuration: 300 };

function active() { return state.sel.s[state.mode]; }

function render() { renderKpis(); renderCalendar(); renderAnnual(); renderClim(); }

function renderKpis() {
  const s = state.sel.s, arr = s.harm;
  const tot = YEARS.map((y) => yearTotal(arr, y));
  const mean = tot.reduce((a, b) => a + b, 0) / tot.length;
  const clim = climatology(arr);
  // temporada: 3 meses consecutivos con mayor fracción del total
  let best = 0, bestM = 0;
  const cm = clim.map((c) => c.mean), cs = cm.reduce((a, b) => a + b, 0) || 1;
  for (let m = 0; m < 12; m++) { const v = cm[m] + cm[(m + 1) % 12] + cm[(m + 2) % 12]; if (v > best) { best = v; bestM = m; } }
  const recIdx = tot.indexOf(Math.max(...tot));
  const yv = yearTotal(arr, state.year);
  const rank = [...tot].sort((a, b) => b - a).indexOf(yv) + 1;
  const dev = mean ? (yv / mean - 1) * 100 : 0;
  document.getElementById("kpis").innerHTML = [
    kpi("Promedio anual", fmt(mean), "celda-días con fuego (equiv. VIIRS)"),
    kpi("Temporada crítica", `${MES[bestM]}–${MES[(bestM + 2) % 12]}`, `${Math.round((best / cs) * 100)} % de la quema del año`, "hot"),
    kpi("Año récord", YEARS[recIdx], `${fmt(tot[recIdx])} celda-días · ${(tot[recIdx] / (mean || 1)).toFixed(1)}× lo normal`),
    kpi(`Año ${state.year}`, `${dev >= 0 ? "+" : ""}${Math.round(dev)} %`, `vs. promedio · puesto ${rank} de ${YEARS.length}`, dev >= 0 ? "up" : "down"),
  ].join("");
}

const kpi = (k, v, s, cls = "") => `<div class="kpi"><div class="k">${k}</div><div class="v ${cls}">${v}</div><div class="s">${s}</div></div>`;

function renderCalendar() {
  const arr = active(), clim = climatology(state.sel.s.harm);
  const data = [], allYears = [Y0, ...YEARS];
  allYears.forEach((y, yi) => MES.forEach((_, moy) => {
    const m = mIdx(y, moy);
    if (m < G.first || m > G.last) return;
    const v = arr[m];
    const z = (state.sel.s.harm[m] - clim[moy].mean) / clim[moy].sd;
    data.push([moy, yi, state.cal === "z" ? +z.toFixed(2) : Math.log10(1 + v), v, z]);
  }));
  const yLabels = allYears.map(String);
  const vm = state.cal === "z"
    ? { min: -2.5, max: 2.5, inRange: { color: ["#2b6cb0", "#1c2027", "#ff5d5d"] }, text: ["más fuego", "menos"] }
    : (() => {
        const l = data.map((d) => d[2]).sort((a, b) => a - b);
        return { min: quantile(l, 0.05), max: Math.max(quantile(l, 0.05) + 0.5, l[l.length - 1]), inRange: { color: FIRE }, text: ["más", "menos"] };
      })();
  charts.calendar.setOption({
    ...base,
    grid: { left: 44, right: 16, top: 8, bottom: 56 },
    tooltip: { formatter: (p) => {
      const [moy, yi, , v, z] = p.data;
      return `<b>${MES[moy]} ${yLabels[yi]}</b><br>${fmt(v)} celda-días<br>anomalía z = ${z.toFixed(2)}`;
    } },
    xAxis: { type: "category", data: MES, splitArea: { show: false }, axisLine: { show: false } },
    yAxis: { type: "category", data: yLabels, inverse: true, axisLine: { show: false },
      axisLabel: { interval: 1, color: COL.muted } },
    visualMap: { type: "continuous", dimension: 2, orient: "horizontal", left: "center", bottom: 4, itemHeight: 160, itemWidth: 10,
      calculable: false, textStyle: { color: COL.muted }, ...vm },
    series: [{ type: "heatmap", data,
      itemStyle: { borderColor: "#15181d", borderWidth: 1.5 },
      emphasis: { itemStyle: { borderColor: "#fff", borderWidth: 1 } } }],
  }, true);
}

function renderAnnual() {
  const s = state.sel.s;
  const yt = (a) => YEARS.map((y) => +yearTotal(a, y).toFixed(1));
  const switchYear = 2012;
  const harm = yt(s.harm), lo = yt(s.lo), hi = yt(s.hi);
  const band = YEARS.map((y, i) => (y < switchYear ? hi[i] - lo[i] : 0));
  const lower = YEARS.map((y, i) => (y < switchYear ? lo[i] : harm[i]));
  const modis = yt(s.modis), viirs = YEARS.map((y, i) => (y >= switchYear ? yt(s.viirs)[i] : null));
  const naive = yt(s.naive);
  const series = [
    { name: "IC 90 %", type: "line", stack: "band", data: lower, lineStyle: { opacity: 0 }, symbol: "none", silent: true, tooltip: { show: false } },
    { name: "Banda", type: "line", stack: "band", data: band, lineStyle: { opacity: 0 }, symbol: "none", areaStyle: { color: "rgba(255,209,102,.18)" }, silent: true, tooltip: { show: false } },
    { name: "MODIS crudo", type: "line", data: modis, color: COL.modis, symbolSize: 4, lineStyle: { width: 1.5, type: "dashed" } },
    { name: "VIIRS crudo", type: "line", data: viirs, color: COL.viirs, symbolSize: 4, lineStyle: { width: 1.5, type: "dashed" } },
    state.mode === "harm"
      ? { name: "Armonizado", type: "line", data: harm, color: COL.harm, symbolSize: 6, lineStyle: { width: 3 } }
      : { name: "Empalme crudo", type: "line", data: naive, color: COL.naive, symbolSize: 6, lineStyle: { width: 3 } },
  ];
  charts.annual.setOption({
    ...base,
    grid: { left: 52, right: 12, top: 34, bottom: 28 },
    legend: { top: 0, textStyle: { color: COL.muted, fontSize: 11 }, data: ["MODIS crudo", "VIIRS crudo", state.mode === "harm" ? "Armonizado" : "Empalme crudo"] },
    tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "—" : fmt(v)) },
    xAxis: { type: "category", data: YEARS.map(String), axisLabel: { color: COL.muted } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: COL.line } }, axisLabel: { color: COL.muted } },
    series: [...series, { type: "line", data: [], markLine: { silent: true, symbol: "none", label: { formatter: "VIIRS →", color: COL.muted },
      lineStyle: { color: COL.muted, type: "dotted" }, data: [{ xAxis: "2012" }] } }],
  }, true);

  // efecto del salto de sensor: 2009–2011 vs 2012–2014
  const avg = (a, y0, y1) => { const v = YEARS.map((y, i) => (y >= y0 && y <= y1 ? a[i] : null)).filter((x) => x != null); return v.reduce((p, q) => p + q, 0) / v.length; };
  const jn = (avg(naive, 2012, 2014) / (avg(naive, 2009, 2011) || 1) - 1) * 100;
  const jh = (avg(harm, 2012, 2014) / (avg(harm, 2009, 2011) || 1) - 1) * 100;
  document.getElementById("jumpNote").innerHTML =
    `Cambio 2009–11 → 2012–14: <b style="color:${COL.naive}">${jn >= 0 ? "+" : ""}${Math.round(jn)} %</b> con el empalme crudo frente a ` +
    `<b style="color:${COL.harm}">${jh >= 0 ? "+" : ""}${Math.round(jh)} %</b> armonizado. Casi todo el salto del empalme crudo se debe al cambio de sensor, no al fuego.`;
}

function renderClim() {
  document.getElementById("yearLbl").textContent = state.year;
  const s = state.sel.s, clim = climatology(s.harm);
  const yr = MES.map((_, moy) => +s.harm[mIdx(state.year, moy)].toFixed(1));
  charts.clim.setOption({
    ...base,
    grid: { left: 52, right: 12, top: 34, bottom: 28 },
    legend: { top: 0, textStyle: { color: COL.muted, fontSize: 11 }, data: ["Mediana 2001–2025", String(state.year)] },
    tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "—" : fmt(v)) },
    xAxis: { type: "category", data: MES, axisLabel: { color: COL.muted } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: COL.line } }, axisLabel: { color: COL.muted } },
    series: [
      { name: "p10", type: "line", stack: "c", data: clim.map((c) => +c.p10.toFixed(1)), lineStyle: { opacity: 0 }, symbol: "none", tooltip: { show: false } },
      { name: "p10–p90", type: "line", stack: "c", data: clim.map((c) => +(c.p90 - c.p10).toFixed(1)), lineStyle: { opacity: 0 }, symbol: "none",
        areaStyle: { color: "rgba(154,160,168,.18)" }, tooltip: { show: false } },
      { name: "Mediana 2001–2025", type: "line", data: clim.map((c) => +c.p50.toFixed(1)), color: COL.muted, lineStyle: { type: "dashed" }, symbol: "none" },
      { name: String(state.year), type: "bar", data: yr.map((v, moy) => ({ value: v, itemStyle: { color: v > clim[moy].p90 ? "#ff5d5d" : COL.viirs, borderRadius: [3, 3, 0, 0] } })), barWidth: "55%" },
    ],
  }, true);
}

function renderValidation() {
  const m = VAL.metodos;
  const names = { crudo: "MODIS sin ajustar", k_nacional: "k nacional único", k_mes: "k por mes", k_dep_mes: "k dep. × mes (FireCal)" };
  const keys = Object.keys(names);
  charts.valid.setOption({
    ...base,
    title: { text: "Error al predecir el año excluido (MAE, dep.×mes)", textStyle: { fontSize: 12, color: COL.muted, fontWeight: 500 } },
    grid: { left: 150, right: 40, top: 30, bottom: 20 },
    xAxis: { type: "value", splitLine: { lineStyle: { color: COL.line } }, axisLabel: { color: COL.muted } },
    yAxis: { type: "category", data: keys.map((k) => names[k]), inverse: true, axisLabel: { color: COL.muted } },
    tooltip: { formatter: (p) => { const r = m[keys[p.dataIndex]]; return `${p.name}<br>MAE ${r.mae}<br>R² (log) ${r.r2_log}<br>sesgo ${r.sesgo_pct} %`; } },
    series: [{ type: "bar", data: keys.map((k) => ({ value: m[k].mae, itemStyle: { color: k === "k_dep_mes" ? COL.harm : "#4a505b", borderRadius: [0, 3, 3, 0] } })),
      label: { show: true, position: "right", color: COL.muted } }],
  });
  charts.ratio.setOption({
    ...base,
    title: { text: "Relación VIIRS / MODIS por año (Perú)", textStyle: { fontSize: 12, color: COL.muted, fontWeight: 500 } },
    grid: { left: 40, right: 12, top: 30, bottom: 24 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: VAL.ratio_por_anio.map((r) => r.year), axisLabel: { color: COL.muted } },
    yAxis: { type: "value", min: 0, splitLine: { lineStyle: { color: COL.line } }, axisLabel: { color: COL.muted } },
    series: [{ type: "line", data: VAL.ratio_por_anio.map((r) => r.ratio), color: COL.viirs, symbolSize: 6, areaStyle: { color: "rgba(255,122,26,.12)" } }],
  });
  const best = m.k_dep_mes, raw = m.crudo;
  document.getElementById("validNote").innerHTML =
    `En ${VAL.n.toLocaleString("es-PE")} combinaciones de departamento y mes, el error medio baja de <b>${raw.mae}</b> (MODIS sin ajustar, sesgo ${raw.sesgo_pct} %) ` +
    `a <b>${best.mae}</b> celda-días (sesgo ${best.sesgo_pct} %). El total anual nacional se predice con un <b>${VAL.error_anual_pct} %</b> de error medio. ` +
    `VIIRS detecta unas 4 veces más celda-días que MODIS. El repunte de 2025 coincide con la deriva orbital de Terra y Aqua al final de su vida útil, que es una razón más para armonizar ahora.`;
}

function titleCase(s) { return s.toLowerCase().replace(/(^|\s)\S/g, (t) => t.toUpperCase()); }

init().catch((e) => { document.getElementById("selName").textContent = "Error cargando datos"; console.error(e); });
