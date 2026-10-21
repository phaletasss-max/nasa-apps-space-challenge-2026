import { contractOf, CREDIT_LINE, fmtDay, useGame, type MissionPhase, type Screen } from "../../game/store";
import { TARGET_LABEL } from "../../game/contracts";
import { payloadById } from "../../game/catalog";
import { progressOf } from "../../game/assembly";
import { Bar, Chip, Icon, KV, Panel, musd, num } from "../ui";

const STEPS: { id: MissionPhase[]; label: string }[] = [
  { id: ["design"], label: "Diseño" },
  { id: ["building"], label: "Fabricación" },
  { id: ["ready", "ascent"], label: "Lanzamiento" },
  { id: ["cruise"], label: "Crucero" },
  { id: ["arrived", "landing", "surface"], label: "Llegada" },
  { id: ["return", "reentry"], label: "Regreso" },
  { id: ["complete", "failed"], label: "Cierre" },
];

const NEXT: Record<MissionPhase, { text: string; screen: Screen; cta: string }> = {
  design: { text: "Diseña un vehículo que cumpla los requisitos de Δv y congélalo para iniciar la fabricación.", screen: "vehicle", cta: "Abrir el diseño del vehículo" },
  building: { text: "La fabricación avanza día a día. Ajusta los equipos de ingeniería para llegar a la ventana.", screen: "vehicle", cta: "Ver el programa de fabricación" },
  ready: { text: "El vehículo está en la plataforma. Realiza la revisión Go/No-Go cuando se abra la ventana.", screen: "launch", cta: "Ir al control de lanzamiento" },
  ascent: { text: "Lanzamiento en curso.", screen: "launch", cta: "Ir al control de lanzamiento" },
  cruise: { text: "La nave está en crucero. Vigila el predictor de riesgos y decide las maniobras.", screen: "ops", cta: "Abrir operaciones de vuelo" },
  arrived: { text: "La nave llegó a destino. Ejecuta la maniobra de llegada.", screen: "ops", cta: "Abrir operaciones de vuelo" },
  landing: { text: "Descenso a la superficie en curso.", screen: "landing", cta: "Ir al descenso" },
  surface: { text: "La tripulación trabaja en la superficie.", screen: "ops", cta: "Abrir operaciones de vuelo" },
  return: { text: "La cápsula regresa a la Tierra.", screen: "ops", cta: "Abrir operaciones de vuelo" },
  reentry: { text: "La cápsula llegó a la Tierra: autorice la reentrada.", screen: "ops", cta: "Abrir operaciones de vuelo" },
  complete: { text: "Misión cerrada.", screen: "debrief", cta: "Ver informe" },
  failed: { text: "Misión perdida.", screen: "debrief", cta: "Ver informe" },
};

