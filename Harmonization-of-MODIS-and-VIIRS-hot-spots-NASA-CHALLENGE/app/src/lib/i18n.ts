import type { Lang } from "./types";

const en = {
  tagline: "One fire record. Two satellites. 25 years.",
  sub: "Harmonized MODIS + VIIRS active-fire calendar · NASA FIRMS 2000–2025 + this week",
  explore: "Explore", methods: "Methods & validation", about: "About",
  search: "Search a country or biome…",
  world: "World",
  draw_rect: "Draw rectangle", draw_poly: "Draw polygon", draw_hint_rect: "Drag on the map to draw an area",
  draw_hint_poly: "Click to add vertices · double-click to finish · Esc to cancel",
  layer_activity: "Fire activity", layer_peak: "Peak fire month", layer_trend: "25-year trend", layer_week: "This week",
  legend_activity: "Mean fire cell-days / year (VIIRS-equivalent, 0.25°)",
  legend_peak: "Month with most burning (opacity = seasonality)",
  legend_trend: "Theil–Sen trend, % per decade (bold = significant, FDR 5%)",
  legend_week: "Observed / expected fire cell-days this week",
  less: "less", more: "more", decrease: "decrease", increase: "increase", new_fire: "no history",
  basemap: "Basemap", bm_dark: "Dark (vector)", bm_black: "NASA Black Marble", bm_blue: "NASA Blue Marble",
  render_grid: "Grid", render_smooth: "Smooth", legend_smooth: "Relative fire density (smoothed, GPU heatmap)",
  points_hint: "Zoom in to see every VIIRS detection of this week",
  legend_points: "Detections this week (375 m): older → newer",
  stories: "Stories",
  harmonized: "Harmonized", raw_splice: "Raw splice",
  aoi: "Area of interest", cells: "cells of 0.25°",
  kpi_mean: "Mean annual activity", kpi_mean_s: "fire cell-days / yr (VIIRS-eq.)",
  kpi_season: "Fire season", kpi_season_s: "{share}% of the year's burning · peak {peak}",
  kpi_record: "Record year", kpi_record_s: "{v} · {x}× normal",
  kpi_year: "Year {y}", kpi_year_s: "vs. 2001–2025 mean · rank {r} of 25",
  kpi_trend: "Trend 2001–2025", kpi_trend_s: "per decade · {sig}",
  sig_yes: "significant (p<0.05)", sig_no: "not significant",
  kpi_week: "This week", kpi_week_s: "{obs} observed vs {exp} expected",
  calendar: "Burning calendar", cal_count: "Intensity", cal_z: "Anomaly (z)",
  cal_note: "Each cell is one month. Click a cell to compare that year with normal.",
  annual: "Annual series", season: "Season {y} vs. normal",
  band: "Band: 10th–90th percentile, 2001–2025 (harmonized).",
  modis_raw: "MODIS raw", viirs_raw: "VIIRS raw", harm_series: "Harmonized", naive_series: "Raw splice", ci90: "90% CI",
  median: "Median 2001–2025",
  jump: "Sensor change 2009–11 → 2012–14: {n} raw splice vs {h} harmonized.",
  jump_tail: "The raw jump is an artifact of switching satellites, not fire.",
  critical: "Critical periods", critical_note: "Months far above their usual level (z ≥ 2).",
  crit_month: "Month", crit_value: "Fire cell-days", crit_ratio: "× normal", none: "None — no extreme months.",
  export_csv: "Download CSV", export_png: "Save chart", share: "Copy link", copied: "Link copied",
  loading: "Loading…", unusual: "Unusual activity", normal: "Within normal range", below: "Below normal",
  week_title: "Early warning · this week", week_window: "VIIRS NRT {a} – {b}",
  week_top: "Most unusual countries this week", week_ratio: "× expected",
  hover_mean: "Mean / yr", hover_peak: "Peak month", hover_trend: "Trend", hover_week: "This week",
  month_names: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  data_through: "Archive through Dec 2025 · NRT week {a} – {b}",
  footer: "Data: NASA FIRMS (MODIS C6.1, VIIRS S-NPP 375 m). Biomes: RESOLVE Ecoregions 2017. Borders: Natural Earth.",
};

