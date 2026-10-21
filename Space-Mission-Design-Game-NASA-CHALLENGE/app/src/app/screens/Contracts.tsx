import { useEffect, useState } from "react";
import { engine } from "../../engine";
import { CONTRACTS, launchWindow, TARGET_LABEL } from "../../game/contracts";
import { payloadById } from "../../game/catalog";
import { DV_TO_LEO } from "../../game/vehicle";
import { fmtDay, unlocked, useGame } from "../../game/store";
import { Chip, Icon, KV, Panel, kms, musd, num } from "../ui";

export function Contracts() {
  const { campaign: c, acceptContract } = useGame();
  const [sel, setSel] = useState(CONTRACTS[0].id);
  const k = CONTRACTS.find((x) => x.id === sel)!;
  useEffect(() => { engine.solar.select(k.target === "moon" ? "earth" : k.target); }, [k.target]);
  if (!c) return null;
  const w = launchWindow(k, c.date);
  const busy = !!c.mission;
  const open = unlocked(c, k);
  return (
    <div className="layout">
      <div className="col left wide">
        <Panel eyebrow="Cartera" title="Contratos de misión">
          <ul className="contracts">
            {CONTRACTS.map((x) => {
              const lock = !unlocked(c, x);
              return (
                <li key={x.id} className={`${x.id === sel ? "on" : ""} ${lock ? "locked" : ""}`} onClick={() => setSel(x.id)}>
                  <div className="ct-top"><span className="ct-target">{TARGET_LABEL[x.target]}</span><span className="pips" title={`Dificultad ${x.difficulty} de 5`}>{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= x.difficulty ? "on" : ""} />)}</span></div>
                  <b>{x.title}</b>
                  <div className="ct-meta"><span>{musd(x.reward)}</span><span>{x.crew ? `${x.crew} astronautas` : "Robótica"}</span>{lock && <Chip tone="muted">Requiere reputación {(x.difficulty - 1) * 20}</Chip>}</div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
      <div className="col right wide">
        <Panel eyebrow={k.client} title={k.title}>
          <p>{k.summary}</p>
          <div className="kvgrid">
            <KV k="Destino" v={TARGET_LABEL[k.target]} />
            <KV k="Carga útil" v={k.payloads.map((p) => payloadById(p).name).join(" / ")} />
            <KV k="Tripulación" v={k.crew ? `${k.crew} astronautas` : "No tripulada"} />
            <KV k="Duración del crucero" v={`${num(k.cruiseDays, k.cruiseDays < 30 ? 1 : 0)} días`} />
            <KV k="Δv a órbita baja" v={kms(DV_TO_LEO)} sub="incluye pérdidas por gravedad y arrastre" />
            <KV k="Δv de salida" v={kms(k.dvDeparture)} sub="desde órbita de 200 km" />
            <KV k="Δv de llegada" v={k.dvArrival ? kms(k.dvArrival) : "—"} sub={k.landing ? "inserción + descenso" : k.dvArrival ? "inserción orbital" : "sobrevuelo"} />
            <KV k={k.target === "moon" ? "Lanzamiento" : "Ventana de lanzamiento"} v={w ? fmtDay(w) : "—"} sub={k.target === "moon" ? "disponible cualquier día" : "ángulo de fase de Hohmann"} />
          </div>
          <div className="kvgrid">
            <KV k="Anticipo a la firma" v={musd(k.advance)} />
            <KV k="Pago al completar" v={musd(k.reward)} tone="accent" />
            <KV k="Ciencia" v={num(k.science)} />
          </div>
          {busy && <p className="note warn"><Icon name="alert" /> Ya tiene una misión activa. Debe completarla o rescindirla antes de firmar otro contrato.</p>}
          {!open && <p className="note"><Icon name="info" /> Este contrato requiere una reputación de {(k.difficulty - 1) * 20}. Complete misiones más sencillas primero.</p>}
          <div className="row"><button className="primary" disabled={busy || !open} onClick={() => acceptContract(k.id)}>Firmar contrato<Icon name="next" /></button></div>
        </Panel>
      </div>
    </div>
  );
}