export function Hub() {
  const { campaign: c, go } = useGame();
  if (!c) return null;
  const k = contractOf(c), m = c.mission;
  const flown = c.history.length, ok = c.history.filter((h) => h.success).length;
  const crew = c.candidates.filter((a) => a.hired);
  const building = m?.phase === "building";
  const burn = (building ? c.teams * 0.06 : c.teams * 0.03) + crew.reduce((x, a) => x + a.salary / 365, 0);
  const idx = m ? STEPS.findIndex((s) => s.id.includes(m.phase)) : -1;
  if (c.over) return (
    <div className="layout center-only">
      <Panel eyebrow="Fin de la campaña" title="La agencia entró en quiebra" className="debrief bad">
        <p>{c.over.reason} Fecha: {fmtDay(c.over.date)}.</p>
        <div className="kvgrid four">
          <KV k="Misiones exitosas" v={`${ok} / ${flown}`} />
          <KV k="Ciencia entregada" v={num(c.science)} />
          <KV k="Reputación final" v={num(c.reputation)} />
          <KV k="Días de operación" v={num(c.day)} />
        </div>
        <div className="row"><button className="primary" onClick={() => go("menu")}>Volver al menú principal</button></div>
      </Panel>
    </div>
  );
  return (
    <div className="layout">
      <div className="col left">
        <Panel eyebrow="Agencia" title={c.agency}>
          <div className="kvgrid">
            <KV k="Presupuesto" v={musd(c.budget)} tone={c.budget < 0 ? "bad" : undefined} />
            <KV k="Ciencia entregada" v={num(c.science)} />
            <KV k="Misiones" v={`${ok} / ${flown}`} sub="exitosas / totales" />
            <KV k="Astronautas" v={num(crew.length)} />
            <KV k="Equipos de ingeniería" v={num(c.teams)} />
            <KV k="Día de campaña" v={num(c.day)} />
          </div>
          <Bar value={c.budget + CREDIT_LINE} max={Math.max(c.budget + CREDIT_LINE, 2000)} tone={c.budget < 0 ? "bad" : "ok"} label="Fondos disponibles con crédito" right={musd(c.budget + CREDIT_LINE)} />
          <p className="muted small">Gasto fijo: {musd(burn * 30)} / mes (equipos y salarios).{c.budget < 0 ? " Saldo negativo: la deuda paga 6 % anual y si supera la línea de crédito la agencia quiebra." : ""}</p>
          <Bar value={c.reputation} max={100} tone="accent" label="Reputación" right={`${num(c.reputation)} / 100`} />
          <p className="muted small">La reputación desbloquea contratos más difíciles: cada 20 puntos abre un nivel.</p>
        </Panel>
        <Panel eyebrow="Historial" title="Misiones anteriores">
          {c.history.length === 0 ? <p className="muted">Aún no hay misiones voladas.</p> : (
            <ul className="list">
              {c.history.map((h, i) => (
                <li key={i}><Chip tone={h.success ? "ok" : "bad"}>{h.success ? "Éxito" : "Pérdida"}</Chip><span>{h.title}</span><time>{fmtDay(h.date)}</time></li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="col center">
        {m && k ? (
          <Panel eyebrow={`Misión activa · ${TARGET_LABEL[k.target]}`} title={k.title} className="mission-card">
            <ol className="stepper">
              {STEPS.map((s, i) => <li key={s.label} className={i < idx ? "done" : i === idx ? "now" : ""}><i>{i < idx ? <Icon name="check" size={12} /> : i + 1}</i><span>{s.label}</span></li>)}
            </ol>
            <div className="kvgrid four">
              <KV k="Cliente" v={k.client} />
              <KV k="Carga útil" v={payloadById(m.vehicle.payload).name} />
              <KV k={k.target === "moon" ? "Lanzamiento" : "Próxima ventana"} v={k.target === "moon" ? (m.launchDate ? fmtDay(m.launchDate) : "cuando el vehículo esté listo") : m.window ? fmtDay(m.window) : "—"} />
              <KV k="Pago al completar" v={musd(k.reward)} tone="accent" />
            </div>
            {m.phase === "building" && m.assembly && <Bar value={progressOf(m.assembly)} tone="accent" label="Avance de fabricación" right={`${num(progressOf(m.assembly) * 100)} %`} />}
            <p>{NEXT[m.phase].text}</p>
            <div className="row"><button className="primary" onClick={() => go(NEXT[m.phase].screen)}>{NEXT[m.phase].cta}<Icon name="next" /></button></div>
          </Panel>
        ) : (
          <Panel eyebrow="Sin misión activa" title="Seleccione un contrato" className="mission-card">
            <p>Su agencia no tiene una misión en curso. Revise la cartera de contratos: cada uno indica destino, carga útil, requisitos de Δv y pago.</p>
            <div className="row"><button className="primary" onClick={() => go("contracts")}>Ver contratos disponibles<Icon name="next" /></button>
              <button onClick={() => go("crew")}><Icon name="users" />Cuerpo de astronautas</button></div>
          </Panel>
        )}
      </div>

      <div className="col right">
        <Panel eyebrow="Comunicados" title="Registro de la agencia" className="grow">
          <ul className="feed">
            {c.news.map((n, i) => <li key={i} className={n.kind}><time>{fmtDay(n.date)}</time>{n.text}</li>)}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
