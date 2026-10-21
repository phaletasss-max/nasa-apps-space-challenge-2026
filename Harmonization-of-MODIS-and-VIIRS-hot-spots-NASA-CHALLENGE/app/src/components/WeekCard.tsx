import { useMemo } from "react";
import { useStore } from "../lib/store";
import { fmt, tr } from "../lib/i18n";

/** Global early-warning ranking: countries with significantly more fire than expected this week. */
export default function WeekCard() {
  const { nrt, meta, lang, set } = useStore();
  const rows = useMemo(() => {
    if (!nrt || !meta) return [];
    return nrt.countries
      .filter((c) => c.ratio !== null && c.obs >= 30 && c.p < 0.01 && c.ratio >= 1.5)
      .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))
      .slice(0, 8)
      .map((c) => ({ ...c, meta: meta.countries.find((m) => m.a3 === c.a3) }));
  }, [nrt, meta]);
  if (!nrt) return null;
  const max = Math.max(3, ...rows.map((r) => r.ratio ?? 0));
  return (
    <section className="card week">
      <div className="card-head">
        <h3><span className="pulse" />{tr(lang, "week_title")}</h3>
        <span className="muted small">{tr(lang, "week_window", { a: nrt.window[0], b: nrt.window[1] })}</span>
      </div>
      <p className="muted small">{tr(lang, "week_top")}</p>
      <ul className="rank">
        {rows.map((r) => (
          <li key={r.a3}>
            <button onClick={() => set({ aoi: { kind: "country", a3: r.a3 }, layer: "week" })}>
              <span className="rk-name">{r.meta ? (lang === "es" ? r.meta.name_es : r.meta.name) : r.a3}</span>
              <span className="rk-bar"><i style={{ width: `${((r.ratio ?? 0) / max) * 100}%` }} /></span>
              <span className="rk-val">{fmt(r.ratio ?? 0, lang, 1)}{tr(lang, "week_ratio")}</span>
              <span className="rk-obs">{fmt(r.obs, lang)} / {fmt(r.exp, lang)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
