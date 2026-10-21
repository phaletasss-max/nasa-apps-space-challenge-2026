import { useEffect, useMemo, useRef, useState } from "react";
import type * as echarts from "echarts";
import { useStore } from "../lib/store";
import { overviewRows, seriesForAoi } from "../lib/data";
import { fmt, months, tr } from "../lib/i18n";
import {
  at, climatology, criticalMonths, fireSeason, mIdx, naive, poissonUpper, senMk, sensorJump, yearTotal, YEARS,
} from "../lib/stats";
import { css, FIRE } from "../lib/colors";
import EChart, { AXIS, TOOLTIP, type EChartHandle } from "./EChart";
import Icon from "./Icon";
import type { Aoi, Lang, Meta, Series } from "../lib/types";

export function aoiName(aoi: Aoi, meta: Meta, lang: Lang): string {
  if (aoi.kind === "world") return tr(lang, "world");
  if (aoi.kind === "country") {
    const c = meta.countries.find((x) => x.a3 === aoi.a3);
    return c ? (lang === "es" ? c.name_es : c.name) : aoi.a3;
  }
  if (aoi.kind === "biome") return meta.biomes.find((b) => b.key === aoi.key)?.name ?? aoi.key;
  if (aoi.label) return aoi.label;
  if (aoi.kind === "bbox") {
    const [w, s, e, n] = aoi.bounds;
    return `${s.toFixed(1)}°…${n.toFixed(1)}°, ${w.toFixed(1)}°…${e.toFixed(1)}°`;
  }
  return lang === "es" ? "Polígono dibujado" : "Drawn polygon";
}

