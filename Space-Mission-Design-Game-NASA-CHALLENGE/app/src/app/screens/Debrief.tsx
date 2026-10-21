import { contractOf, fmtDay, useGame } from "../../game/store";
import { Chip, Icon, KV, Panel, musd, num } from "../ui";

export function Debrief() {
  const { campaign: c, closeMission } = useGame();
  const m = c?.mission, k = contractOf(c);
  if (!c || !m || !k || !m.result) return null;
  const r = m.result;
  const crew = c.candidates.filter((a) => m.crewIds.includes(a.id));
  return (
    <div className="layout center-only">
      <Panel eyebrow={`Informe de misión · ${k.title}`} title={r.title} className={`debrief ${r.success ? "accent" : "bad"}`}
        actions={<Chip tone={r.success ? "ok" : "bad"}>{r.success ? "Misión cumplida" : "Misión fallida"}</Chip>}>
        <ul className="findings">{r.lines.map((l, i) => <li key={i}><Icon name={r.success ? "check" : "alert"} />{l}</li>)}</ul>
        <div className="kvgrid four">
          <KV k="Vehículo" v={m.vehicle.name} />
          <KV k="Lanzamiento" v={m.launchDate ? fmtDay(m.launchDate) : "—"} />
          <KV k="Correcciones de trayectoria" v={`${num(m.dvSpent, 2)} m/s`} />
          <KV k="Suspensiones" v={num(m.scrubs)} />
          <KV k="Costo de fabricación" v={m.assembly ? musd(m.assembly.spent) : "—"} />
          <KV k="Pago del cliente" v={r.success ? musd(k.reward) : "—"} tone={r.success ? "ok" : undefined} />
          <KV k="Reputación" v={num(c.reputation)} />
          <KV k="Presupuesto" v={musd(c.budget)} />
        </div>
        {crew.length > 0 && <p className="muted">Tripulación: {crew.map((a) => a.name).join(", ")}.</p>}
        <div className="row"><button className="primary" onClick={closeMission}>Archivar y volver al centro de control<Icon name="next" /></button></div>
      </Panel>
    </div>
  );
}
