import { lazy, Suspense, useEffect, useState } from "react";
import { readHash, useStore, writeHash } from "./lib/store";
import { loadCountriesGeo, loadMeta, loadNrt, loadOverview } from "./lib/data";
import { tr } from "./lib/i18n";
import MapView from "./components/MapView";
import Panel from "./components/Panel";
import WeekCard from "./components/WeekCard";
import { Legend, Stories, Toolbar } from "./components/Toolbar";
import Icon from "./components/Icon";

const Methods = lazy(() => import("./components/Methods"));

export default function App() {
  const { meta, nrt, aoi, year, layer, lang, view, set } = useStore();
  const [storiesOpen, setStoriesOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const m = await loadMeta();
      const [ov, n, geo] = await Promise.all([loadOverview(m), loadNrt(), loadCountriesGeo()]);
      set({ meta: m, overview: ov, nrt: n, countriesGeo: geo });
    })().catch((e) => setError(String(e)));
    const onHash = () => set(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [set]);

  useEffect(() => { writeHash({ aoi, year, layer, lang, view }); }, [aoi, year, layer, lang, view]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  return (
    <div className="app">
      <header className="top">
        <a className="brand" href="#" onClick={(e) => { e.preventDefault(); set({ view: "explore", aoi: { kind: "world" } }); }}>
          <Logo />
          <div>
            <div className="brand-name">FireCal <span>Global</span></div>
            <div className="brand-tag">{tr(lang, "tagline")}</div>
          </div>
        </a>
        <nav className="nav">
          <button className={view === "explore" ? "on" : ""} onClick={() => set({ view: "explore" })}>{tr(lang, "explore")}</button>
          <button className={view === "methods" ? "on" : ""} onClick={() => set({ view: "methods" })}>{tr(lang, "methods")}</button>
          <button onClick={() => { set({ view: "explore" }); setStoriesOpen(true); }}><Icon name="sparkle" size={14} /> {tr(lang, "stories")}</button>
        </nav>
        <div className="top-right">
          {nrt && <span className="badge">{tr(lang, "data_through", { a: nrt.window[0], b: nrt.window[1] })}</span>}
          <div className="seg small" role="group" aria-label="Language">
            <button className={lang === "en" ? "on" : ""} onClick={() => set({ lang: "en" })}>EN</button>
            <button className={lang === "es" ? "on" : ""} onClick={() => set({ lang: "es" })}>ES</button>
          </div>
        </div>
      </header>

      {error && <div className="fatal">{error}</div>}

      {view === "methods" ? <Suspense fallback={<main className="methods" />}><Methods /></Suspense> : (
        <div className="explore">
          <section className="mapcol">
            <MapView />
            <Toolbar />
            <Legend />
            <ModeToggle />
            {storiesOpen && <Stories onClose={() => setStoriesOpen(false)} />}
            {!meta && <div className="map-loading">{tr(lang, "loading")}</div>}
          </section>
          <div className="side">
            <Panel />
            <WeekCard />
            <footer className="foot">{tr(lang, "footer")}</footer>
          </div>
        </div>
      )}
    </div>
  );
}

function ModeToggle() {
  const { mode, lang, set } = useStore();
  return (
    <div className="mode-toggle seg" role="group" aria-label="Series">
      <button className={mode === "harm" ? "on" : ""} onClick={() => set({ mode: "harm" })}>{tr(lang, "harmonized")}</button>
      <button className={mode === "naive" ? "on" : ""} onClick={() => set({ mode: "naive" })}>{tr(lang, "raw_splice")}</button>
    </div>
  );
}

function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="fl" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#d4441c" /><stop offset="0.55" stopColor="#ff8a1f" /><stop offset="1" stopColor="#ffd166" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="14" fill="#1a1d23" stroke="#2f3540" />
      <g fill="#2a2f38">{[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={12 + c * 10.5} y={12 + r * 10.5} width="8" height="8" rx="1.5" />))}</g>
      <path d="M33 50c-9 0-14-6-14-13 0-6 4-9 6-14 1 4 3 6 5 6-1-7 3-13 8-16-1 6 2 10 5 14 2 3 4 6 4 10 0 8-6 13-14 13z" fill="url(#fl)" />
    </svg>
  );
}