export default function Panel() {
  const { meta, overview: ov, nrt, aoi, year, mode, cal, lang, set } = useStore();
  const [series, setSeries] = useState<Series | null>(null);
  const [error, setError] = useState<string | null>(null);
  const calRef = useRef<EChartHandle>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!meta) return;
    let alive = true;
    setSeries(null); setError(null);
    seriesForAoi(aoi, meta).then((s) => alive && setSeries(s)).catch((e) => alive && setError(String(e)));
    return () => { alive = false; };
  }, [aoi, meta]);

  const week = useMemo(() => {
    if (!ov || !meta || !nrt) return null;
    if (aoi.kind === "world") return nrt.world;
    if (aoi.kind === "country") return nrt.countries.find((c) => c.a3 === aoi.a3) ?? null;
    if (aoi.kind === "biome") return nrt.biomes.find((b) => b.key === aoi.key) ?? null;
    let obs = 0, exp = 0;
    for (const i of overviewRows(aoi, ov, meta)) { obs += ov.nrtObs[i]; exp += ov.nrtExp[i]; }
    return { obs, exp, ratio: exp > 0 ? obs / exp : null, p: poissonUpper(obs, exp) };
  }, [aoi, ov, meta, nrt]);

  const a = useMemo(() => (series && meta ? analyze(series, meta.months.switch, year) : null), [series, meta, year]);

  if (!meta) return null;
  const M = months(lang);
  const name = aoiName(aoi, meta, lang);

  const exportCsv = () => {
    if (!series) return;
    const nv = naive(series, meta.months.switch);
    const rows = ["month,modis_raw_cell_days,viirs_raw_cell_days,raw_splice,harmonized_viirs_eq,harmonized_ci05,harmonized_ci95"];
    series.H.forEach((h, i) => {
      const m = series.first + i;
      const ym = `${2000 + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}`;
      rows.push([ym, series.M[i], series.V[i], nv[i], h.toFixed(2), series.lo[i].toFixed(2), series.hi[i].toFixed(2)].join(","));
    });
    download(`firecal_${name.replace(/[^\w]+/g, "_")}.csv`, new Blob([rows.join("\n")], { type: "text/csv" }));
  };
  const exportPng = () => {
    const url = calRef.current?.png();
    if (url) { const l = document.createElement("a"); l.href = url; l.download = `firecal_calendar_${name.replace(/[^\w]+/g, "_")}.png`; l.click(); }
  };
  const share = async () => {
    try { await navigator.clipboard.writeText(location.href); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ }
  };

  return (
    <aside className="panel" aria-live="polite">
      <header className="panel-head">
        <div>
          <div className="eyebrow">{tr(lang, "aoi")}</div>
          <h2>{name}</h2>
          {series && <div className="muted small">{fmt(series.cells, lang)} {tr(lang, "cells")}</div>}
        </div>
        <div className="actions">
          <button className="ghost" onClick={exportCsv} disabled={!series}><Icon name="download" size={14} /> {tr(lang, "export_csv")}</button>
          <button className="ghost" onClick={exportPng} disabled={!series}><Icon name="image" size={14} /> {tr(lang, "export_png")}</button>
          <button className="ghost" onClick={share}><Icon name="link" size={14} /> {copied ? tr(lang, "copied") : tr(lang, "share")}</button>
        </div>
      </header>

      {error && <div className="card error">{error}</div>}
      {!series || !a ? <div className="card skeleton">{tr(lang, "loading")}</div> : (
        <>
          <Kpis a={a} week={week} lang={lang} year={year} />

          <section className="card">
            <div className="card-head">
              <h3>{tr(lang, "calendar")}</h3>
              <div className="seg" role="group">
                <button className={cal === "count" ? "on" : ""} onClick={() => set({ cal: "count" })}>{tr(lang, "cal_count")}</button>
                <button className={cal === "z" ? "on" : ""} onClick={() => set({ cal: "z" })}>{tr(lang, "cal_z")}</button>
              </div>
            </div>
            <EChart ref={calRef} height={400} option={calendarOption(series, a, mode, cal, lang, year)}
              ariaLabel={tr(lang, "calendar")}
              onClick={(p) => { const d = p.data as number[] | undefined; if (d && d[1] >= 1) set({ year: 2000 + d[1] }); }} />
            <p className="note">{tr(lang, "cal_note")}</p>
          </section>

          <div className="grid2">
            <section className="card">
              <div className="card-head"><h3>{tr(lang, "annual")}</h3></div>
              <EChart height={250} option={annualOption(series, mode, lang, meta.months.switch)} ariaLabel={tr(lang, "annual")}
                onClick={(p) => { const y = Number(p.name); if (y >= 2001) set({ year: y }); }} />
              <p className="note">
                {tr(lang, "jump", { n: pct(a.jumpNaive), h: pct(a.jumpHarm) })} {tr(lang, "jump_tail")}
              </p>
            </section>
            <section className="card">
              <div className="card-head"><h3>{tr(lang, "season", { y: year })}</h3></div>
              <EChart height={250} option={seasonOption(series, a, year, lang)} ariaLabel={tr(lang, "season", { y: year })} />
              <p className="note">{tr(lang, "band")}</p>
            </section>
          </div>

          <section className="card">
            <div className="card-head"><h3>{tr(lang, "critical")}</h3><span className="muted small">{tr(lang, "critical_note")}</span></div>
            {a.critical.length === 0 ? <p className="muted">{tr(lang, "none")}</p> : (
              <table className="crit">
                <thead><tr><th>{tr(lang, "crit_month")}</th><th>{tr(lang, "crit_value")}</th><th>{tr(lang, "crit_ratio")}</th><th>z</th></tr></thead>
                <tbody>{a.critical.map((c) => (
                  <tr key={`${c.y}-${c.moy}`} onClick={() => set({ year: c.y })}>
                    <td>{M[c.moy]} {c.y}</td><td>{fmt(c.value, lang)}</td><td>{fmt(c.ratio, lang, 1)}×</td>
                    <td><span className="zbar" style={{ width: `${Math.min(100, c.z * 18)}%` }} />{fmt(c.z, lang, 1)}</td>
                  </tr>))}</tbody>
              </table>
            )}
          </section>
        </>
      )}
    </aside>
  );
}

// ------------------------------------------------------------------ analysis
type Analysis = ReturnType<typeof analyze>;

function analyze(s: Series, sw: number, year: number) {
  const clim = climatology(s.H, s);
  const totals = YEARS.map((y) => yearTotal(s.H, s, y));
  const mean = totals.reduce((p, q) => p + q, 0) / totals.length;
  const season = fireSeason(clim);
  const recIdx = totals.indexOf(Math.max(...totals));
  const yv = yearTotal(s.H, s, year);
  const rank = [...totals].sort((p, q) => q - p).indexOf(yv) + 1;
  const trend = senMk(totals);
  const nv = naive(s, sw);
  return {
    clim, totals, mean, season, recYear: YEARS[recIdx], recValue: totals[recIdx], yearValue: yv, rank,
    trendPct: mean > 0 ? (trend.slope * 10 / mean) * 100 : 0, trendP: trend.p,
    critical: criticalMonths(s, clim), naive: nv,
    jumpNaive: sensorJump(nv, s), jumpHarm: sensorJump(s.H, s),
  };
}

const pct = (v: number) => `${v >= 0 ? "+" : ""}${Math.round(v)}%`;

