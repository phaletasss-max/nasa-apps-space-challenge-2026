import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { engine } from "../../engine";
import { toScene } from "../../scenes/solar";
import { planetPosition } from "../../physics/orbits";
import { AU } from "../../physics/constants";
import { TARGET_LABEL } from "../../game/contracts";
import { avoidDv } from "../../game/hazards";
import { transferPosition } from "../../game/trajectory";
import { contractOf, flybyScience, fmtDay, KEEP_OUT_KM, useGame, type Pass } from "../../game/store";
import { Bar, Chip, Icon, KV, Panel, kms, num } from "../ui";
import { HabitatView } from "./Habitat";
import { CAREER_LIMIT_MSV, type ShipState } from "../../game/crewcare";
import { SYSTEM_LABEL, type SystemId } from "../../game/interior";
import type { Astronaut } from "../../game/crew";
import type { LogLine } from "../../game/assembly";

const DAY = 86400000;
const CLASS: Record<string, string> = { MBA: "Cinturón principal", IMB: "Cinturón interior", OMB: "Cinturón exterior", MCA: "Cruza Marte", APO: "Apolo (NEO)", ATE: "Atón (NEO)", AMO: "Amor (NEO)", IEO: "Atira (NEO)", TJN: "Troyano de Júpiter", CEN: "Centauro", HYA: "Hilda" };

/** Δv (m/s) to change the closest approach by `dKm` with the time left before the encounter. */
const tcmDv = (dKm: number, p: Pass, now: number) => avoidDv(Math.max(0, dKm) * 1000, Math.max(DAY, p.dateMs - now) / 1000);
export const avoidCost = (p: Pass, now: number) => tcmDv(KEEP_OUT_KM - p.missKm, p, now);
export const flybyCost = (p: Pass, now: number) => tcmDv(p.missKm - 5000, p, now);

function lunarPoint(s: number) {
  const e = engine.solar.positionOf("earth"), mo = engine.solar.sceneMoon();
  const w = s * s * (3 - 2 * s);
  const d = mo.clone().sub(e);
  const side = new THREE.Vector3(-d.z, 0, d.x).normalize().multiplyScalar(Math.sin(Math.PI * s) * d.length() * 0.25);
  return e.clone().add(d.multiplyScalar(w)).add(side);
}

