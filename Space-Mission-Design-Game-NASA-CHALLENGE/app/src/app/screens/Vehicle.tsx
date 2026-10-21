import { useEffect, useMemo } from "react";
import { engine } from "../../engine";
import { BOOSTERS, ENGINES, engineById, payloadById, type Vehicle } from "../../game/catalog";
import { performance, readiness, DV_TO_LEO } from "../../game/vehicle";
import { planAssembly, progressOf, stepDay, TEAM_COST_PER_DAY, type Assembly } from "../../game/assembly";
import { TARGET_LABEL } from "../../game/contracts";
import { contractOf, CREDIT_LINE, fmtDay, MAX_TEAMS, programCost, useGame } from "../../game/store";
import { Bar, Chip, Icon, KV, Panel, kms, musd, num, tons } from "../ui";

const DAY = 86400000;

const PRESETS: { name: string; v: Omit<Vehicle, "payload"> }[] = [
  { name: "Medio (clase Falcon 9)", v: { name: "Cóndor I", boosters: null, stages: [{ engine: "k1", count: 9, propT: 410 }, { engine: "k1v", count: 1, propT: 108 }] } },
  { name: "Medio con boosters sólidos", v: { name: "Cóndor IS", boosters: { id: "srb-s", count: 4 }, stages: [{ engine: "k1", count: 9, propT: 410 }, { engine: "k1v", count: 1, propT: 108 }] } },
  { name: "Medio con etapa de hidrógeno", v: { name: "Cóndor IH", boosters: { id: "srb-s", count: 4 }, stages: [{ engine: "k1", count: 9, propT: 410 }, { engine: "rl", count: 2, propT: 30 }] } },
  { name: "Pesado (clase SLS Block 1)", v: { name: "Apu", boosters: { id: "srb-l", count: 2 }, stages: [{ engine: "h2", count: 4, propT: 987 }, { engine: "rl", count: 1, propT: 28 }] } },
  { name: "Superpesado de metano", v: { name: "Inti", boosters: null, stages: [{ engine: "m2", count: 20, propT: 3000 }, { engine: "m2", count: 3, propT: 900 }, { engine: "rl", count: 2, propT: 40 }] } },
];

/** Deterministic forecast of start/end per task (no test failures). */
function forecast(a: Assembly) {
  const sim: Assembly = structuredClone(a);
  let guard = 0;
  while (!sim.complete && guard++ < 4000) stepDay(sim, () => 0.5);
  return { end: sim.date, tasks: new Map(sim.tasks.map((t) => [t.id, { start: t.start ?? sim.date, end: t.end ?? sim.date }])) };
}