function Kpis({ a, week, lang, year }: { a: Analysis; week: { obs: number; exp: number; ratio: number | null; p: number } | null; lang: Lang; year: number }) {
  const M = months(lang);
  const dev = a.mean ? (a.yearValue / a.mean - 1) * 100 : 0;
  const sig = a.trendP < 0.05;
  const wr = week?.ratio ?? null;
  const unusual = week && week.p < 0.01 && (wr ?? 0) >= 1.5;
  return (
    <div className="kpis">
      <Kpi k={tr(lang, "kpi_mean")} v={fmt(a.mean, lang)} s={tr(lang, "kpi_mean_s")} />
      <Kpi k={tr(lang, "kpi_season")} v={`${M[a.season.start]}–${M[a.season.end]}`} cls="hot"
        s={tr(lang, "kpi_season_s", { share: Math.round(a.season.share * 100), peak: M[a.season.peak] })} />
      <Kpi k={tr(lang, "kpi_record")} v={String(a.recYear)}
        s={tr(lang, "kpi_record_s", { v: fmt(a.recValue, lang), x: fmt(a.recValue / (a.mean || 1), lang, 1) })} />
      <Kpi k={tr(lang, "kpi_year", { y: year })} v={pct(dev)} cls={dev >= 0 ? "up" : "down"}
        s={tr(lang, "kpi_year_s", { r: a.rank })} />
      <Kpi k={tr(lang, "kpi_trend")} v={pct(a.trendPct)} cls={sig ? (a.trendPct > 0 ? "up" : "down") : ""}
        s={tr(lang, "kpi_trend_s", { sig: tr(lang, sig ? "sig_yes" : "sig_no") })} />
      {week && <Kpi k={tr(lang, "kpi_week")} v={wr === null ? "—" : `${fmt(wr, lang, 1)}×`}
        cls={unusual ? "alert" : wr !== null && wr < 0.67 ? "down" : ""}
        s={`${tr(lang, unusual ? "unusual" : wr !== null && wr < 0.67 ? "below" : "normal")} · ${tr(lang, "kpi_week_s", { obs: fmt(week.obs, lang), exp: fmt(week.exp, lang) })}`} />}
    </div>
  );
}

function Kpi({ k, v, s, cls = "" }: { k: string; v: string; s: string; cls?: string }) {
  return <div className={`kpi ${cls}`}><div className="k">{k}</div><div className="v">{v}</div><div className="s">{s}</div></div>;
}

// ------------------------------------------------------------------ chart options
function calendarOption(s: Series, a: Analysis, mode: string, cal: string, lang: Lang, year: number): echarts.EChartsOption {
  const M = months(lang);
  const arr = mode === "harm" ? s.H : a.naive;
  const years = Array.from({ length: 26 }, (_, i) => 2000 + i);
  const data: number[][] = [];
  years.forEach((y, yi) => M.forEach((_, moy) => {
    const m = mIdx(y, moy);
    if (m < s.first || m - s.first >= arr.length) return;
    const v = at(arr, s, m);
    const c = a.clim[moy];
    const z = (at(s.H, s, m) - c.mean) / c.sd;
    data.push([moy, yi, cal === "z" ? +z.toFixed(2) : Math.log10(1 + v), v, z]);
  }));
  const vals = data.map((d) => d[2]).sort((p, q) => p - q);
  const lo = vals[Math.floor(vals.length * 0.05)] ?? 0;
  const hi = Math.max(lo + 0.3, vals[vals.length - 1] ?? 1);
  return {
    animationDuration: 250,
    grid: { left: 46, right: 14, top: 8, bottom: 52 },
    tooltip: { ...TOOLTIP, formatter: (p: unknown) => {
      const d = (p as { data: number[] }).data;
      return `<b>${M[d[0]]} ${years[d[1]]}</b><br>${fmt(d[3], lang)} fire cell-days<br>z = ${d[4].toFixed(2)}`;
    } },
    xAxis: { type: "category", data: M, ...AXIS, splitArea: { show: false } },
    yAxis: { type: "category", data: years.map(String), inverse: true, ...AXIS,
      axisLabel: { color: "#9aa0a8", fontSize: 10.5, formatter: (v: string) => (Number(v) === year ? `▸ ${v}` : v) } },
    visualMap: cal === "z"
      ? { type: "continuous", min: -2.5, max: 2.5, dimension: 2, orient: "horizontal", left: "center", bottom: 2, itemHeight: 180, itemWidth: 10,
          inRange: { color: ["#2b6cb0", "#1b1f26", "#ff4d4d"] }, text: ["+", "−"], textStyle: { color: "#9aa0a8" }, calculable: false }
      : { type: "continuous", min: lo, max: hi, dimension: 2, orient: "horizontal", left: "center", bottom: 2, itemHeight: 180, itemWidth: 10,
          inRange: { color: FIRE.map((c) => css(c)) }, text: [tr(lang, "more"), tr(lang, "less")], textStyle: { color: "#9aa0a8" }, calculable: false },
    series: [{
      type: "heatmap", data,
      itemStyle: { borderColor: "#121519", borderWidth: 1.5 },
      emphasis: { itemStyle: { borderColor: "#fff", borderWidth: 1 } },
    }],
  };
}

