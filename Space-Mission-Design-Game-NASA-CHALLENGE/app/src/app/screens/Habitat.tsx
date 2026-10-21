import { useEffect, useRef, useState } from "react";
import { engine } from "../../engine";
import { ROLE_COLOR, ROLE_LABEL, type Astronaut } from "../../game/crew";
import { ACTIVITY_LABEL, createHabitat, LADDERS, ROOMS, SYSTEM_LABEL, stepMinute, type Agent, type Habitat, type SystemId } from "../../game/interior";
import { rngFrom } from "../../game/rng";
import type { ShipState } from "../../game/crewcare";
import { Bar, Icon, num } from "../ui";

const W = 28; // habitat length in model units
const SPEEDS: [number, string][] = [[0, "Pausa"], [1, "1 min/s"], [10, "10 min/s"], [60, "1 h/s"], [240, "4 h/s"]];
const clock = (min: number) => `Día ${Math.floor(min / 1440) + 1} · ${String(Math.floor((min % 1440) / 60)).padStart(2, "0")}:${String(Math.floor(min % 60)).padStart(2, "0")}`;

interface Draw { x: number; y: number }

/** Two-deck cross-section of the transit habitat with the crew living their daily schedule. */
export function HabitatView({ crew, title, ship, onClose }: { crew: Astronaut[]; title: string; ship?: ShipState; onClose: (science: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hab = useRef<Habitat>(seeded(crew, ship));
  const rand = useRef(rngFrom(crew.length * 977 + 13));
  const pos = useRef(new Map<string, Draw>());
  const [speed, setSpeed] = useState(10);
  const [sel, setSel] = useState<string | null>(crew[0]?.id ?? null);
  const [, force] = useState(0);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    let acc = 0, ui = 0;
    return engine.onFrame((dt) => {
      acc += dt * speedRef.current;
      let n = 0;
      while (acc >= 1 && n++ < 600) { stepMinute(hab.current, rand.current); acc -= 1; }
      draw(dt);
      ui += dt;
      if (ui > 0.2) { ui = 0; force((x) => x + 1); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function layout(c: HTMLCanvasElement) {
    const w = c.clientWidth, h = c.clientHeight;
    const pad = 48, hullW = w - pad * 2, deckH = Math.max(110, Math.min(230, (h - 120) / 2));
    const top = (h - deckH * 2 - 16) / 2;
    return { w, h, pad, hullW, deckH, top, sx: (x: number) => pad + (x / W) * hullW, deckY: (d: number) => top + d * (deckH + 16) };
  }

  function draw(dt: number) {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== c.clientWidth * dpr) { c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr; }
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const L = layout(c), h = hab.current;
    const tod = (h.minute % 1440) / 60, night = tod < 6 || tod >= 21.5;
    g.clearRect(0, 0, L.w, L.h);
    // hull
    g.fillStyle = "#0c1018";
    g.strokeStyle = "#3a4558";
    g.lineWidth = 2;
    roundRect(g, L.pad - 18, L.top - 18, L.hullW + 36, L.deckH * 2 + 52, 46);
    g.fill(); g.stroke();
    // rooms
    for (const r of ROOMS) {
      const x0 = L.sx(r.x0), x1 = L.sx(r.x1), y = L.deckY(r.deck);
      const fault = (Object.keys(h.systems) as SystemId[]).some((s) => h.systems[s] < 90 && ((s === "comms" && r.id === "comms") || (s !== "comms" && r.id === "eclss")));
      g.fillStyle = night ? "#121a2a" : "#18202e";
      g.fillRect(x0 + 1, y, x1 - x0 - 2, L.deckH);
      if (fault) { g.fillStyle = `rgba(255,93,108,${0.12 + 0.08 * Math.sin(performance.now() / 200)})`; g.fillRect(x0 + 1, y, x1 - x0 - 2, L.deckH); }
      g.strokeStyle = "#2c3647"; g.lineWidth = 1;
      g.strokeRect(x0 + 1, y, x1 - x0 - 2, L.deckH);
      furniture(g, r.id, x0, x1, y, L.deckH);
      g.fillStyle = "#7e8aa0"; g.font = "600 10px Inter, sans-serif"; g.textAlign = "left";
      g.fillText(r.name.toUpperCase(), x0 + 7, y + 14);
    }
    // floor plates and ladders
    g.fillStyle = "#2c3647";
    for (const d of [0, 1]) g.fillRect(L.sx(0), L.deckY(d) + L.deckH - 3, L.hullW, 3);
    g.strokeStyle = "#5c6a82"; g.lineWidth = 1.5;
    for (const lx of LADDERS) {
      const x = L.sx(lx);
      for (const dx of [-5, 5]) { g.beginPath(); g.moveTo(x + dx, L.deckY(0) + L.deckH - 4); g.lineTo(x + dx, L.deckY(1) + L.deckH); g.stroke(); }
      for (let y = L.deckY(0) + L.deckH; y < L.deckY(1) + L.deckH; y += 9) { g.beginPath(); g.moveTo(x - 5, y); g.lineTo(x + 5, y); g.stroke(); }
    }
    if (night) { g.fillStyle = "rgba(20,40,110,0.18)"; g.fillRect(L.sx(0), L.deckY(0), L.hullW, L.deckH * 2 + 16); }
    // crew
    for (const a of h.agents) {
      const target = agentXY(a, L);
      const p = pos.current.get(a.id) ?? { ...target };
      const k = Math.min(1, dt * 8);
      p.x += (target.x - p.x) * k; p.y += (target.y - p.y) * k;
      pos.current.set(a.id, p);
      const col = ROLE_COLOR[a.role];
      const selected = a.id === sel;
      if (a.activity === "sleep" && a.roomId === "quarters") {
        g.fillStyle = col; roundRect(g, p.x - 12, p.y - 5, 24, 9, 4); g.fill();
        g.fillStyle = "#cfd6e4"; g.font = "9px Inter"; g.textAlign = "center"; g.fillText("z", p.x + 14, p.y - 8);
      } else {
        const bob = a.activity === "walk" ? Math.sin(performance.now() / 90 + a.slot) * 1.5 : 0;
        g.fillStyle = col;
        g.beginPath(); g.arc(p.x, p.y - 22 + bob, 6, 0, Math.PI * 2); g.fill(); // head
        roundRect(g, p.x - 6, p.y - 15 + bob, 12, 15, 4); g.fill(); // body
        if (a.ill) { g.fillStyle = "#ff5d6c"; g.fillRect(p.x + 7, p.y - 30, 3, 8); g.fillRect(p.x + 4.5, p.y - 27.5, 8, 3); }
      }
      if (selected) { g.strokeStyle = "#7df9ff"; g.lineWidth = 1.5; g.beginPath(); g.arc(p.x, p.y - 12, 20, 0, Math.PI * 2); g.stroke(); }
      g.fillStyle = selected ? "#e9ecf2" : "#98a2b3"; g.font = `${selected ? 600 : 500} 10px Inter`; g.textAlign = "center";
      g.fillText(a.name.split(" ")[0], p.x, p.y + 14);
    }
  }

  function agentXY(a: Agent, L: ReturnType<typeof layout>): Draw {
    const floor = (d: number) => L.deckY(d) + L.deckH - 4;
    if (a.climbing > 0) {
      const f = 1 - a.climbing / 1.2;
      return { x: L.sx(a.x), y: floor(a.deck) + (floor(a.targetDeck) - floor(a.deck)) * f };
    }
    if (a.activity === "sleep" && a.roomId === "quarters") return { x: L.sx(1.2 + (a.slot % 2) * 3.2) + 14, y: L.deckY(1) + 30 + Math.floor(a.slot / 2) * 34 };
    return { x: L.sx(a.x), y: floor(a.deck) };
  }

  function pick(e: React.MouseEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let best: string | null = null, bd = 30;
    for (const [id, p] of pos.current) { const d = Math.hypot(p.x - x, p.y - 12 - y); if (d < bd) { bd = d; best = id; } }
    if (best) setSel(best);
  }

  const h = hab.current;
  const a = h.agents.find((x) => x.id === sel);
  return (
    <div className="habitat">
      <header>
        <div><div className="eyebrow">{title}</div><h2>{clock(h.minute)} <small>hora de a bordo (UTC)</small></h2></div>
        <div className="speeds">{SPEEDS.map(([v, t]) => <button key={v} className={speed === v ? "on" : ""} onClick={() => setSpeed(v)}>{t}</button>)}</div>
        <button onClick={() => onClose(h.science)}><Icon name="x" />Cerrar</button>
      </header>
      <div className="hab-body">
        <canvas ref={canvas} onClick={pick} />
        <aside>
          {a ? (
            <section>
              <div className="eyebrow" style={{ color: ROLE_COLOR[a.role] }}>{ROLE_LABEL[a.role]}</div>
              <h3>{a.name}</h3>
              <p className="act">{ACTIVITY_LABEL[a.activity]}{a.task?.kind === "repair" ? ` · ${SYSTEM_LABEL[a.task.system]}` : ""}</p>
              <Bar value={a.needs.energy} max={100} tone={a.needs.energy < 25 ? "bad" : "ok"} label="Energía" right={num(a.needs.energy)} />
              <Bar value={100 - a.needs.hunger} max={100} tone={a.needs.hunger > 80 ? "warn" : "ok"} label="Alimentación" right={num(100 - a.needs.hunger)} />
              <Bar value={a.needs.fitness} max={100} tone={a.needs.fitness < 50 ? "warn" : "ok"} label="Condición física" right={num(a.needs.fitness)} />
              <Bar value={a.needs.stress} max={100} tone={a.needs.stress > 60 ? "bad" : "accent"} label="Estrés" right={num(a.needs.stress)} />
              <Bar value={a.needs.health} max={100} tone={a.needs.health < 80 ? "bad" : "ok"} label="Salud" right={num(a.needs.health)} />
              <div className="kvgrid tiny">
                <div className="kv"><span>Sueño</span><b>{num(a.stats.sleepMin / 60, 1)} h</b></div>
                <div className="kv"><span>Comidas</span><b>{a.stats.meals}</b></div>
                <div className="kv"><span>Ejercicio</span><b>{num(a.stats.exerciseMin)} min</b></div>
                <div className="kv"><span>Laboratorio</span><b>{num(a.stats.scienceMin)} min</b></div>
              </div>
            </section>
          ) : <p className="muted">Haga clic en un tripulante para ver su estado.</p>}
          <section>
            <h3>Sistemas</h3>
            {(Object.keys(h.systems) as SystemId[]).map((s) => <Bar key={s} value={h.systems[s]} max={100} tone={h.systems[s] < 60 ? "bad" : h.systems[s] < 90 ? "warn" : "ok"} label={SYSTEM_LABEL[s]} right={`${num(h.systems[s])} %`} />)}
            <p className="muted small">Ciencia producida a bordo: {num(h.science, 1)}</p>
          </section>
          <section className="grow">
            <h3>Bitácora</h3>
            <ul className="feed short">{h.log.slice(0, 40).map((l, i) => <li key={i} className={l.kind}><time>{clock(l.minute)}</time>{l.text}</li>)}</ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/** Simple furniture silhouettes so each room reads at a glance. */
function furniture(g: CanvasRenderingContext2D, id: string, x0: number, x1: number, y: number, h: number) {
  const fl = y + h - 3, w = x1 - x0;
  g.fillStyle = "#273246";
  if (id === "bridge") { g.fillRect(x0 + 10, fl - 28, w - 20, 10); g.fillStyle = "#2f6f8f"; g.fillRect(x0 + 14, fl - 46, w - 28, 16); }
  if (id === "comms") { g.fillRect(x0 + 8, fl - 26, w - 16, 8); g.fillStyle = "#2f6f8f"; g.fillRect(x0 + 12, fl - 42, w / 3, 12); }
  if (id === "lab") { for (let i = 0; i < 3; i++) g.fillRect(x0 + 10 + i * (w - 20) / 3, fl - 22, (w - 30) / 3, 6); g.fillRect(x0 + 10, y + 26, w - 20, 8); }
  if (id === "med") { g.fillRect(x0 + 8, fl - 16, w - 16, 7); g.fillStyle = "#6b2a35"; g.fillRect(x0 + w / 2 - 2, y + 22, 4, 12); g.fillRect(x0 + w / 2 - 6, y + 26, 12, 4); }
  if (id === "airlock") { g.strokeStyle = "#3a4558"; g.strokeRect(x0 + w / 2 - 14, y + 24, 28, h - 30); g.beginPath(); g.arc(x0 + w / 2, y + h / 2, 7, 0, Math.PI * 2); g.stroke(); }
  if (id === "quarters") { for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) g.fillRect(x0 + 8 + c * (w / 2 - 4), y + 36 + r * 34, w / 2 - 14, 4); }
  if (id === "hygiene") { g.fillRect(x0 + 8, fl - 30, w - 16, 26); }
  if (id === "galley") { g.fillRect(x0 + 16, fl - 18, w - 32, 5); g.fillRect(x0 + w / 2 - 2, fl - 13, 4, 13); g.fillRect(x0 + 6, y + 24, w / 3, 14); }
  if (id === "gym") { g.fillRect(x0 + 8, fl - 6, w / 2, 6); g.fillRect(x0 + w / 2 + 10, fl - 30, 6, 30); g.fillRect(x0 + w / 2 + 2, fl - 30, 22, 4); }
  if (id === "eclss") { for (let i = 0; i < 3; i++) g.fillRect(x0 + 8 + i * ((w - 16) / 3), y + 24, (w - 16) / 3 - 4, h - 30); }
}

/** Start the minute-by-minute habitat from the daily crew/ship state, so both views agree. */
function seeded(crew: Astronaut[], ship?: ShipState): Habitat {
  const h = createHabitat(crew);
  if (!ship) return h;
  h.systems = { ...ship.systems };
  for (const a of h.agents) {
    const c = ship.crew.find((x) => x.id === a.id);
    if (!c) continue;
    a.needs.health = c.health; a.needs.fitness = c.fitness; a.needs.stress = c.stress; a.ill = c.ill;
  }
  return h;
}
