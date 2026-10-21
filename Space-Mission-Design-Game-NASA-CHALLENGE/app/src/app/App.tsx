import { useEffect } from "react";
import { engine } from "../engine";
import { sandbox } from "../legacy";
import { contractOf, fmtDay, useGame, type Screen } from "../game/store";
import { Icon, num } from "./ui";
import { Menu, Credits } from "./screens/Menu";
import { Hub } from "./screens/Hub";
import { Contracts } from "./screens/Contracts";
import { VehicleScreen } from "./screens/Vehicle";
import { CrewScreen } from "./screens/Crew";
import { LaunchScreen } from "./screens/Launch";
import { OpsScreen } from "./screens/Ops";
import { LandingScreen } from "./screens/Landing";
import { Debrief } from "./screens/Debrief";
import { SandboxBar } from "./screens/Sandbox";

/** Screens on which the campaign calendar runs. */
const CLOCK: Screen[] = ["hub", "contracts", "vehicle", "crew", "ops"];

/** Which 3D scene sits behind each screen. */
function useScene(screen: Screen) {
  const campaign = useGame((s) => s.campaign);
  useEffect(() => {
    if (screen === "explore" || screen === "orbit") { sandbox.open(screen === "explore" ? "solar" : "orbit"); return; }
    sandbox.close();
    const { solar } = engine;
    if (screen === "vehicle" || screen === "crew") engine.show("vab");
    else if (screen === "launch") engine.show("launch");
    else if (screen === "landing") engine.show("landing");
    else {
      engine.show("solar");
      solar.setExternal(true);
      const backdrop = screen === "menu" || screen === "credits" || screen === "hub" || screen === "contracts" || screen === "debrief";
      solar.controls.autoRotate = backdrop;
      solar.controls.autoRotateSpeed = 0.25;
      solar.showBelt(screen === "ops");
      if (screen !== "ops") { solar.setHazards([]); solar.setGameTrack([], 0); solar.setGameCraft(null); }
      solar.setDate(useGame.getState().campaign?.date ?? Date.now());
      if (screen === "menu" || screen === "credits") solar.select(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, !!campaign]);
}

/** Advance the campaign calendar while on management screens. */
function useClock(screen: Screen) {
  useEffect(() => {
    if (!CLOCK.includes(screen)) return;
    return engine.onFrame((dt) => useGame.getState().tick(dt));
  }, [screen]);
}

const NAV: { id: Screen; label: string; icon: string }[] = [
  { id: "hub", label: "Centro de control", icon: "home" },
  { id: "contracts", label: "Contratos", icon: "file" },
  { id: "vehicle", label: "Vehículo", icon: "rocket" },
  { id: "crew", label: "Tripulación", icon: "users" },
  { id: "launch", label: "Lanzamiento", icon: "launch" },
  { id: "ops", label: "Operaciones", icon: "radar" },
];

function navEnabled(id: Screen): boolean {
  const c = useGame.getState().campaign, m = c?.mission;
  if (id === "vehicle") return !!m && ["design", "building", "ready"].includes(m.phase);
  if (id === "launch") return !!m && (m.phase === "ready" || m.phase === "ascent");
  if (id === "ops") return !!m && ["cruise", "arrived", "surface", "return", "reentry"].includes(m.phase);
  return true;
}

const SPEEDS: [number, string, string][] = [[1, "1 d", "1 día por segundo"], [7, "7 d", "1 semana por segundo"], [30, "30 d", "1 mes por segundo"], [120, "120 d", "4 meses por segundo"]];

function TopBar() {
  const { screen, campaign: c, speed, paused, go, setSpeed, setPaused } = useGame();
  if (!c) return null;
  const k = contractOf(c);
  const clock = CLOCK.includes(screen);
  return (
    <header className="topbar">
      <button className="brandbtn" onClick={() => go("menu")} title="Menú principal">
        <span className="logo">Δv</span>
        <span className="brand-t"><b>{c.agency}</b><small>{k ? k.title : "Sin misión activa"}</small></span>
      </button>
      <nav className="mainnav">
        {NAV.map((n) => (
          <button key={n.id} className={screen === n.id ? "on" : ""} disabled={!navEnabled(n.id)} onClick={() => go(n.id)}>
            <Icon name={n.icon} /><span>{n.label}</span>
          </button>
        ))}
      </nav>
      <div className="clock">
        <div className="date"><Icon name="clock" /><b>{fmtDay(c.date)}</b></div>
        <div className="speeds" aria-label="Velocidad de simulación">
          <button className={paused ? "on" : ""} disabled={!clock} onClick={() => setPaused(!paused)} title={paused ? "Reanudar" : "Pausa"}><Icon name={paused ? "play" : "pause"} size={14} /></button>
          {SPEEDS.map(([v, t, tip]) => <button key={v} title={tip} disabled={!clock} className={!paused && speed === v ? "on" : ""} onClick={() => setSpeed(v)}>{t}</button>)}
        </div>
      </div>
      <div className="stats">
        <div className={c.budget < 0 ? "bad" : ""} title="Presupuesto disponible"><Icon name="coins" /><b>{num(c.budget, 0)}</b><small>M USD</small></div>
        <div title="Reputación (desbloquea contratos)"><Icon name="star" /><b>{num(c.reputation)}</b><small>rep.</small></div>
        <div title="Ciencia entregada"><Icon name="flask" /><b>{num(c.science)}</b><small>ciencia</small></div>
      </div>
    </header>
  );
}

function Toast() {
  const { error, clearError } = useGame();
  useEffect(() => { if (!error) return; const t = setTimeout(clearError, 6000); return () => clearTimeout(t); }, [error, clearError]);
  if (!error) return null;
  return <div className="toast" role="alert"><Icon name="alert" /><span>{error}</span><button className="ghost" onClick={clearError}><Icon name="x" size={14} /></button></div>;
}

export function App() {
  const screen = useGame((s) => s.screen);
  useScene(screen);
  useClock(screen);
  useEffect(() => {
    const save = () => useGame.getState().save();
    window.addEventListener("beforeunload", save);
    return () => window.removeEventListener("beforeunload", save);
  }, []);
  const inGame = !["menu", "credits", "explore", "orbit"].includes(screen);
  return (
    <div className={`ui screen-${screen}`}>
      {inGame && <TopBar />}
      {screen === "menu" && <Menu />}
      {screen === "credits" && <Credits />}
      {screen === "hub" && <Hub />}
      {screen === "contracts" && <Contracts />}
      {screen === "vehicle" && <VehicleScreen />}
      {screen === "crew" && <CrewScreen />}
      {screen === "launch" && <LaunchScreen />}
      {screen === "ops" && <OpsScreen />}
      {screen === "landing" && <LandingScreen />}
      {screen === "debrief" && <Debrief />}
      {(screen === "explore" || screen === "orbit") && <SandboxBar />}
      <Toast />
    </div>
  );
}
