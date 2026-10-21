import { useState } from "react";
import { useGame } from "../../game/store";
import { ASTEROIDS } from "../../game/hazards";
import { Icon, num } from "../ui";

export function Menu() {
  const { newCampaign, load, hasSave, go, campaign } = useGame();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("Agencia Espacial Andina");
  const saved = hasSave();
  return (
    <div className="menu">
      <div className="menu-card">
        <div className="menu-brand">
          <span className="logo xl">Δv</span>
          <div>
            <h1>Mission Control</h1>
            <p>Diseña el cohete, gestiona su fabricación, entrena a la tripulación y opera la misión con física orbital real.</p>
          </div>
        </div>
        {!naming ? (
          <div className="menu-actions">
            {campaign && <button className="mbtn primary" onClick={() => go("hub")}><Icon name="play" /><span><b>Volver a la campaña</b><small>{campaign.agency}</small></span></button>}
            <button className="mbtn" onClick={() => setNaming(true)}><Icon name="plus" /><span><b>Nueva campaña</b><small>Funda una agencia con 1 500 M USD y una cartera de contratos</small></span></button>
            <button className="mbtn" disabled={!saved || !!campaign} onClick={() => load()}><Icon name="save" /><span><b>Cargar partida guardada</b><small>{saved ? "Guardado automático en este navegador" : "No hay partidas guardadas"}</small></span></button>
            <div className="menu-sep">Simuladores libres</div>
            <button className="mbtn" onClick={() => go("explore")}><Icon name="globe" /><span><b>Explorador del sistema solar</b><small>Efemérides JPL, mundos en detalle y simulación de aterrizajes</small></span></button>
            <button className="mbtn" onClick={() => go("orbit")}><Icon name="orbit" /><span><b>Escuela de vuelo orbital</b><small>Maniobras en órbita terrestre con integración RK4</small></span></button>
            <button className="mbtn ghost" onClick={() => go("credits")}><Icon name="info" /><span><b>Modelos, datos y créditos</b></span></button>
          </div>
        ) : (
          <form className="menu-actions" onSubmit={(e) => { e.preventDefault(); if (name.trim()) newCampaign(name.trim()); }}>
            <label className="field-l">Nombre de la agencia
              <input autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            </label>
            <p className="muted small">La campaña empieza hoy. Cada contrato define un destino, una carga útil y requisitos de Δv; tu agencia diseña y fabrica el vehículo, recluta y entrena a la tripulación, y opera la misión hasta su llegada.</p>
            <div className="row">
              <button type="button" onClick={() => setNaming(false)}>Cancelar</button>
              <button type="submit" className="primary">Fundar la agencia</button>
            </div>
          </form>
        )}
        <footer className="menu-foot">Práctica para NASA Space Apps Challenge 2026 · Space Mission Design Game · Proyecto no afiliado a la NASA</footer>
      </div>
      <div className="menu-facts">
        <div><b>{num(ASTEROIDS.length)}</b><span>asteroides reales del JPL Small-Body Database</span></div>
        <div><b>8</b><span>planetas con efemérides JPL validadas contra Horizons</span></div>
        <div><b>6</b><span>clases de motor con datos públicos (Merlin, RS-25, RL10, Raptor…)</span></div>
      </div>
    </div>
  );
}

export function Credits() {
  const go = useGame((s) => s.go);
  return (
    <div className="menu">
      <div className="menu-card wide">
        <button className="back-link" onClick={() => go("menu")}><Icon name="back" /> Menú principal</button>
        <h1>Modelos, datos y créditos</h1>
        <div className="credits">
          <section><h3>Mecánica orbital</h3><p>Elementos keplerianos de JPL (Standish) para los planetas, validados contra JPL Horizons. Transferencias de Hohmann con salida desde órbita de 200 km (efecto Oberth), ventanas por ángulo de fase y ajuste del día de salida a las órbitas elípticas reales.</p></section>
          <section><h3>Vehículo de lanzamiento</h3><p>Ecuación de Tsiolkovsky por etapas, fracciones estructurales por propelente, empuje a nivel del mar y en vacío. El ascenso se integra en 2D con gravedad central, atmósfera exponencial que rota con la Tierra, presión dinámica (Max-Q), giro gravitatorio y guiado en lazo cerrado hasta órbita.</p></section>
          <section><h3>Fabricación</h3><p>Grafo de tareas con dependencias, asignación de equipos por ruta crítica con rendimientos decrecientes y pruebas que pueden fallar según la confiabilidad de los componentes (encendido estático, pruebas ambientales, ensayo general con combustible).</p></section>
          <section><h3>Riesgos en ruta</h3><p>{num(ASTEROIDS.length)} asteroides del JPL Small-Body Database (H &lt; 12.5 con a &lt; 6 UA, y NEO con H &lt; 19) propagados con dos cuerpos. Aproximación mínima por búsqueda de sección áurea y Δv de corrección ≈ d / t. En la realidad el espacio interplanetario es muy vacío: las misiones no esquivan asteroides, planifican sobrevuelos a propósito (Galileo–Gaspra, Lucy–Dinkinesh). El radio de exclusión del juego es deliberadamente conservador.</p></section>
          <section><h3>Vida a bordo</h3><p>Simulación por agentes con horario tipo Estación Espacial Internacional (conferencia diaria, ~2.5 h de ejercicio, ~8.5 h de sueño), necesidades, averías de sistemas y atención médica.</p></section>
          <section><h3>Datos y texturas</h3><p>Texturas planetarias: Solar System Scope (CC BY 4.0, basadas en datos NASA). Datos físicos: NASA Planetary Fact Sheet. Catálogo de asteroides: NASA/JPL SSD. Costos y plazos son valores de juego del orden de magnitud correcto.</p></section>
        </div>
      </div>
    </div>
  );
}
