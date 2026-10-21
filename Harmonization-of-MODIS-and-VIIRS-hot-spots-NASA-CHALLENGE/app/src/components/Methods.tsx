import { useEffect, useMemo, useState } from "react";
import type * as echarts from "echarts";
import { useStore } from "../lib/store";
import { loadValidation } from "../lib/data";
import { fmt } from "../lib/i18n";
import EChart, { AXIS, TOOLTIP } from "./EChart";
import type { Lang } from "../lib/types";

interface Metric { n: number; mae: number; bias_pct: number; r2_log: number }
interface Validation {
  calibration_years: [number, number];
  stage_a_years: [number, number];
  alpha: number;
  alpha_cv: Record<string, Metric>;
  methods: Record<string, Record<string, Metric>>;
  out_of_window: { years: number[]; country_year: Metric; block_month: Metric };
  ratio_by_year: Record<string, number>;
  ratio_by_biome_year: Record<string, Record<string, number>>;
  stage_a: { r_global_month: number[]; loyo_full: Record<string, Metric>; loyo_raw: Record<string, Metric> };
  units: { biome: number; biome_realm: number; block_biome_realm: number };
  n_cells: number;
  bootstrap: number;
}

const METHOD_LABEL: Record<string, { en: string; es: string }> = {
  raw: { en: "MODIS, no adjustment", es: "MODIS sin ajustar" },
  global: { en: "One global factor", es: "Un factor global" },
  global_month: { en: "Global × month", es: "Global × mes" },
  biome: { en: "Biome × month", es: "Bioma × mes" },
  biome_realm: { en: "Biome × realm × month", es: "Bioma × reino × mes" },
  full: { en: "FireCal hierarchical (2.5° block)", es: "FireCal jerárquico (bloque 2.5°)" },
};

