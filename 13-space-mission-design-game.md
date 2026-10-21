# 13 · Space Mission Design Game

> **Reto:** un juego interactivo para diseñar, gestionar y simular una misión espacial completa (objetivos, nave, instrumentos, lanzador, presupuesto, potencia, masa, comunicaciones, órbita), tomando decisiones de ingeniería y viendo cómo cada elección afecta el éxito.

| Dificultad | Viabilidad 48 h | Perfil | Riesgo principal |
|---|---|---|---|
| Intermedio / Juvenil | 🟢 Alta | Desarrollo de juegos, diseño y un poco de ingeniería espacial | Querer simular demasiado: hay que elegir 5 variables y que interactúen bien |

## 1. Datos y fuentes (para que el juego sea creíble)
- **Lanzadores:** capacidad a LEO, GTO y escape, y costo aproximado (Falcon 9, Atlas V, Vega-C, Electron para CubeSats), de fichas públicas de NASA y de los fabricantes.
- **Delta-v:** unos 9.4 km/s a LEO, más el presupuesto de transferencia (Hohmann) a Marte o a Júpiter. La ecuación del cohete de Tsiolkovsky se enseña en el juego.
- **Masas y potencias de instrumentos reales:** fichas del NSSDCA (cámara, espectrómetro, magnetómetro, radar).
- **Comunicaciones:** tasas de datos típicas con la Deep Space Network (DSN) según distancia y antena.
- **Costos de misión:** clases de NASA (Discovery, New Frontiers, SmallSat) para los techos de presupuesto.
- **CubeSats:** el estándar de 1U a 12U, con masa y potencia típicas.

## 2. Stack recomendado
- **Juego:** React + Zustand (diseño basado en paneles y tarjetas) o Phaser 3 si hay una fase de vuelo visual.
- **Motor:** un módulo TypeScript puro con la ecuación del cohete, el balance de potencia (paneles × distancia⁻²), el link budget simplificado y el presupuesto. Se prueba con tests aparte.
- **Distribución:** PWA estática en Vercel o GitHub Pages.

## 3. MVP
**Sí:**
- **Fase 1, Diseño:** elegir el objetivo (orbitar la Tierra, la Luna, Marte o Júpiter), el bus de la nave, 1–4 instrumentos, la fuente de energía, la antena y el lanzador. Barras en vivo de masa, potencia, costo y delta-v. Si la masa supera la capacidad del lanzador, no se puede lanzar.
- **Fase 2, Operación:** una línea de tiempo con eventos (anomalía, tormenta solar, eclipse, ventana de comunicación) y decisiones.
- **Fase 3, Resultado:** ciencia obtenida frente al presupuesto, con una comparación contra una misión real parecida ("tu diseño se parece a Juno").

**No:**
- Mecánica orbital completa (usar tablas de delta-v).
- Multijugador en red.
- Editor 3D.

## 4. Plan de trabajo
| Bloque | Ingeniería / Data | Frontend / Juego | Diseño / Story |
|---|---|---|---|
| H0–H4 | Tablas de lanzadores, instrumentos y delta-v con su fuente | Proyecto y deploy | Loop de las 3 fases |
| H4–H12 | Motor de presupuestos y tests | Pantalla de diseño con barras en vivo | Íconos y tarjetas |
| H12–H24 | Eventos de operación | Fase de operación y resultado → **demo mínima** | Textos de eventos |
| H24–H36 | Misiones reales para la comparación | Tutorial y escenarios de las casuísticas | Casuísticas |
| H36–H44 | Balanceo | Pulido y sonido | Video y slides |
| H44–H48 | — | — | Entrega |

## 5. Riesgos
- **Complejidad:** 5 recursos como máximo (masa, potencia, costo, delta-v y datos). Lo demás es narrativa.
- **Falta de diversión:** probar desde H20 con alguien externo. Cada decisión debe tener un costo visible.
- **Diferenciarse del reto 03:** aquí el foco es el **ciclo de vida completo de la misión**, no la base.

## 6. Tres casuísticas
### A. Aula de secundaria: diseña tu CubeSat peruano
- **Usuario:** docente de física o tecnología y alumnos de 14 a 17 años.
- **Problema:** la ingeniería espacial parece algo inalcanzable.
- **Uso:** el escenario es "un CubeSat 3U para monitorear glaciares andinos", con el presupuesto de una universidad. Se inspira en misiones peruanas reales: Chasqui-I (UNI), PUCP-Sat-1 y PeruSAT-1 (CONIDA).
- **Datos:** el estándar CubeSat y lanzadores de rideshare.
- **Demo:** el alumno elige una cámara demasiado grande, se queda sin potencia, cambia a una cámara pequeña y lanza.

### B. Curso universitario de ingeniería de sistemas
- **Usuario:** estudiantes de ingeniería aeroespacial, electrónica o mecánica.
- **Problema:** los trade-offs entre subsistemas se enseñan en papel.
- **Uso:** un modo "experto" con más variables visibles (márgenes del 20 %, link budget en dB) y un reporte exportable tipo revisión de diseño.
- **Datos:** las mismas tablas con más detalle.
- **Demo:** misión a Júpiter: hay que elegir entre paneles gigantes o un RTG, y el reporte muestra los márgenes.

### C. Competencia en feria o museo (modo reto)
- **Usuario:** visitantes de ferias de ciencia, del planetario o de la Semana del Espacio.
- **Problema:** se necesita una experiencia corta y competitiva.
- **Uso:** un reto del día ("llega a Marte con menos de 500 M$") y un ranking local, en partidas de 5 minutos.
- **Datos:** escenario fijo.
- **Demo:** pantalla de ranking con 3 diseños distintos que lograron el reto.

## 7. Pitch
"Cada misión real es un rompecabezas de masa, energía y dinero. En nuestro juego un estudiante lo arma en 10 minutos y descubre por qué Juno usa paneles solares y Curiosity un reactor nuclear."