export function OpsScreen() {
  const { campaign: c, decide, arrive, reenter, addScience, go } = useGame();
  const m = c?.mission, k = contractOf(c);
  const tr = m?.transfer ?? null;
  const [sel, setSel] = useState<string | null>(null);
  const [belt, setBelt] = useState(true);
  const [habitat, setHabitat] = useState(false);
  const selRef = useRef(sel);
  selRef.current = sel;
  const track = useMemo(() => (tr && tr.target !== "moon" ? Array.from({ length: 200 }, (_, i) => toScene(transferPosition(tr, tr.window + ((tr.arrival - tr.window) * i) / 199))) : null), [tr]);

  useEffect(() => {
    const solar = engine.solar;
    solar.select(tr?.target === "moon" ? "earth" : null);
    if (tr?.target !== "moon") { solar.camera.position.set(0, 30, 42); solar.controls.target.set(0, 0, 0); }
    let acc = 1;
    return engine.onFrame((dt) => {
      const g = useGame.getState().campaign;
      const mm = g?.mission;
      if (!g || !mm?.transfer) return;
      solar.setDate(g.date);
      const t = mm.transfer;
      const back = mm.phase === "return" || mm.phase === "reentry";
      const out = Math.max(0, Math.min(1, (g.date - t.window) / (t.arrival - t.window)));
      const ret = back && mm.returnStart && mm.returnAt ? Math.max(0, Math.min(1, (g.date - mm.returnStart) / (mm.returnAt - mm.returnStart))) : 0;
      if (t.target === "moon") {
        // outbound arc Earth -> Moon; on the way home the same arc is flown backwards
        const pts = Array.from({ length: 80 }, (_, i) => lunarPoint(back ? 1 - i / 79 : i / 79));
        solar.setGameTrack(pts, back ? ret : out);
        solar.setGameCraft(lunarPoint(back ? 1 - ret : out));
      } else {
        solar.setGameTrack(track ?? [], out);
        solar.setGameCraft(toScene(transferPosition(t, g.date)));
      }
      acc += dt;
      if (acc > 0.25) { acc = 0; solar.setHazards(mm.passes.map((p) => ({ name: p.name, level: p.level, selected: p.name === selRef.current, done: p.done }))); }
    });
  }, [tr, track]);
  useEffect(() => { engine.solar.showBelt(belt); }, [belt]);

  if (!c || !m || !k || !tr) return <div className="layout"><Panel title="Sin nave en vuelo"><p>No hay ninguna misión en crucero.</p></Panel></div>;
  const elapsed = (c.date - tr.window) / DAY, total = tr.tofDays;
  const back = m.phase === "return" || m.phase === "reentry";
  const retTotal = m.returnStart && m.returnAt ? (m.returnAt - m.returnStart) / DAY : 0;
  const retDone = m.returnStart ? (c.date - m.returnStart) / DAY : 0;
  const surfLeft = Math.max(0, ((m.surfaceUntil ?? c.date) - c.date) / DAY);
  const title = m.phase === "arrived" ? `Llegada a ${TARGET_LABEL[k.target]}` : m.phase === "surface" ? `En la superficie de ${TARGET_LABEL[k.target]}`
    : back ? "Regreso a la Tierra" : `Crucero hacia ${TARGET_LABEL[k.target]}`;
  const ship = transferPosition(tr, c.date);
  const earth = planetPosition("earth", c.date);
  const distM = Math.hypot(ship[0] - earth[0], ship[1] - earth[1], ship[2] - earth[2]);
  const crew = c.candidates.filter((a) => m.crewIds.includes(a.id));
  const passes = [...m.passes].sort((a, b) => a.dateMs - b.dateMs);
  const p = passes.find((x) => x.name === sel) ?? null;
  const arrived = m.phase === "arrived";
  const lightS = distM / 299792458;

  return (
    <div className="layout">
      <div className="col left">
        <Panel eyebrow={`Operaciones de vuelo · ${m.vehicle.name}`} title={title}>
          {back ? <Bar value={retDone} max={retTotal} tone="accent" label={`Regreso: día ${num(Math.max(0, retDone), 1)} de ${num(retTotal, 1)}`} right={m.phase === "reentry" ? "Interfaz de reentrada" : `faltan ${num(Math.max(0, retTotal - retDone), 1)} días`} />
            : m.phase === "surface" ? <Bar value={(k.surfaceDays ?? 3) - surfLeft} max={k.surfaceDays ?? 3} tone="ok" label="Estancia en superficie" right={`faltan ${num(surfLeft, 1)} días`} />
            : <Bar value={elapsed} max={total} tone="accent" label={`Día ${num(Math.max(0, elapsed))} de ${num(total)}`} right={arrived ? "Llegada" : `faltan ${num(Math.max(0, total - elapsed))} días`} />}
          <div className="kvgrid">
            <KV k="Lanzamiento" v={m.launchDate ? fmtDay(m.launchDate) : "—"} />
            <KV k="Llegada prevista" v={fmtDay(tr.arrival)} />
            <KV k="Distancia a la Tierra" v={distM > 0.02 * AU ? `${num(distM / AU, 3)} UA` : `${num(distM / 1000)} km`} />
            <KV k="Retardo de la señal" v={lightS > 90 ? `${num(lightS / 60, 1)} min` : `${num(lightS, 1)} s`} />
            <KV k="Margen de Δv" v={`${num(m.dvMargin, 1)} m/s`} tone={m.dvMargin < 0 ? "bad" : m.dvMargin < 50 ? "warn" : "ok"} sub={`gastado en correcciones: ${num(m.dvSpent, 2)} m/s`} />
            <KV k="Ciencia en ruta" v={num(m.science)} />
          </div>
          {crew.length > 0 && (
            <div className="row"><button onClick={() => setHabitat(true)}><Icon name="habitat" />Ver la vida a bordo ({crew.length} tripulantes)</button></div>
          )}
          {arrived && (
            <div className="note accent"><Icon name="target" /><div>
              {k.landing ? `La nave está en aproximación a ${TARGET_LABEL[k.target]}. Ejecute la maniobra de llegada para iniciar la entrada, descenso y aterrizaje.`
                : k.dvArrival ? `Ejecute la maniobra de inserción orbital (${kms(k.dvArrival)}).` : "Sobrevuelo: los instrumentos registran el encuentro."}
              <div className="row"><button className="primary" onClick={arrive}>{k.landing ? "Iniciar entrada y descenso" : k.dvArrival ? "Ejecutar inserción orbital" : "Completar el sobrevuelo"}<Icon name="next" /></button></div>
            </div></div>
          )}
          {m.phase === "reentry" && (
            <div className="note accent"><Icon name="land" /><div>
              La cápsula llega a la interfaz de reentrada a unos 11 km/s. El escudo térmico, los paracaídas y el equipo de recuperación están listos.
              <div className="row"><button className="primary" onClick={reenter}>Autorizar la reentrada y el amerizaje<Icon name="next" /></button></div>
            </div></div>
          )}
          {m.phase === "failed" && <div className="row"><button className="primary" onClick={() => go("debrief")}>Ver el informe</button></div>}
        </Panel>
        {m.ship && <CrewPanel ship={m.ship} crew={crew} log={m.shipLog} />}
      </div>

      <div className="col right wide">
        <Panel eyebrow="Defensa planetaria aplicada a la navegación" title="Predictor de riesgos en ruta"
          actions={<label className="toggle"><input type="checkbox" checked={belt} onChange={(e) => setBelt(e.target.checked)} />Catálogo completo</label>}>
          <p className="muted small">Objetos del JPL Small-Body Database propagados hasta la llegada. Zona de exclusión operacional: {num(KEEP_OUT_KM / 1e6)} millones de km. Corregir antes cuesta menos: Δv ≈ distancia / tiempo restante.</p>
          {passes.length === 0 ? <p className="note ok"><Icon name="check" />Ningún objeto catalogado pasa a menos de 8 millones de km de la trayectoria.</p> : (
            <table className="tbl hz">
              <thead><tr><th>Objeto</th><th>Mín. distancia</th><th>Fecha</th><th>Vel. rel.</th><th>Estado</th></tr></thead>
              <tbody>{passes.map((x) => (
                <tr key={x.name} className={`${x.name === sel ? "on" : ""} ${x.done ? "done" : ""}`} onClick={() => setSel(x.name)}>
                  <td><b>{x.name}</b><small>{CLASS[x.cls] ?? x.cls}{x.pha ? " · PHA" : ""}</small></td>
                  <td>{num(x.missKm / 1e6, 2)} M km</td>
                  <td>{fmtDay(x.dateMs)}</td>
                  <td>{num(x.relSpeedKms, 1)} km/s</td>
                  <td>{x.done ? <Chip tone="muted">Pasado</Chip> : x.decision === "avoid" ? <Chip tone="ok">Evitado</Chip> : x.decision === "flyby" ? <Chip tone="accent">Sobrevuelo</Chip>
                    : <Chip tone={x.level === "alert" ? "bad" : x.level === "flyby" ? "ok" : "warn"}>{x.level === "alert" ? "Zona de exclusión" : x.level === "flyby" ? "Oportunidad" : "Vigilancia"}</Chip>}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
          {p && <PassDetail p={p} now={c.date} margin={m.dvMargin} decide={decide} />}
        </Panel>
      </div>
      {habitat && <HabitatView crew={crew.slice(0, 4)} ship={m.ship ?? undefined} title={`Hábitat de tránsito · ${back ? "regreso a la Tierra" : `rumbo a ${TARGET_LABEL[k.target]}`}`} onClose={(sci) => { setHabitat(false); if (sci > 1) addScience(Math.round(sci)); }} />}
    </div>
  );
}

function PassDetail({ p, now, margin, decide }: { p: Pass; now: number; margin: number; decide: (n: string, d: Pass["decision"], dv: number) => void }) {
  const lead = (p.dateMs - now) / DAY;
  const av = avoidCost(p, now), fb = flybyCost(p, now);
  return (
    <div className="pass">
      <h3>{p.name}</h3>
      <div className="kvgrid">
        <KV k="Diámetro" v={`${p.sizeEstimated ? "≈ " : ""}${num(p.sizeKm, p.sizeKm < 10 ? 1 : 0)} km`} sub={p.sizeEstimated ? "estimado por magnitud absoluta" : "medido"} />
        <KV k="Encuentro en" v={lead > 0 ? `${num(lead)} días` : "pasado"} />
        <KV k="Prob. de impacto" v={p.collisionProb < 1e-12 ? "< 10⁻¹²" : p.collisionProb.toExponential(1)} sub="incertidumbre de efemérides" />
      </div>
      {!p.done && p.decision === "none" && (
        <div className="row wrap">
          {p.level === "alert" && <button className="primary" disabled={av > margin} onClick={() => decide(p.name, "avoid", av)}>Maniobra de evasión · {num(av, av < 1 ? 3 : 1)} m/s</button>}
          <button disabled={fb > margin} onClick={() => decide(p.name, "flyby", fb)}>Sobrevuelo científico a 5 000 km · {num(fb, fb < 1 ? 3 : 1)} m/s · +{flybyScience(p.sizeKm)} ciencia</button>
        </div>
      )}
      {(av > margin || fb > margin) && !p.done && p.decision === "none" && <p className="muted small">Las maniobras más caras que el margen de Δv no están disponibles.</p>}
      <p className="muted small">En la realidad la probabilidad de choque en el espacio interplanetario es ínfima; las misiones planifican sobrevuelos a propósito (Galileo–Gaspra, NEAR–Mathilde, Lucy–Dinkinesh).</p>
    </div>
  );
}


/** Daily crew condition (health, fitness, stress, radiation dose) and ship systems. */
function CrewPanel({ ship, crew, log }: { ship: ShipState; crew: Astronaut[]; log: LogLine[] }) {
  return (
    <Panel eyebrow={`Día ${ship.days} de vuelo`} title="Estado de la tripulación">
      <div className="crewcond">
        {ship.crew.map((x) => {
          const a = crew.find((y) => y.id === x.id);
          return (
            <div key={x.id} className="cc">
              <div className="cc-h"><b>{a?.name ?? x.id}</b>{x.ill ? <Chip tone="bad">En tratamiento</Chip> : <Chip tone="ok">Apto</Chip>}</div>
              <Bar value={x.health} max={100} tone={x.health < 60 ? "bad" : "ok"} label="Salud" right={num(x.health)} />
              <Bar value={x.fitness} max={100} tone={x.fitness < 60 ? "warn" : "ok"} label="Condición física" right={num(x.fitness)} />
              <Bar value={x.stress} max={100} tone={x.stress > 60 ? "bad" : "accent"} label="Estrés" right={num(x.stress)} />
              <Bar value={x.doseMsv} max={CAREER_LIMIT_MSV} tone={x.doseMsv > 300 ? "warn" : "accent"} label="Dosis de radiación" right={`${num(x.doseMsv, 1)} mSv`} />
            </div>
          );
        })}
      </div>
      <h3>Sistemas</h3>
      {(Object.keys(ship.systems) as SystemId[]).map((k) => <Bar key={k} value={ship.systems[k]} max={100} tone={ship.systems[k] < 60 ? "bad" : ship.systems[k] < 90 ? "warn" : "ok"} label={SYSTEM_LABEL[k]} right={`${num(ship.systems[k])} %`} />)}
      <p className="muted small">Ciencia a bordo: {num(ship.science)} puntos.</p>
      {log.length > 0 && <ul className="feed short">{log.slice(0, 12).map((l, i) => <li key={i} className={l.kind}><time>{fmtDay(l.date)}</time>{l.text}</li>)}</ul>}
    </Panel>
  );
}