const T = {
  en: {
    h1: "Methods & validation",
    lead: "How FireCal turns two incompatible satellite records into one 25-year fire calendar, and how well it works.",
    problem_h: "The problem",
    problem: "NASA's MODIS (1 km, since 2000) and VIIRS (375 m, since 2012) detect active fires very differently: VIIRS sees about {r}× more fire cell-days worldwide. Splicing the two records creates a false jump in 2012, and MODIS is nearing the end of its mission. Without harmonization, every long-term fire statistic is broken at the sensor boundary.",
    pipe_h: "Pipeline",
    steps: [
      ["Ingest", "{det} detections from the FIRMS yearly global archives (MODIS C6.1 2000–2025, VIIRS S-NPP 2012–2025), vegetation fires only (type 0), confidence-filtered."],
      ["Common unit", "Fire cell-days on a 0.1° grid: did the cell burn that day? This removes most of the resolution effect. Summed to 0.25° cells × month."],
      ["Stratify", "Every cell gets a country (Natural Earth) and a biome and realm (RESOLVE Ecoregions 2017): {u1} biomes, {u2} biome × realm strata, {u3} local units of 2.5° blocks."],
      ["Stage A", "Before July 2002 only Terra existed. A Terra → Terra+Aqua ratio, calibrated on {a0}–{a1}, bridges the first 20 months."],
      ["Stage B", "MODIS → VIIRS-equivalent ratio per local unit × calendar month, calibrated on {c0}–{c1} with hierarchical empirical-Bayes shrinkage."],
      ["Uncertainty", "{boot} bootstrap resamples of calibration years give a 90% interval for every pre-2012 month."],
    ],
    eq_h: "Hierarchical shrinkage",
    eq: "Each level borrows strength from its parent, so data-rich places get their own factor and data-poor places fall back gracefully:",
    alpha: "α was chosen by leave-one-year-out cross-validation: α = {a}.",
    val_h: "Validation",
    val: "Leave-one-year-out: calibrate without year Y, predict Y's VIIRS record from MODIS, repeat for every year in {c0}–{c1}. Errors in fire cell-days.",
    th_method: "Method", th_bm: "MAE · 2.5° block × month", th_cy: "MAE · country × year", th_bias: "Bias", th_r2: "R² (log)",
    oow: "Out-of-window test: calibrated on {c0}–{c1}, predicting {o0}–{o1}: country × year MAE {mae}, bias {bias}%. The factors hold outside the period they were fitted on.",
    stageA: "Stage A (Terra → Terra+Aqua), leave-one-year-out over {a0}–{a1}: block × month MAE {raw} → {full}; bias {braw}% → {bfull}%.",
    ratio_h: "Is the MODIS/VIIRS ratio stable?",
    ratio: "The global ratio stays between {lo} and {hi} each year. We calibrate on {c0}–{c1}, before the Terra and Aqua orbits started drifting.",
    analytics_h: "Analytics",
    analytics: [
      "Trend: Theil–Sen slope with a Mann–Kendall test on 2001–2025 annual totals. Benjamini–Hochberg false-discovery control (q = 5%) across cells.",
      "Fire season: the shortest run of calendar months holding 80% of mean annual activity.",
      "Critical periods: months with z ≥ 2 relative to the same calendar month in 2001–2025.",
      "Early warning: the last complete days of the global 7-day VIIRS NRT file are compared with the harmonized climatology of the same calendar days. Because the archive is on the VIIRS scale, the comparison needs no extra conversion. Poisson test; static sources (volcanoes, industry, gas flares) are masked using the archive's type flags.",
    ],
    limits_h: "Limitations",
    limits: [
      "Active-fire detections are not burned area: small, short or cloud-covered fires can be missed by both sensors.",
      "Cell-days count whether a 0.1° cell burned, not how intensely. Fire radiative power is not harmonized yet.",
      "NRT data are provisional and lack the vegetation-fire flag, so a few industrial sources may remain.",
      "Calibration factors assume the MODIS–VIIRS relationship observed in 2012–2019 held in 2000–2011.",
    ],
    src_h: "Data & credits",
  },
  es: {
    h1: "Método y validación",
    lead: "Cómo FireCal convierte dos registros satelitales incompatibles en un solo calendario de fuego de 25 años, y qué tan bien funciona.",
    problem_h: "El problema",
    problem: "MODIS (1 km, desde 2000) y VIIRS (375 m, desde 2012) de NASA detectan el fuego de forma muy distinta: VIIRS ve unas {r} veces más celda-días con fuego en el mundo. Empalmar ambos registros crea un salto falso en 2012, y MODIS está cerca del fin de su misión. Sin armonizar, toda estadística de fuego de largo plazo se rompe en el cambio de sensor.",
    pipe_h: "Pipeline",
    steps: [
      ["Ingesta", "{det} detecciones de los archivos anuales globales de FIRMS (MODIS C6.1 2000–2025, VIIRS S-NPP 2012–2025), solo fuegos de vegetación (type 0), filtradas por confianza."],
      ["Unidad común", "Celda-días con fuego en una grilla de 0.1°: ¿la celda ardió ese día? Esto elimina casi todo el efecto de resolución. Se suman a celdas de 0.25° × mes."],
      ["Estratos", "Cada celda recibe país (Natural Earth) y bioma y reino (RESOLVE Ecoregions 2017): {u1} biomas, {u2} estratos bioma × reino, {u3} unidades locales de bloques de 2.5°."],
      ["Etapa A", "Antes de julio de 2002 solo existía Terra. Un factor Terra → Terra+Aqua, calibrado en {a0}–{a1}, cubre los primeros 20 meses."],
      ["Etapa B", "Factor MODIS → equivalente VIIRS por unidad local × mes, calibrado en {c0}–{c1} con shrinkage jerárquico empírico-bayesiano."],
      ["Incertidumbre", "{boot} remuestreos bootstrap de los años de calibración dan un intervalo del 90 % para cada mes previo a 2012."],
    ],
    eq_h: "Shrinkage jerárquico",
    eq: "Cada nivel toma fuerza de su nivel superior: los lugares con muchos datos obtienen su propio factor y los lugares con pocos datos recurren al de su región:",
    alpha: "α se eligió por validación cruzada dejando un año fuera: α = {a}.",
    val_h: "Validación",
    val: "Dejando un año fuera: se calibra sin el año Y, se predice el registro VIIRS de Y a partir de MODIS y se repite para cada año de {c0}–{c1}. Errores en celda-días con fuego.",
    th_method: "Método", th_bm: "MAE · bloque 2.5° × mes", th_cy: "MAE · país × año", th_bias: "Sesgo", th_r2: "R² (log)",
    oow: "Prueba fuera de ventana: calibrado en {c0}–{c1}, prediciendo {o0}–{o1}: MAE país × año {mae}, sesgo {bias} %. Los factores se sostienen fuera del periodo en que se ajustaron.",
    stageA: "Etapa A (Terra → Terra+Aqua), dejando un año fuera en {a0}–{a1}: MAE bloque × mes {raw} → {full}; sesgo {braw} % → {bfull} %.",
    ratio_h: "¿Es estable la relación MODIS/VIIRS?",
    ratio: "La relación global se mantiene entre {lo} y {hi} cada año. Calibramos en {c0}–{c1}, antes de que las órbitas de Terra y Aqua empezaran a derivar.",
    analytics_h: "Analítica",
    analytics: [
      "Tendencia: pendiente de Theil–Sen con prueba de Mann–Kendall sobre los totales anuales 2001–2025. Control de falsos descubrimientos de Benjamini–Hochberg (q = 5 %) entre celdas.",
      "Temporada de fuego: la menor racha de meses que concentra el 80 % de la actividad media anual.",
      "Periodos críticos: meses con z ≥ 2 frente al mismo mes de 2001–2025.",
      "Alerta temprana: los últimos días completos del archivo VIIRS NRT global de 7 días se comparan con la climatología armonizada de esos mismos días del calendario. Como el archivo está en escala VIIRS, la comparación no requiere conversión. Prueba de Poisson; las fuentes estáticas (volcanes, industria, antorchas de gas) se enmascaran con los indicadores type del archivo.",
    ],
    limits_h: "Limitaciones",
    limits: [
      "Las detecciones de fuego activo no son área quemada: fuegos pequeños, breves o bajo nubes pueden escapar a ambos sensores.",
      "Los celda-días indican si una celda de 0.1° ardió, no con qué intensidad. La potencia radiativa (FRP) aún no está armonizada.",
      "Los datos NRT son provisionales y no traen el indicador de fuego de vegetación, así que pueden quedar algunas fuentes industriales.",
      "Los factores asumen que la relación MODIS–VIIRS observada en 2012–2019 también valía en 2000–2011.",
    ],
    src_h: "Datos y créditos",
  },
};