function annualOption(s: Series, mode: string, lang: Lang, sw: number): echarts.EChartsOption {
  const yt = (arr: number[]) => YEARS.map((y) => +yearTotal(arr, s, y).toFixed(1));
  const harm = yt(s.H), lo = yt(s.lo), hi = yt(s.hi), nv = yt(naive(s, sw));
  const pre = (y: number) => y < 2012;
  const base = YEARS.map((y, i) => (pre(y) ? lo[i] : harm[i]));
  const band = YEARS.map((y, i) => (pre(y) ? +(hi[i] - lo[i]).toFixed(1) : 0));
  return {
    animationDuration: 250,
    grid: { left: 54, right: 10, top: 34, bottom: 26 },
    legend: { top: 0, textStyle: { color: "#9aa0a8", fontSize: 11 }, itemWidth: 14,
      data: [tr(lang, "modis_raw"), tr(lang, "viirs_raw"), tr(lang, mode === "harm" ? "harm_series" : "naive_series")] },
    tooltip: { ...TOOLTIP, trigger: "axis", valueFormatter: (v) => (v == null ? "—" : fmt(Number(v), lang)) },
    xAxis: { type: "category", data: YEARS.map(String), ...AXIS },
    yAxis: { type: "value", ...AXIS },
    series: [
      { name: "b0", type: "line", stack: "ci", data: base, symbol: "none", lineStyle: { opacity: 0 }, silent: true, tooltip: { show: false } },
      { name: tr(lang, "ci90"), type: "line", stack: "ci", data: band, symbol: "none", lineStyle: { opacity: 0 },
        areaStyle: { color: "rgba(255,209,102,.2)" }, silent: true, tooltip: { show: false } },
      { name: tr(lang, "modis_raw"), type: "line", data: yt(s.M), color: "#6aa9ff", symbolSize: 3, lineStyle: { width: 1.4, type: "dashed" } },
      { name: tr(lang, "viirs_raw"), type: "line", data: YEARS.map((y, i) => (y >= 2012 ? yt(s.V)[i] : null)), color: "#ff7a1a", symbolSize: 3, lineStyle: { width: 1.4, type: "dashed" } },
      mode === "harm"
        ? { name: tr(lang, "harm_series"), type: "line", data: harm, color: "#ffd166", symbolSize: 6, lineStyle: { width: 3 } }
        : { name: tr(lang, "naive_series"), type: "line", data: nv, color: "#c77dff", symbolSize: 6, lineStyle: { width: 3 } },
      { name: "switch", type: "line", data: [], markLine: { silent: true, symbol: "none", label: { formatter: "VIIRS →", color: "#9aa0a8", position: "insideStartTop" },
        lineStyle: { color: "#5a6170", type: "dotted" }, data: [{ xAxis: "2012" }] } },
    ],
  };
}

function seasonOption(s: Series, a: Analysis, year: number, lang: Lang): echarts.EChartsOption {
  const M = months(lang);
  const yr = M.map((_, moy) => +at(s.H, s, mIdx(year, moy)).toFixed(1));
  return {
    animationDuration: 250,
    grid: { left: 54, right: 10, top: 34, bottom: 26 },
    legend: { top: 0, textStyle: { color: "#9aa0a8", fontSize: 11 }, data: [tr(lang, "median"), String(year)] },
    tooltip: { ...TOOLTIP, trigger: "axis", valueFormatter: (v) => (v == null ? "—" : fmt(Number(v), lang)) },
    xAxis: { type: "category", data: M, ...AXIS },
    yAxis: { type: "value", ...AXIS },
    series: [
      { name: "p10", type: "line", stack: "c", data: a.clim.map((c) => +c.p10.toFixed(1)), symbol: "none", lineStyle: { opacity: 0 }, tooltip: { show: false } },
      { name: "p10–p90", type: "line", stack: "c", data: a.clim.map((c) => +(c.p90 - c.p10).toFixed(1)), symbol: "none",
        lineStyle: { opacity: 0 }, areaStyle: { color: "rgba(154,160,168,.18)" }, tooltip: { show: false } },
      { name: tr(lang, "median"), type: "line", data: a.clim.map((c) => +c.p50.toFixed(1)), color: "#9aa0a8", lineStyle: { type: "dashed" }, symbol: "none" },
      { name: String(year), type: "bar", barWidth: "55%",
        data: yr.map((v, moy) => ({ value: v, itemStyle: { color: v > a.clim[moy].p90 ? "#ff4d4d" : "#ff8a1f", borderRadius: [3, 3, 0, 0] } })) },
    ],
  };
}

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const l = document.createElement("a");
  l.href = url; l.download = name; l.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