const es: typeof en = {
  tagline: "Un registro de fuego. Dos satélites. 25 años.",
  sub: "Calendario armonizado de focos MODIS + VIIRS · NASA FIRMS 2000–2025 + esta semana",
  explore: "Explorar", methods: "Método y validación", about: "Acerca de",
  search: "Busca un país o bioma…",
  world: "Mundo",
  draw_rect: "Dibujar rectángulo", draw_poly: "Dibujar polígono", draw_hint_rect: "Arrastra sobre el mapa para dibujar un área",
  draw_hint_poly: "Clic para agregar vértices · doble clic para terminar · Esc para cancelar",
  layer_activity: "Actividad de fuego", layer_peak: "Mes pico de quema", layer_trend: "Tendencia 25 años", layer_week: "Esta semana",
  legend_activity: "Celda-días con fuego / año (equiv. VIIRS, 0.25°)",
  legend_peak: "Mes con más quema (opacidad = estacionalidad)",
  legend_trend: "Tendencia Theil–Sen, % por década (intenso = significativa, FDR 5 %)",
  legend_week: "Celda-días observados / esperados esta semana",
  less: "menos", more: "más", decrease: "disminuye", increase: "aumenta", new_fire: "sin historial",
  basemap: "Mapa base", bm_dark: "Oscuro (vectorial)", bm_black: "NASA Black Marble", bm_blue: "NASA Blue Marble",
  render_grid: "Cuadrícula", render_smooth: "Suave", legend_smooth: "Densidad relativa de fuego (suavizada, mapa de calor GPU)",
  points_hint: "Acércate para ver cada detección VIIRS de esta semana",
  legend_points: "Detecciones de esta semana (375 m): más antigua → más reciente",
  stories: "Historias",
  harmonized: "Armonizado", raw_splice: "Empalme crudo",
  aoi: "Área de interés", cells: "celdas de 0.25°",
  kpi_mean: "Actividad media anual", kpi_mean_s: "celda-días con fuego / año (equiv. VIIRS)",
  kpi_season: "Temporada de fuego", kpi_season_s: "{share} % de la quema del año · pico {peak}",
  kpi_record: "Año récord", kpi_record_s: "{v} · {x}× lo normal",
  kpi_year: "Año {y}", kpi_year_s: "vs. media 2001–2025 · puesto {r} de 25",
  kpi_trend: "Tendencia 2001–2025", kpi_trend_s: "por década · {sig}",
  sig_yes: "significativa (p<0.05)", sig_no: "no significativa",
  kpi_week: "Esta semana", kpi_week_s: "{obs} observados vs {exp} esperados",
  calendar: "Calendario de quema", cal_count: "Intensidad", cal_z: "Anomalía (z)",
  cal_note: "Cada celda es un mes. Haz clic en una para comparar ese año con lo normal.",
  annual: "Serie anual", season: "Temporada {y} frente a lo normal",
  band: "Banda: percentiles 10–90 de 2001–2025 (armonizado).",
  modis_raw: "MODIS crudo", viirs_raw: "VIIRS crudo", harm_series: "Armonizado", naive_series: "Empalme crudo", ci90: "IC 90 %",
  median: "Mediana 2001–2025",
  jump: "Cambio de sensor 2009–11 → 2012–14: {n} con empalme crudo frente a {h} armonizado.",
  jump_tail: "El salto crudo es un artefacto del cambio de satélite, no del fuego.",
  critical: "Periodos críticos", critical_note: "Meses muy por encima de su nivel habitual (z ≥ 2).",
  crit_month: "Mes", crit_value: "Celda-días", crit_ratio: "× normal", none: "Ninguno: no hubo meses extremos.",
  export_csv: "Descargar CSV", export_png: "Guardar gráfico", share: "Copiar enlace", copied: "Enlace copiado",
  loading: "Cargando…", unusual: "Actividad inusual", normal: "Dentro de lo normal", below: "Por debajo de lo normal",
  week_title: "Alerta temprana · esta semana", week_window: "VIIRS NRT {a} – {b}",
  week_top: "Países más inusuales esta semana", week_ratio: "× lo esperado",
  hover_mean: "Media / año", hover_peak: "Mes pico", hover_trend: "Tendencia", hover_week: "Esta semana",
  month_names: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
  data_through: "Archivo hasta dic 2025 · semana NRT {a} – {b}",
  footer: "Datos: NASA FIRMS (MODIS C6.1, VIIRS S-NPP 375 m). Biomas: RESOLVE Ecoregions 2017. Fronteras: Natural Earth.",
};

export const DICT = { en, es };
export type Key = Exclude<keyof typeof en, "month_names">;

export function tr(lang: Lang, key: Key, vars: Record<string, string | number> = {}): string {
  let s = DICT[lang][key] as string;
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

export const months = (lang: Lang) => DICT[lang].month_names;

export function fmt(n: number, lang: Lang, digits = 0): string {
  return n.toLocaleString(lang === "es" ? "es-PE" : "en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