export function VehicleScreen() {
  const { campaign: c, setVehicle, startBuild, setTeams, go, saveDesign, deleteDesign } = useGame();
  const m = c?.mission, k = contractOf(c);
  const v = m?.vehicle;
  const perf = useMemo(() => (v ? performance(v) : null), [v]);
  const ready = useMemo(() => (perf && v && k ? readiness(perf, v, { dvDeparture: k.dvDeparture, dvArrival: k.dvArrival, crew: k.crew, label: TARGET_LABEL[k.target] }) : null), [perf, v, k]);
  const plan = useMemo(() => (v && m?.phase === "design" && c ? forecast(planAssembly(v, c.date, c.teams)) : null), [v, m?.phase, c?.teams]); // eslint-disable-line react-hooks/exhaustive-deps
  const live = useMemo(() => (m?.assembly && !m.assembly.complete ? forecast(m.assembly) : null), [m?.assembly && Math.floor(m.assembly.date / (5 * DAY)), c?.teams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (v) engine.vab.setVehicle(v); }, [v]);
  useEffect(() => { if (m) engine.vab.setState(m.phase === "design" ? "design" : m.phase === "building" ? "build" : "ready", m.assembly); }, [m?.phase, m?.assembly]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!c || !m || !k || !v || !perf || !ready) return <div className="layout"><Panel title="Sin misión activa"><p>Firme un contrato para diseñar un vehículo.</p></Panel></div>;
  const design = m.phase === "design";
  const edit = (f: (x: Vehicle) => void) => { const x = structuredClone(v); f(x); setVehicle(x); };
  const pay = payloadById(v.payload);
  const needLaunch = DV_TO_LEO + k.dvDeparture;
  const estCost = plan ? planAssembly(v, c.date, c.teams).tasks.reduce((s, t) => s + t.cost, 0) + c.teams * TEAM_COST_PER_DAY * ((plan.end - c.date) / DAY) : 0;
  const hardware = programCost(v);
  const late = (end: number) => k.target !== "moon" && m.window !== null && end > m.window + 25 * DAY;

  return (
    <div className="layout">
      <div className="col left wide">
        {design ? (
          <Panel eyebrow={`Diseño · ${k.title}`} title="Configuración del vehículo"
            actions={<select value="" onChange={(e) => {
              const [kind, i] = e.target.value.split(":");
              const src = kind === "p" ? PRESETS[Number(i)]?.v : c.designs[Number(i)];
              if (src) setVehicle({ ...structuredClone(src), payload: k.payloads.includes((src as Vehicle).payload) ? (src as Vehicle).payload : v.payload });
            }}>
              <option value="">Cargar diseño…</option>
              <optgroup label="Referencias">{PRESETS.map((p, i) => <option key={p.name} value={`p:${i}`}>{p.name}</option>)}</optgroup>
              {c.designs.length > 0 && <optgroup label="Biblioteca de la agencia">{c.designs.map((d, i) => <option key={d.name} value={`d:${i}`}>{d.name}</option>)}</optgroup>}
            </select>}>
            <div className="form2">
              <label className="field-l">Nombre<input value={v.name} maxLength={24} onChange={(e) => edit((x) => { x.name = e.target.value; })} /></label>
              <label className="field-l">Carga útil<select value={v.payload} onChange={(e) => edit((x) => { x.payload = e.target.value; })}>
                {k.payloads.map((p) => <option key={p} value={p}>{payloadById(p).name}</option>)}</select></label>
            </div>
            <p className="muted small">{pay.desc} Masa {tons(pay.mass)} · Δv propio {kms(pay.ownDv)}{pay.crew ? ` · ${pay.crew} asientos` : ""}.</p>

            <h3>Propulsores auxiliares</h3>
            <div className="form2">
              <label className="field-l">Tipo<select value={v.boosters?.id ?? ""} onChange={(e) => edit((x) => { x.boosters = e.target.value ? { id: e.target.value, count: e.target.value === "srb-l" ? 2 : 4 } : null; })}>
                <option value="">Sin boosters</option>{BOOSTERS.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.ref})</option>)}</select></label>
              {v.boosters && <label className="field-l">Cantidad<select value={v.boosters.count} onChange={(e) => edit((x) => { x.boosters!.count = Number(e.target.value); })}>
                {(v.boosters.id === "srb-l" ? [2, 4] : [2, 4, 6]).map((n) => <option key={n}>{n}</option>)}</select></label>}
            </div>

            {v.stages.map((s, i) => {
              const e = engineById(s.engine);
              const maxN = i === 0 ? (e.thrustSL > 2000 ? 33 : 12) : 4;
              const maxP = i === 0 ? 4000 : i === 1 ? 1200 : 200;
              return (
                <fieldset key={i} className="stage">
                  <legend>Etapa {i + 1}{i === 0 ? " (primera)" : ""}</legend>
                  {i > 0 && i === v.stages.length - 1 && <button className="icon-btn" title="Quitar etapa" onClick={() => edit((x) => { x.stages.pop(); })}><Icon name="x" size={14} /></button>}
                  <label className="field-l">Motor<select value={s.engine} onChange={(ev) => edit((x) => { x.stages[i].engine = ev.target.value; x.stages[i].count = Math.min(x.stages[i].count, maxN); })}>
                    {ENGINES.filter((en) => i > 0 || !en.upperOnly).map((en) => <option key={en.id} value={en.id}>{en.name} · {en.ref}</option>)}</select></label>
                  <div className="slider"><span>Motores</span><input type="range" min={1} max={maxN} value={s.count} onChange={(ev) => edit((x) => { x.stages[i].count = Number(ev.target.value); })} /><b>{s.count}</b></div>
                  <div className="slider"><span>Propelente</span><input type="range" min={i === 0 ? 50 : 5} max={maxP} step={i === 0 ? 10 : 1} value={s.propT} onChange={(ev) => edit((x) => { x.stages[i].propT = Number(ev.target.value); })} /><b>{num(s.propT)} t</b></div>
                  <p className="muted small">Empuje {num((i === 0 ? e.thrustSL : e.thrustVac) * s.count)} kN {i === 0 ? "al nivel del mar" : "en vacío"} · Isp {e.ispVac} s · Confiabilidad {num(e.reliability * 100, 1)} % por motor</p>
                </fieldset>
              );
            })}
            <div className="row wrap">
              {v.stages.length < 3 && <button className="ghost" onClick={() => edit((x) => { x.stages.push({ engine: "rl", count: 1, propT: 20 }); })}><Icon name="plus" />Añadir etapa superior</button>}
              <button onClick={() => saveDesign(v)} disabled={!v.name.trim()}><Icon name="save" />Guardar en la biblioteca</button>
            </div>
            {c.designs.length > 0 && (
              <>
                <h3>Biblioteca de diseños</h3>
                <ul className="lib">{c.designs.map((d) => (
                  <li key={d.name}><span>{d.name}</span><small>{musd(performance(d).cost)} · {num(performance(d).liftoffMass / 1000)} t</small>
                    <button className="ghost icon-btn" title="Eliminar de la biblioteca" onClick={() => deleteDesign(d.name)}><Icon name="x" size={14} /></button></li>
                ))}</ul>
              </>
            )}
          </Panel>
        ) : (
          <Production />
        )}
      </div>

      <div className="col right wide">
        <Panel eyebrow={`${v.name} · ${num(perf.height, 0)} m · ${tons(perf.liftoffMass)}`} title="Análisis de desempeño">
          <div className="dvchart">
            <Bar value={perf.dvLaunch} max={Math.max(perf.dvLaunch, needLaunch) * 1.05} tone={ready.dvMarginLaunch >= 0 ? "ok" : "bad"} label="Δv del vehículo" right={kms(perf.dvLaunch)} />
            <Bar value={needLaunch} max={Math.max(perf.dvLaunch, needLaunch) * 1.05} tone="warn" label={`Requerido: órbita baja + salida a ${TARGET_LABEL[k.target]}`} right={kms(needLaunch)} />
            <Bar value={pay.ownDv} max={Math.max(pay.ownDv, k.dvArrival, 1) * 1.05} tone={ready.dvMarginPayload >= 0 ? "ok" : "bad"} label="Δv de la nave (llegada)" right={`${kms(pay.ownDv)} / ${kms(k.dvArrival)}`} />
          </div>
          <table className="tbl">
            <thead><tr><th>Etapa</th><th>Masa</th><th>Isp</th><th>Δv</th><th>E/P</th><th>Combustión</th></tr></thead>
            <tbody>{perf.stages.map((s) => (
              <tr key={s.label}><td>{s.label}</td><td>{tons(s.wet)}</td><td>{num(s.isp)} s</td><td>{kms(s.dv)}</td><td className={s.label !== "Etapa 1" && s.label !== "Boosters" ? "" : s.twr < 1.15 ? "bad" : ""}>{num(s.twr, 2)}</td><td>{num(s.burnS)} s</td></tr>
            ))}</tbody>
          </table>
          <div className="kvgrid">
            <KV k="Empuje/peso al despegue" v={num(perf.liftoffTwr, 2)} tone={ready.twrOk ? "ok" : "bad"} />
            <KV k="Margen de Δv" v={`${ready.dvMarginLaunch >= 0 ? "+" : ""}${num(ready.dvMarginLaunch)} m/s`} tone={ready.dvMarginLaunch >= 0 ? "ok" : "bad"} />
            <KV k="Confiabilidad estimada" v={`${num(perf.reliability * 100, 1)} %`} />
            <KV k="Costo del hardware" v={musd(perf.cost)} />
          </div>
          {ready.issues.length > 0 ? (
            <ul className="issues">{ready.issues.map((x) => <li key={x}><Icon name="alert" />{x}</li>)}</ul>
          ) : <p className="note ok"><Icon name="check" />El diseño cumple todos los requisitos de la misión.</p>}
          {design && plan && (
            <>
              <h3>Estimación del programa</h3>
              <div className="kvgrid">
                <KV k="Fin de fabricación" v={fmtDay(plan.end)} tone={late(plan.end) ? "warn" : undefined} sub={`${num((plan.end - c.date) / DAY)} días con ${c.teams} equipos`} />
                {k.target === "moon" ? <KV k="Lanzamiento" v={fmtDay(plan.end)} sub="la Luna admite lanzar cualquier día" />
                  : <KV k="Ventana" v={m.window ? fmtDay(m.window) : "—"} sub={late(plan.end) ? "no se llega: se usará la siguiente" : "a tiempo"} />}
                <KV k="Costo del programa" v={musd(estCost)} tone={hardware > c.budget + CREDIT_LINE ? "bad" : estCost > c.budget ? "warn" : undefined} sub={`hardware ${musd(hardware)} · disponible con crédito ${musd(c.budget + CREDIT_LINE)}`} />
              </div>
              <TeamControl teams={c.teams} setTeams={setTeams} />
              <div className="row"><button className="primary" disabled={!ready.ok || !v.name.trim() || hardware > c.budget + CREDIT_LINE} onClick={startBuild}>Congelar diseño e iniciar fabricación<Icon name="next" /></button></div>
            </>
          )}
          {!design && live && (
            <div className="kvgrid">
              <KV k="Fin proyectado" v={fmtDay(live.end)} tone={late(live.end) ? "warn" : "ok"} sub={late(live.end) ? "después de la ventana" : "antes del cierre de la ventana"} />
              {k.target === "moon" ? <KV k="Lanzamiento" v={fmtDay(live.end)} sub="al terminar la fabricación" /> : <KV k="Ventana" v={m.window ? fmtDay(m.window) : "—"} />}
            </div>
          )}
          {m.phase === "ready" && <div className="row"><button className="primary" onClick={() => go("launch")}>Ir al control de lanzamiento<Icon name="next" /></button></div>}
        </Panel>
      </div>
    </div>
  );
}

