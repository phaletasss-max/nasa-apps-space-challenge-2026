import { useEffect, useState } from "react";
import { engine } from "../../engine";
import { density, fmtTime, gravity } from "../../physics/landing";
import { TARGET_LABEL } from "../../game/contracts";
import { contractOf, useGame } from "../../game/store";
import { Bar, Icon, KV, Panel, num, useTicker } from "../ui";

const PHASE: Record<string, string> = {
  entry: "Entrada atmosférica", parachute: "Paracaídas", freefall: "Caída con disco de frenado", powered: "Descenso propulsado",
  skycrane: "Grúa aérea", descent: "Descenso propulsado", landed: "En la superficie", crashed: "Impacto",
};

export function LandingScreen() {
  const { campaign: c, landed } = useGame();
  const k = contractOf(c);
  const L = engine.landing;
  const [warp, setWarp] = useState(1);
  useTicker(100);
  useEffect(() => { if (k?.landing) { L.start(k.landing); setWarp(L.warp); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { L.warp = warp; }, [warp, L]);
  if (!c || !k || !k.landing) return null;
  const s = L.s, body = k.landing;
  const done = s.phase === "landed" || s.phase === "crashed";
  const fuelMax = body === "moon" ? 900 : 390;
  const rho = density(body, s.h);
  return (
    <div className="layout">
      <div className="col left">
        <Panel eyebrow={`Entrada, descenso y aterrizaje · ${TARGET_LABEL[k.target]}`} title={PHASE[s.phase] ?? s.phase}>
          <div className="tele big">
            <KV k="T+" v={fmtTime(s.t)} />
            <KV k="Altitud" v={s.h > 5000 ? `${num(s.h / 1000, 1)} km` : `${num(s.h)} m`} />
            <KV k="Vel. vertical" v={`${num(-s.vz, Math.abs(s.vz) < 20 ? 1 : 0)} m/s`} />
            <KV k="Vel. horizontal" v={`${num(s.vx, Math.abs(s.vx) < 20 ? 1 : 0)} m/s`} />
            {body !== "moon" ? <>
              <KV k="Carga g" v={`${num(s.gload, 1)} g`} sub={`máx. ${num(s.peakG, 1)}`} />
              <KV k="Calentamiento" v={`${num(s.heat)} W/cm²`} />
              <KV k="Densidad" v={`${rho < 0.01 ? rho.toExponential(1) : num(rho, 3)} kg/m³`} />
            </> : <>
              <KV k="Gravedad" v={`${gravity("moon")} m/s²`} />
              <KV k="Inclinación" v={`${num((s.pitch * 180) / Math.PI)}°`} />
            </>}
          </div>
          {body !== "venus" && <Bar value={s.fuel} max={fuelMax} tone={s.fuel / fuelMax < 0.15 ? "bad" : "accent"} label="Propelente de descenso" right={`${num((s.fuel / fuelMax) * 100)} %`} />}
          {body === "moon" && (
            <div className="pilot">
              <div className="seg"><button className={L.ctrl.auto ? "on" : ""} onClick={() => { L.ctrl.auto = true; }}>Piloto automático</button>
                <button className={!L.ctrl.auto ? "on" : ""} onClick={() => { L.ctrl.auto = false; L.ctrl.throttle = s.throttle; L.ctrl.pitch = s.pitch; }}>Control manual</button></div>
              <p className="muted small">Manual: W / S empuje · A / D inclinar el motor para frenar la velocidad horizontal.</p>
              <Bar value={s.throttle} tone="warn" label="Empuje" right={`${num(s.throttle * 100)} %`} />
            </div>
          )}
          <div className="speeds">{[1, 2, 5, 20, 60].map((w) => <button key={w} className={warp === w ? "on" : ""} onClick={() => setWarp(w)}>{w}×</button>)}</div>
        </Panel>
      </div>
      <div className="col right">
        <Panel eyebrow="Telemetría" title="Bitácora de descenso">
          <ul className="feed short">{[...s.events].reverse().map((e, i) => <li key={i}><time>T+ {fmtTime(e.t)}</time>{e.text}</li>)}</ul>
        </Panel>
        {done && (
          <Panel eyebrow={s.phase === "landed" ? "Contacto con la superficie" : "Pérdida de señal"} title={s.phase === "landed" ? "Aterrizaje confirmado" : "Aterrizaje fallido"} className={s.phase === "landed" ? "accent" : "bad"}>
            <p>{s.result}</p>
            <div className="row"><button className="primary" onClick={() => landed(s.phase === "landed", s.result)}>{s.phase === "landed" && k.crew ? "Comenzar las actividades en superficie" : "Continuar al informe"}<Icon name="next" /></button></div>
          </Panel>
        )}
      </div>
    </div>
  );
}
