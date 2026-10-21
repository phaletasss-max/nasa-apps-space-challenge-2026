import { useState, type ReactNode } from "react";
import { payloadById } from "../../game/catalog";
import { ROLE_COLOR, ROLE_LABEL, trainingDays, type Astronaut, type Skills } from "../../game/crew";
import { contractOf, useGame } from "../../game/store";
import { Bar, Icon, Panel, musd, num } from "../ui";
import { HabitatView } from "./Habitat";

const SKILL: Record<keyof Skills, string> = { piloting: "Pilotaje", engineering: "Ingeniería", science: "Ciencia", medicine: "Medicina", leadership: "Liderazgo" };

function Card({ a, children }: { a: Astronaut; children?: ReactNode }) {
  return (
    <div className="astro">
      <div className="astro-head">
        <span className="avatar" style={{ borderColor: ROLE_COLOR[a.role] }}>{a.name.split(" ").map((p) => p[0]).join("")}</span>
        <div><b>{a.name}</b><small style={{ color: ROLE_COLOR[a.role] }}>{ROLE_LABEL[a.role]}</small><small>{a.age} años · {a.country} · {a.flights} vuelos</small></div>
      </div>
      <div className="skills">
        {(Object.keys(SKILL) as (keyof Skills)[]).map((s) => (
          <div key={s}><span>{SKILL[s]}</span><i><b style={{ width: `${a.skills[s] * 10}%` }} /></i><em>{a.skills[s]}</em></div>
        ))}
      </div>
      <p className="trait">{a.trait} · {musd(a.salary)} / año</p>
      {children}
    </div>
  );
}

export function CrewScreen() {
  const { campaign: c, hire, release, toggleCrew } = useGame();
  const [habitat, setHabitat] = useState(false);
  if (!c) return null;
  const m = c.mission, k = contractOf(c);
  const seats = m ? payloadById(m.vehicle.payload).crew : 0;
  const editable = !!m && ["design", "building", "ready"].includes(m.phase);
  const hired = c.candidates.filter((a) => a.hired), pool = c.candidates.filter((a) => !a.hired && !a.lost), lost = c.candidates.filter((a) => a.lost);
  const sim = (m?.crewIds.length ? hired.filter((a) => m.crewIds.includes(a.id)) : hired).slice(0, 4);
  return (
    <div className="layout">
      <div className="col left wide">
        <Panel eyebrow="Cuerpo de astronautas" title={`Plantilla (${hired.length})`}
          actions={<button disabled={sim.length === 0} onClick={() => setHabitat(true)}><Icon name="habitat" />Simulación en hábitat análogo</button>}>
          {seats > 0 && k ? (
            <p className="note"><Icon name="info" />{k.title}: requiere {k.crew} astronautas. Asignados {m!.crewIds.length} / {seats}. Cada uno necesita completar el entrenamiento específico antes del lanzamiento.</p>
          ) : <p className="muted small">La misión activa no lleva tripulación. Puede reclutar y preparar astronautas para contratos tripulados futuros, y observarlos en el hábitat análogo.</p>}
          {hired.length === 0 && <p className="muted">Aún no hay astronautas contratados.</p>}
          <div className="astro-grid">
            {hired.map((a) => {
              const assigned = !!m?.crewIds.includes(a.id);
              return (
                <Card key={a.id} a={a}>
                  {assigned && <Bar value={a.training} tone={a.training >= 1 ? "ok" : "accent"} label="Entrenamiento de misión" right={a.training >= 1 ? "Completo" : `${num(a.training * 100)} % · ${trainingDays(a)} días`} />}
                  <div className="row">
                    {seats > 0 && <button className={assigned ? "on" : ""} disabled={!editable || (!assigned && m!.crewIds.length >= seats)} onClick={() => toggleCrew(a.id)}>{assigned ? "Asignado a la misión" : "Asignar a la misión"}</button>}
                    <button className="ghost" disabled={assigned && !editable} onClick={() => release(a.id)}>Liberar</button>
                  </div>
                </Card>
              );
            })}
          </div>
          {lost.length > 0 && <p className="memorial">En memoria: {lost.map((a) => a.name).join(", ")}.</p>}
        </Panel>
      </div>
      <div className="col right wide">
        <Panel eyebrow="Proceso de selección" title={`Candidatos (${pool.length})`}>
          <p className="muted small">Contratar cuesta 1.5 M USD (selección médica y psicológica) más el salario anual.</p>
          <div className="astro-grid one">
            {pool.map((a) => <Card key={a.id} a={a}><div className="row"><button onClick={() => hire(a.id)}><Icon name="plus" />Contratar</button></div></Card>)}
          </div>
        </Panel>
      </div>
      {habitat && <HabitatView crew={sim} title={m?.phase === "cruise" ? "Hábitat de tránsito" : "Hábitat análogo de entrenamiento"} onClose={() => setHabitat(false)} />}
    </div>
  );
}
