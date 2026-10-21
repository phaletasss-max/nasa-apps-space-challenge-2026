import { useMemo, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { DIVERGING, FIRE, gradientCss, MONTHS, NEW_FIRE, RECENCY, WEEK, css } from "../lib/colors";
import Icon from "./Icon";
import { months, tr } from "../lib/i18n";
import { STORIES } from "../lib/stories";
import type { Basemap, LayerId } from "../lib/types";

const LAYERS: LayerId[] = ["activity", "peak", "trend", "week"];

export function Toolbar() {
  const { layer, draw, extruded, basemap, render, lang, set } = useStore();
  return (
    <div className="toolbar">
      <Search />
      <div className="seg layers" role="radiogroup" aria-label="Layer">
        {LAYERS.map((l) => (
          <button key={l} role="radio" aria-checked={layer === l} className={layer === l ? "on" : ""}
            onClick={() => set({ layer: l, extruded: l === "activity" ? extruded : false })}>
            {tr(lang, `layer_${l}` as const)}
          </button>
        ))}
      </div>
      <div className="tool-row">
        <button className={`tool ${draw === "rect" ? "on" : ""}`} onClick={() => set({ draw: draw === "rect" ? null : "rect" })} title={tr(lang, "draw_rect")} aria-label={tr(lang, "draw_rect")}><Icon name="rect" /></button>
        <button className={`tool ${draw === "poly" ? "on" : ""}`} onClick={() => set({ draw: draw === "poly" ? null : "poly" })} title={tr(lang, "draw_poly")} aria-label={tr(lang, "draw_poly")}><Icon name="poly" /></button>
        <button className={`tool ${extruded ? "on" : ""}`} onClick={() => set({ extruded: !extruded, layer: "activity" })} title="3D" aria-label="3D"><Icon name="cube" /></button>
        {layer === "activity" && !extruded && (
          <button className={`tool ${render === "smooth" ? "on" : ""}`} onClick={() => set({ render: render === "smooth" ? "grid" : "smooth" })}
            title={tr(lang, render === "smooth" ? "render_grid" : "render_smooth")} aria-label={tr(lang, "render_smooth")}>
            <Icon name={render === "smooth" ? "grid" : "smooth"} />
          </button>
        )}
        <select className="tool select" value={basemap} onChange={(e) => set({ basemap: e.target.value as Basemap })} aria-label={tr(lang, "basemap")}>
          <option value="dark">{tr(lang, "bm_dark")}</option>
          <option value="blackmarble">{tr(lang, "bm_black")}</option>
          <option value="bluemarble">{tr(lang, "bm_blue")}</option>
        </select>
        <button className="tool" onClick={() => set({ aoi: { kind: "world" } })} title={tr(lang, "world")} aria-label={tr(lang, "world")}><Icon name="globe" /></button>
      </div>
    </div>
  );
}

function Search() {
  const { meta, lang, set } = useStore();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const items = useMemo(() => {
    if (!meta) return [];
    const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    const nq = norm(q.trim());
    const all = [
      { key: "world", label: tr(lang, "world"), sub: "", pick: () => set({ aoi: { kind: "world" } }) },
      ...meta.countries.map((c) => ({ key: c.a3, label: lang === "es" ? c.name_es : c.name, sub: c.continent,
        pick: () => set({ aoi: { kind: "country", a3: c.a3 } }) })),
      ...meta.biomes.map((b) => ({ key: b.key, label: b.name, sub: lang === "es" ? "Bioma" : "Biome",
        pick: () => set({ aoi: { kind: "biome", key: b.key } }) })),
    ];
    return (nq ? all.filter((x) => norm(x.label).includes(nq) || x.key.toLowerCase() === nq) : all).slice(0, 8);
  }, [meta, q, lang, set]);

  const choose = (i: number) => { items[i]?.pick(); setQ(""); setOpen(false); input.current?.blur(); };
  return (
    <div className="search" role="combobox" aria-expanded={open}>
      <input ref={input} value={q} placeholder={tr(lang, "search")} aria-label={tr(lang, "search")}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { setActive((a) => Math.min(items.length - 1, a + 1)); e.preventDefault(); }
          else if (e.key === "ArrowUp") { setActive((a) => Math.max(0, a - 1)); e.preventDefault(); }
          else if (e.key === "Enter") choose(active);
          else if (e.key === "Escape") setOpen(false);
        }} />
      {open && items.length > 0 && (
        <ul className="search-list" role="listbox">
          {items.map((it, i) => (
            <li key={it.key} role="option" aria-selected={i === active} className={i === active ? "on" : ""}
              onMouseDown={() => choose(i)}>{it.label}<span>{it.sub}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Legend() {
  const { layer, lang, render, extruded } = useStore();
  const M = months(lang);
  const smooth = layer === "activity" && render === "smooth" && !extruded;
  return (
    <div className="legend">
      <div className="legend-title">{smooth ? tr(lang, "legend_smooth") : tr(lang, `legend_${layer}` as const)}</div>
      {layer === "activity" && smooth && <>
        <div className="ramp" style={{ background: gradientCss(FIRE) }} />
        <div className="ticks"><span>{tr(lang, "less")}</span><span>{tr(lang, "more")}</span></div>
      </>}
      {layer === "activity" && !smooth && <>
        <div className="ramp" style={{ background: gradientCss(FIRE) }} />
        <div className="ticks"><span>1</span><span>10</span><span>100</span><span>300+</span></div>
      </>}
      {layer === "peak" && <div className="months">{MONTHS.map((c, i) => <span key={i} style={{ background: css(c) }}>{M[i][0]}</span>)}</div>}
      {layer === "trend" && <>
        <div className="ramp" style={{ background: gradientCss(DIVERGING) }} />
        <div className="ticks"><span>−60%</span><span>0</span><span>+60%</span></div>
      </>}
      {layer === "week" && <div className="chips">
        {WEEK.map((w, i) => <span key={i}><i style={{ background: css(w.color) }} />{["<0.67×", "0.67–1.5×", "1.5–3×", ">3×"][i]}</span>)}
        <span><i style={{ background: css(NEW_FIRE) }} />{tr(lang, "new_fire")}</span>
      </div>}
      {layer === "week" && <>
        <div className="legend-title sub">{tr(lang, "legend_points")}</div>
        <div className="ramp" style={{ background: gradientCss(RECENCY) }} />
      </>}
    </div>
  );
}

export function Stories({ onClose }: { onClose: () => void }) {
  const { lang, set } = useStore();
  return (
    <div className="stories" role="dialog" aria-label={tr(lang, "stories")}>
      <div className="stories-head"><h3>{tr(lang, "stories")}</h3><button className="ghost" onClick={onClose} aria-label="Close"><Icon name="close" /></button></div>
      <div className="story-list">
        {STORIES.map((s) => (
          <button key={s.id} className="story" onClick={() => { set({ aoi: s.aoi, year: s.year, layer: s.layer, extruded: false }); onClose(); }}>
            <b>{s.title[lang]}</b>
            <span>{s.text[lang]}</span>
            <em>{s.year}</em>
          </button>
        ))}
      </div>
    </div>
  );
}
