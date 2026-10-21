import { useEffect, useRef, useState } from "react";
import { engine } from "../../engine";
import { altitude, orbitOf } from "../../game/ascent";
import { payloadById } from "../../game/catalog";
import { TARGET_LABEL } from "../../game/contracts";
import { performance, readiness } from "../../game/vehicle";
import { rngFrom } from "../../game/rng";
import { contractOf, fmtDay, useGame } from "../../game/store";
import { Chip, Icon, KV, Panel, kms, num, useTicker } from "../ui";

const DAY = 86400000;
interface Poll { id: string; label: string; ok: boolean; detail: string }

export function LaunchScreen() {
  const { campaign: c, scrub, beginAscent, depart, ascentFailed, advanceDays } = useGame();
  const m = c?.mission, k = contractOf(c);
  const L = engine.launch;
  const [polled, setPolled] = useState(0);
  const [poll, setPoll] = useState<Poll[] | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [warp, setWarp] = useState(1);
  const timer = useRef<number | null>(null);
  useTicker(100);

  useEffect(() => { if (m) L.setVehicle(m.vehicle); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  useEffect(() => { L.warp = warp; }, [warp, L]);

  if (!c || !m || !k) return null;
  const s = L.state;
  const perf = performance(m.vehicle);
  const rd = readiness(perf, m.vehicle, { dvDeparture: k.dvDeparture, dvArrival: k.dvArrival, crew: k.crew, label: TARGET_LABEL[k.target] });
  const crew = c.candidates.filter((a) => m.crewIds.includes(a.id));
  const windowOpen = k.target === "moon" || (m.window !== null && Math.abs(c.date - m.window) <= 25 * DAY);
  const daysToWindow = m.window ? Math.ceil((m.window - c.date) / DAY) : 0;

  function runPoll() {
    if (!c || !m || !k) return;
    const r = rngFrom(c.seed + c.day * 31 + m.scrubs * 7);
    const wind = Math.round(5 + r() * 40), cloud = r();
    const weatherOk = wind < 33 && cloud < 0.85;
    const list: Poll[] = [
      { id: "fd", label: "Director de vuelo", ok: true, detail: "Procedimientos y equipos de control en posición" },
      { id: "range", label: "Seguridad del campo de tiro", ok: r() > 0.04, detail: "Zona de exclusión marítima y aérea despejada" },
      { id: "wx", label: "Meteorología", ok: weatherOk, detail: weatherOk ? `Viento en altura ${wind} m/s, sin riesgo de rayos` : wind >= 33 ? `Cizalladura del viento en altura (${wind} m/s)` : "Nubes de yunque con riesgo de rayos inducidos" },
      { id: "lv", label: "Vehículo de lanzamiento", ok: rd.twrOk && rd.dvMarginLaunch >= 0, detail: `Empuje/peso ${num(perf.liftoffTwr, 2)} · margen ${num(rd.dvMarginLaunch)} m/s` },
      { id: "sc", label: "Nave / carga útil", ok: rd.dvMarginPayload >= 0, detail: `${payloadById(m.vehicle.payload).name} en configuración de lanzamiento` },
      { id: "fdo", label: "Dinámica de vuelo", ok: windowOpen, detail: windowOpen ? (k.target === "moon" ? "Trayectoria translunar calculada" : `Dentro de la ventana hacia ${TARGET_LABEL[k.target]}`) : `Ventana cerrada (abre el ${m.window ? fmtDay(m.window) : "—"})` },
    ];
    if (k.crew) list.push({ id: "crew", label: "Tripulación", ok: crew.length >= k.crew && crew.every((a) => a.training >= 1), detail: crew.length < k.crew ? `Asignados ${crew.length} de ${k.crew}` : crew.every((a) => a.training >= 1) ? "Tripulación certificada y a bordo" : "Entrenamiento incompleto" });
    setPoll(list);
    setPolled(0);
    let i = 0;
    timer.current = window.setInterval(() => { i++; setPolled(i); if (i >= list.length && timer.current) { clearInterval(timer.current); timer.current = null; } }, 380);
  }

  function countdown() {
    let t = 10;
    setCount(t);
    timer.current = window.setInterval(() => {
      t--;
      setCount(t);
      if (t <= 0 && timer.current) {
        clearInterval(timer.current); timer.current = null;
        beginAscent();
        L.ignite(rngFrom(c!.seed + c!.day * 13 + 5));
        setTimeout(() => setCount(null), 1200);
      }
    }, 1000 / Math.max(1, warp));
  }

  const done = !!poll && polled >= poll.length;
  const allGo = done && poll!.every((p) => p.ok);
  const flying = L.status !== "pad";
  const o = s ? orbitOf(s) : null;
  const h = s ? altitude(s) : 0;
  const stageName = s ? s.sequence[Math.min(s.stage, s.sequence.length - 1)].name : "";

  return (
    <div className="layout launch">
      <div className="col left">
        {!flying ? (
          <Panel eyebrow={`${m.vehicle.name} · Complejo de lanzamiento 39 · 28.5° N`} title="Revisión Go / No-Go">
            {!windowOpen && (
              <div className="note warn"><Icon name="clock" /><div>La ventana hacia {TARGET_LABEL[k.target]} abre el {m.window ? fmtDay(m.window) : "—"} (en {num(daysToWindow)} días).
                <div className="row"><button onClick={() => advanceDays(Math.max(1, daysToWindow))}>Avanzar hasta la ventana</button></div></div></div>
            )}
            {crew.length > 0 && <p className="muted small">Tripulación: {crew.map((a) => a.name).join(", ")}.</p>}
            <ul className="poll">
              {(poll ?? []).map((p, i) => (
                <li key={p.id} className={i < polled ? (p.ok ? "go" : "nogo") : "wait"}>
                  <b>{p.label}</b><span>{p.detail}</span><em>{i < polled ? (p.ok ? "GO" : "NO GO") : "…"}</em>
                </li>
              ))}
            </ul>
            {!poll && <p>El director de vuelo consulta a cada consola. Todas deben responder GO para iniciar la cuenta regresiva terminal.</p>}
            <div className="row">
              {!poll && <button className="primary" onClick={runPoll}>Iniciar sondeo Go / No-Go</button>}
              {done && !allGo && <button className="primary" onClick={() => { const why = poll!.find((p) => !p.ok)!; scrub(`${why.label.toLowerCase()}: ${why.detail.toLowerCase()}`); setPoll(null); }}>Suspender y reintentar en 24 h</button>}
              {allGo && count === null && <button className="primary" onClick={countdown}>Iniciar cuenta regresiva terminal</button>}
            </div>
          </Panel>
        ) : (
          <Panel eyebrow={`${m.vehicle.name} · ${stageName}`} title={s?.phase === "orbit" ? "Órbita de estacionamiento" : s?.phase === "failed" ? "Anomalía" : "Ascenso"}>
            <div className="tele big">
              <KV k="T+" v={`${num(s?.t ?? 0)} s`} />
              <KV k="Altitud" v={h > 10000 ? `${num(h / 1000, 1)} km` : `${num(h)} m`} />
              <KV k="Velocidad inercial" v={`${num(o?.speed ?? 0)} m/s`} />
              <KV k="Presión dinámica" v={`${num((s?.q ?? 0) / 1000, 1)} kPa`} sub={`máx. ${num((s?.maxQ ?? 0) / 1000, 1)}`} />
              <KV k="Cabeceo" v={`${num(s?.pitchDeg ?? 90)}°`} />
              <KV k="Masa" v={`${num((s?.mass ?? 0) / 1000)} t`} />
              <KV k="Perigeo" v={!o ? "—" : o.periAlt < 0 ? "Suborbital" : `${num(o.periAlt / 1000)} km`} />
              <KV k="Apogeo" v={o && Number.isFinite(o.apoAlt) ? `${num(o.apoAlt / 1000)} km` : "—"} />
            </div>
            <div className="speeds">{[1, 2, 5, 10, 25].map((w) => <button key={w} className={warp === w ? "on" : ""} onClick={() => setWarp(w)}>{w}×</button>)}</div>
          </Panel>
        )}
      </div>

      {count !== null && <div className="countdown"><span>T−</span>{count}</div>}

      <div className="col right">
        <Panel eyebrow="Secuencia de vuelo" title="Eventos">
          <ul className="feed short">
            {(flying ? s?.events ?? [] : []).slice().reverse().map((e, i) => <li key={i}><time>T+ {num(e.t)} s</time>{e.text}</li>)}
            {!flying && <li className="muted">El vehículo está cargado de propelente en la plataforma.</li>}
          </ul>
        </Panel>
        {s?.phase === "orbit" && (
          <Panel eyebrow="Siguiente maniobra" title={`Inyección hacia ${TARGET_LABEL[k.target]}`} className="accent">
            <div className="kvgrid">
              <KV k="Δv requerido" v={kms(k.dvDeparture)} />
              <KV k="Δv en la etapa superior" v={kms(s.dvLeft)} tone={s.dvLeft >= k.dvDeparture ? "ok" : "warn"} />
            </div>
            {s.dvLeft < k.dvDeparture && <p className="note warn"><Icon name="alert" />Faltan {num(k.dvDeparture - s.dvLeft)} m/s: los cubrirá el motor de la nave, reduciendo su margen para correcciones y para la llegada.</p>}
            <div className="row"><button className="primary" onClick={() => depart(s.dvLeft, s.events.map((e) => `T+${Math.round(e.t)} s: ${e.text}`))}>Ejecutar la inyección<Icon name="next" /></button></div>
          </Panel>
        )}
        {s?.phase === "failed" && (
          <Panel eyebrow="Pérdida del vehículo" title="Falla en el ascenso" className="bad">
            <p>{s.result}</p>
            <div className="row"><button className="primary" onClick={() => ascentFailed(s.result, [])}>Ir al informe de la junta de investigación</button></div>
          </Panel>
        )}
        {!flying && <Panel eyebrow="Vehículo" title={m.vehicle.name}><div className="kvgrid"><KV k="Masa al despegue" v={`${num(perf.liftoffMass / 1000)} t`} /><KV k="Altura" v={`${num(perf.height)} m`} /><KV k="Empuje/peso" v={num(perf.liftoffTwr, 2)} /><KV k="Confiabilidad" v={`${num(perf.reliability * 100, 1)} %`} /></div>
          {m.scrubs > 0 && <Chip tone="warn">{m.scrubs} suspensiones previas</Chip>}</Panel>}
      </div>
    </div>
  );
}