function TeamControl({ teams, setTeams }: { teams: number; setTeams: (n: number) => void }) {
  return (
    <div className="teams">
      <span>Equipos de ingeniería</span>
      <button className="icon-btn" disabled={teams <= 1} onClick={() => setTeams(teams - 1)}><Icon name="minus" size={14} /></button>
      <b>{teams}</b>
      <button className="icon-btn" disabled={teams >= MAX_TEAMS} onClick={() => setTeams(teams + 1)}><Icon name="plus" size={14} /></button>
      <small>{musd(teams * TEAM_COST_PER_DAY * 30)} / mes</small>
    </div>
  );
}

function Production() {
  const { campaign: c, setTeams } = useGame();
  const m = c?.mission;
  const a = m?.assembly;
  const fc = useMemo(() => (a && !a.complete ? forecast(a) : null), [a && Math.floor(a.date / (5 * DAY)), c?.teams]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c || !m || !a) return null;
  const t0 = Math.min(...a.tasks.map((t) => t.start ?? a.date), a.log[a.log.length - 1].date);
  const end = Math.max(fc?.end ?? a.date, a.date);
  const t1 = end + (end - t0) * 0.08 + 5 * DAY;
  const winIn = m.window !== null && m.window <= t1;
  const x = (t: number) => `${((t - t0) / (t1 - t0)) * 100}%`;
  const groups = [...new Set(a.tasks.map((t) => t.group))];
  return (
    <Panel eyebrow={`Fabricación · ${m.vehicle.name}`} title="Programa de fabricación e integración"
      actions={<Chip tone={a.complete ? "ok" : "accent"}>{a.complete ? "Completado" : `${num(progressOf(a) * 100)} %`}</Chip>}>
      <TeamControl teams={c.teams} setTeams={setTeams} />
      <div className="gantt">
        <div className="g-axis">
          <span style={{ left: x(c.date) }} className="today">Hoy</span>
          {m.window && <span style={winIn ? { left: x(m.window) } : { right: 0, transform: "none" }} className="win">{winIn ? "Ventana" : `Ventana ${fmtDay(m.window)}`}</span>}
        </div>
        {groups.map((g) => (
          <div key={g} className="g-group">
            <div className="g-gname">{g}</div>
            {a.tasks.filter((t) => t.group === g).map((t) => {
              const f = fc?.tasks.get(t.id);
              const start = t.start ?? f?.start ?? a.date, end = t.end ?? f?.end ?? a.date;
              return (
                <div key={t.id} className={`g-row ${t.status}`}>
                  <div className="g-name" title={t.name}>
                    {t.kind === "test" ? <Icon name="target" size={12} /> : t.kind === "integrate" ? <Icon name="layers" size={12} /> : <Icon name="wrench" size={12} />}
                    <span>{t.name}</span>{t.attempts > 1 && <Chip tone="bad">{t.attempts}º intento</Chip>}{t.teams > 0 && !a.complete && t.status !== "done" && <Chip tone="accent">{t.teams} eq.</Chip>}
                  </div>
                  <div className="g-track">
                    <div className="g-bar" style={{ left: x(start), width: `calc(${x(Math.max(end, start + DAY))} - ${x(start)})` }}><i style={{ width: `${t.progress * 100}%` }} /></div>
                    <div className="g-today" style={{ left: x(c.date) }} />
                    {winIn && <div className="g-win" style={{ left: x(m.window!) }} />}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <h3>Bitácora de producción</h3>
      <ul className="feed short">{a.log.slice(0, 30).map((l, i) => <li key={i} className={l.kind}><time>{fmtDay(l.date)}</time>{l.text}</li>)}</ul>
      <p className="muted small">Gasto acumulado: {musd(a.spent)}. Las pruebas pueden fallar según la confiabilidad de los componentes; un fallo obliga a analizar la anomalía y repetir.</p>
    </Panel>
  );
}