const sub = (s: string, v: Record<string, string | number>) => Object.entries(v).reduce((a, [k, x]) => a.split(`{${k}}`).join(String(x)), s);

export default function Methods() {
  const { lang, meta } = useStore();
  const [val, setVal] = useState<Validation | null>(null);
  useEffect(() => { loadValidation().then((v) => setVal(v as unknown as Validation)); }, []);
  const t = T[lang];
  if (!val) return <main className="methods"><p className="muted">…</p></main>;

  const ratios = Object.values(val.ratio_by_year);
  const meanRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const v = {
    r: fmt(meanRatio, lang, 1),
    det: meta ? `${fmt((meta.stats.detections.modis + meta.stats.detections["viirs-snpp"]) / 1e6, lang, 1)} ${lang === "es" ? "millones de" : "million"}` : "",
    u1: meta?.biomes.length ?? val.units.biome, u2: val.units.biome_realm, u3: fmt(val.units.block_biome_realm, lang),
    a0: val.stage_a_years[0], a1: val.stage_a_years[1], c0: val.calibration_years[0], c1: val.calibration_years[1],
    boot: val.bootstrap, a: val.alpha,
  };
  const order = ["raw", "global", "global_month", "biome", "biome_realm", "full"];
  const oow = val.out_of_window;

  return (
    <main className="methods">
      <h1>{t.h1}</h1>
      <p className="lead">{t.lead}</p>

      <h2>{t.problem_h}</h2>
      <p>{sub(t.problem, v)}</p>

      <h2>{t.pipe_h}</h2>
      <ol className="pipeline">
        {t.steps.map(([h, d], i) => <li key={i}><b>{h}</b><span>{sub(d, v)}</span></li>)}
      </ol>

      <h2>{t.eq_h}</h2>
      <p>{t.eq}</p>
      <pre className="eq">{`k_global(m)  = ΣV / ΣM
k_biome(m)   = (ΣV_b  + α·k_global(m)) / (ΣM_b  + α)
k_b×realm(m) = (ΣV_br + α·k_biome(m))  / (ΣM_br + α)
k_unit(m)    = (ΣV_u  + α·k_b×realm(m))/ (ΣM_u  + α)     m = calendar month

H(month) = MODIS · [r_unit(m) if Terra-only] · k_unit(m)   before 2012-02
         = VIIRS                                          from 2012-02`}</pre>
      <p>{sub(t.alpha, v)}</p>
      <EChart height={220} ariaLabel="alpha" option={alphaOption(val, lang)} />

      <h2>{t.val_h}</h2>
      <p>{sub(t.val, v)}</p>
      <div className="table-wrap">
        <table className="val">
          <thead><tr><th>{t.th_method}</th><th>{t.th_bm}</th><th>{t.th_cy}</th><th>{t.th_bias}</th><th>{t.th_r2}</th></tr></thead>
          <tbody>
            {order.map((k) => {
              const m = val.methods[k];
              return (
                <tr key={k} className={k === "full" ? "best" : ""}>
                  <td>{METHOD_LABEL[k][lang]}</td>
                  <td>{fmt(m.block_month.mae, lang, 1)}</td>
                  <td>{fmt(m.country_year.mae, lang)}</td>
                  <td>{fmt(m.block_month.bias_pct, lang, 1)}%</td>
                  <td>{fmt(m.block_month.r2_log, lang, 3)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <EChart height={260} ariaLabel="methods" option={methodsOption(val, lang, order)} />
      {oow?.years && <p>{sub(t.oow, { ...v, o0: oow.years[0], o1: oow.years[oow.years.length - 1],
        mae: fmt(oow.country_year.mae, lang), bias: fmt(oow.country_year.bias_pct, lang, 1) })}</p>}
      <p>{sub(t.stageA, { ...v, raw: fmt(val.stage_a.loyo_raw.block_month.mae, lang, 1), full: fmt(val.stage_a.loyo_full.block_month.mae, lang, 1),
        braw: fmt(val.stage_a.loyo_raw.block_month.bias_pct, lang, 1), bfull: fmt(val.stage_a.loyo_full.block_month.bias_pct, lang, 1) })}</p>

      <h2>{t.ratio_h}</h2>
      <p>{sub(t.ratio, { ...v, lo: fmt(Math.min(...ratios), lang, 2), hi: fmt(Math.max(...ratios), lang, 2) })}</p>
      <RatioChart val={val} lang={lang} />

      <h2>{t.analytics_h}</h2>
      <ul>{t.analytics.map((x, i) => <li key={i}>{x}</li>)}</ul>

      <h2>{t.limits_h}</h2>
      <ul>{t.limits.map((x, i) => <li key={i}>{x}</li>)}</ul>

      <h2>{t.src_h}</h2>
      <ul className="refs">
        <li>NASA FIRMS — Fire Information for Resource Management System: MODIS Collection 6.1 (MCD14ML) and VIIRS S-NPP 375 m (VNP14IMGML; NRT: VNP14IMGTDL_NRT) active fire products, yearly global archives and 7-day NRT. firms.modaps.eosdis.nasa.gov</li>
        <li>Giglio, L., Schroeder, W., Justice, C. O. (2016). The collection 6 MODIS active fire detection algorithm and fire products. Remote Sensing of Environment, 178, 31–41.</li>
        <li>Schroeder, W., Oliva, P., Giglio, L., Csiszar, I. A. (2014). The New VIIRS 375 m active fire detection data product. Remote Sensing of Environment, 143, 85–96.</li>
        <li>Dinerstein, E. et al. (2017). An Ecoregion-Based Approach to Protecting Half the Terrestrial Realm. BioScience, 67(6), 534–545. (RESOLVE Ecoregions, CC-BY 4.0)</li>
        <li>Natural Earth 1:50m / 1:110m admin-0 boundaries (public domain). Basemaps: NASA GIBS (Black Marble, Blue Marble), Esri.</li>
      </ul>
    </main>
  );
}

function alphaOption(val: Validation, lang: Lang): echarts.EChartsOption {
  const keys = Object.keys(val.alpha_cv);
  return {
    grid: { left: 50, right: 20, top: 20, bottom: 36 },
    tooltip: { ...TOOLTIP, trigger: "axis" },
    xAxis: { type: "category", data: keys, name: "α", nameLocation: "middle", nameGap: 24, ...AXIS },
    yAxis: { type: "value", name: "MAE", ...AXIS, min: (x: { min: number }) => Math.floor(x.min * 0.9) },
    series: [{ type: "line", data: keys.map((k) => val.alpha_cv[k].mae), color: "#ffd166", symbolSize: 8,
      markPoint: { data: [{ name: "alpha", coord: [String(val.alpha), val.alpha_cv[String(val.alpha)].mae], value: lang === "es" ? "elegido" : "chosen" }],
        itemStyle: { color: "#ff7a1a" }, label: { color: "#121519", fontSize: 10 } } }],
  };
}

function methodsOption(val: Validation, lang: Lang, order: string[]): echarts.EChartsOption {
  return {
    grid: { left: 210, right: 50, top: 10, bottom: 24 },
    tooltip: { ...TOOLTIP },
    xAxis: { type: "value", ...AXIS },
    yAxis: { type: "category", inverse: true, data: order.map((k) => METHOD_LABEL[k][lang]), ...AXIS },
    series: [{ type: "bar", barWidth: "60%", label: { show: true, position: "right", color: "#9aa0a8" },
      data: order.map((k) => ({ value: val.methods[k].block_month.mae,
        itemStyle: { color: k === "full" ? "#ffd166" : "#4a505b", borderRadius: [0, 4, 4, 0] } })) }],
  };
}

function RatioChart({ val, lang }: { val: Validation; lang: Lang }) {
  const biomes = useStore((s) => s.meta?.biomes ?? []);
  const option = useMemo<echarts.EChartsOption>(() => {
    const years = Object.keys(val.ratio_by_year);
    const top = [...biomes].sort((a, b) => b.mean - a.mean).slice(0, 5);
    return {
      grid: { left: 40, right: 16, top: 50, bottom: 24 },
      legend: { top: 0, type: "scroll", textStyle: { color: "#9aa0a8", fontSize: 11 } },
      tooltip: { ...TOOLTIP, trigger: "axis", valueFormatter: (x) => fmt(Number(x), lang, 2) },
      xAxis: { type: "category", data: years, ...AXIS },
      yAxis: { type: "value", min: 0, ...AXIS },
      series: [
        { name: lang === "es" ? "Global" : "Global", type: "line", data: years.map((y) => val.ratio_by_year[y]), color: "#ffd166", lineStyle: { width: 3 }, symbolSize: 6 },
        ...top.map((b) => ({ name: b.name, type: "line" as const, symbol: "none", lineStyle: { width: 1.4 }, color: b.color,
          data: years.map((y) => val.ratio_by_biome_year[String(b.id)]?.[y] ?? null) })),
        { type: "line", data: [], markArea: { silent: true, itemStyle: { color: "rgba(255,209,102,.07)" },
          data: [[{ xAxis: String(val.calibration_years[0]) }, { xAxis: String(val.calibration_years[1]) }]] } },
      ],
    };
  }, [val, lang, biomes]);
  return <EChart height={280} ariaLabel="ratio" option={option} />;
}
