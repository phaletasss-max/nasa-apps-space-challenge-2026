# Δv Mission Control: Space Mission Design Game (práctica)

> **Estado: sandbox de práctica, no es una entrega.** Las FAQ de NASA Space Apps dicen que no se puede empezar a trabajar en los retos antes del hackathon (14–15 nov 2026). Esto es un ejercicio para aprender la física, el 3D y los datos antes del evento. Consulten con el Local Lead qué se puede reutilizar.

**Reto:** *Space Mission Design Game*. Un juego interactivo para diseñar, gestionar y simular una misión espacial completa, tomando decisiones de ingeniería con recursos limitados. Plan del reto: [`../13-space-mission-design-game.md`](../13-space-mission-design-game.md).

## Qué se busca

El reto pide que el jugador **entienda las decisiones reales de una misión**: qué cohete hace falta para un destino, cuánto tarda fabricarlo, qué riesgos hay en la ruta y qué pasa con la tripulación. Por eso el juego recorre la misión completa, desde el contrato hasta el informe final, y cada número sale de un modelo físico o de datos públicos.

## El juego: ciclo de una misión

| Etapa | Qué decide el jugador | Modelo detrás |
|---|---|---|
| **Contratos** | Elige entre 8 contratos (orbitador y aterrizador lunar, orbitador y rover en Marte, sonda a Venus, sobrevuelo de Júpiter, sobrevuelo lunar tripulado, alunizaje tripulado). La reputación desbloquea los más difíciles. | Δv de salida por Hohmann + Oberth desde 200 km; valores lunares de Apollo/Artemis; ventanas por ángulo de fase |
| **Diseño del vehículo** | Boosters, de 1 a 3 etapas, motor (clases Merlin, MVac, RS-25, RL10, Raptor, AJ10), número de motores, toneladas de propelente y carga útil. Hay 5 diseños de referencia (clase Falcon 9, clase SLS, etc.). | Tsiolkovsky por etapa, fracciones estructurales por propelente, empuje/peso, confiabilidad y costo. Requisitos y avisos en vivo. |
| **Fabricación** | Cuántos equipos de ingeniería asignar (más equipos = más rápido y más caro, con rendimientos decrecientes). Diagrama de Gantt en vivo con fecha proyectada frente a la ventana. | Grafo de tareas con ruta crítica; pruebas (encendido estático, pruebas ambientales, ensayo con combustible) que pueden fallar y obligan a repetir. |
| **Hangar 3D (VAB)** | Ve el cohete armarse: las piezas en producción aparecen como plano azul que se va "llenando" con su avance; se fabrican por separado en el piso y se apilan al terminar la integración. | Dimensiones de cada etapa a partir del volumen de propelente |
| **Tripulación** | Contrata astronautas (rol, habilidades, rasgo, salario), asígnalos a la misión y espera que terminen el entrenamiento. | Candidatos generados con semilla; entrenamiento de 90 a 240 días según experiencia |
| **Hábitat (NPC)** | Mira por dentro cómo viven: duermen, comen, hacen ejercicio, trabajan en el laboratorio, llaman a la Tierra, reparan averías y se atienden entre ellos. Clic en un tripulante para ver sus necesidades. | Simulación por agentes con horario tipo Estación Espacial Internacional; averías aleatorias de soporte vital, energía, agua, térmico y comunicaciones |
| **Lanzamiento** | Sondeo Go/No-Go de 6 o 7 consolas (meteorología aleatoria, seguridad, vehículo, nave, dinámica de vuelo y tripulación). Suspender o iniciar la cuenta regresiva. | Ascenso integrado en 2D: gravedad, atmósfera que rota, Max-Q, giro gravitatorio, guiado en lazo cerrado, separación de etapas, falla de motor según confiabilidad |
| **Crucero** | Vista del sistema solar con la ruta, la nave y el catálogo de asteroides. **Predictor de riesgos:** lista de objetos que pasan cerca, con la opción de una maniobra de evasión o un sobrevuelo científico. Cuanto antes se decide, menos Δv cuesta. | 7 021 asteroides reales del JPL SBDB propagados con dos cuerpos; aproximación mínima por sección áurea; Δv ≈ distancia / tiempo |
| **Llegada y aterrizaje** | Inserción orbital, o entrada y descenso en la Luna, Marte o Venus (en la Luna se puede pilotar a mano). | Modelos EDL con atmósfera exponencial, coeficiente balístico y propulsión |
| **Informe** | Pago, ciencia, reputación y presupuesto. | — |

Todo el juego avanza con un **calendario real**: la fecha empieza hoy, las ventanas a Marte caen cuando caen de verdad (dic 2026, ene 2029…) y si la fabricación se atrasa hay que esperar a la siguiente.

**Honestidad del predictor:** en el espacio interplanetario la probabilidad real de chocar con un asteroide es ínfima. Las misiones no esquivan asteroides, planean sobrevuelos a propósito (Galileo–Gaspra, NEAR–Mathilde, Lucy–Dinkinesh). El radio de exclusión del juego (2 millones de km) es un parámetro conservador y el juego lo explica.

### Lógica agregada en la segunda iteración
- **Misiones tripuladas completas:** ida, estancia en superficie con caminatas, regreso y reentrada. La torre de escape salva a la tripulación si falla el cohete. Si alguien llega enfermo o sobre el límite de radiación, las reglas de vuelo cancelan el descenso.
- **Estado de la tripulación día a día:** salud, condición física, estrés, dosis de radiación, averías de a bordo y ciencia. El hábitat por minuto arranca desde ese estado.
- **Economía:** línea de crédito de 300 M USD, interés del 6 % y quiebra. No se puede congelar un diseño que no se puede pagar.
- **Biblioteca de diseños** de la agencia para reutilizar cohetes entre contratos.
- **Habilidades que cuentan:** el mejor ingeniero reduce las anomalías y repara más rápido; el médico acelera las altas; el liderazgo baja el estrés; los científicos producen más ciencia.

**Mapa completo de la lógica** (módulos, máquina de estados, modelo diario, fórmulas, constantes, semillas y pruebas): [`docs/LOGICA.md`](docs/LOGICA.md).

### Simuladores libres (desde el menú)
- **Explorador del sistema solar:** planetas en su posición real, fichas del NASA Planetary Fact Sheet, entrar a cada mundo y ver su aterrizaje.
- **Escuela de vuelo orbital:** maniobras en órbita terrestre con RK4 y objetivos (GEO, escape, reentrada).

## La física (y cómo sabemos que está bien)

53 pruebas automáticas (`npx vitest run`), entre ellas:

| Modelo | Validación |
|---|---|
| Posiciones planetarias (elementos JPL Standish) | Coinciden con **JPL Horizons** con error < 0.01 UA |
| Asteroides (JPL SBDB, dos cuerpos) | Ceres, Vesta y Eros coinciden con Horizons con error < 0.002 UA |
| Hohmann Tierra→Marte | 2.94 + 2.65 km/s, ~259 días; inyección desde 200 km ≈ 3.6 km/s |
| Vehículo | Un cohete clase Falcon 9 lleva el orbitador a Marte pero no puede con la cápsula de 26.5 t; uno clase SLS sí hace la inyección translunar con la cápsula |
| Ascenso | Clase Falcon 9: Max-Q ≈ 32 kPa a T+70 s, separación a T+151 s, órbita ~T+8 min con ~3.4 km/s restantes en la segunda etapa |
| Fabricación | Ruta crítica, más equipos acortan el programa, pruebas fallidas añaden retrabajo |
| Hábitat | Horario, reparación de averías por el mejor ingeniero y atención médica |
| Campaña completa | Contrato lunar de punta a punta (fabricación → ascenso → crucero → llegada → pago); predictor activo en un crucero a Júpiter |
| Misiones tripuladas | Alunizaje completo (superficie → regreso → reentrada), pérdida de tripulación, dosis de radiación tipo MSL/RAD |
| Economía | Línea de crédito, intereses y quiebra |
| Aterrizajes | Marte 6 min 45 s, Luna 2 min 25 s, Venus 1 h 25 min |

**Simplificaciones conscientes:** ascenso en un plano, transferencias coplanares corregidas suavemente hacia la posición real del planeta, maniobras impulsivas y costos y plazos de juego del orden de magnitud correcto. Los motores llevan nombres genéricos con datos de clases reales (citadas en el catálogo).

## Correr

```bash
cd app && npm install && npm run dev
```

Tests y build:

```bash
cd app && npx vitest run && npm run build
```

Stack: Vite + TypeScript + Three.js para las escenas 3D, React + zustand para la interfaz y el estado de la campaña (guardado automático en el navegador).

**Datos y créditos:**
- NASA/JPL SSD: elementos planetarios y catálogo de asteroides (Small-Body Database). JPL Horizons: validación.
- NASA Planetary Fact Sheet: fichas de los planetas. IAU WGCCRE: rotación.
- Texturas: [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0, basadas en datos de NASA). La atribución también aparece en la app.

## Estructura

```
app/src/physics/   constantes, Kepler, Hohmann, cohete, RK4, entrada/descenso/aterrizaje (+ tests)
app/src/game/      reglas puras (+ tests): campaign.ts (ciclo de la misión y economía), catalog, vehicle,
                   assembly, ascent, contracts, crew, crewcare, interior, hazards, trajectory;
                   store.ts conecta las reglas con la interfaz y guarda la partida
app/src/scenes/    escenas 3D: sistema solar, mundo, aterrizaje, órbita, hangar (VAB), lanzamiento, cohete
app/src/app/       interfaz React: menú, centro de control, contratos, vehículo, tripulación,
                   hábitat, lanzamiento, operaciones, aterrizaje, informe
app/src/ui/        paneles de los simuladores libres
app/src/engine.ts  renderizador compartido y escena activa
app/scripts/       descarga del catálogo de asteroides (JPL SBDB)
docs/LOGICA.md     mapa de la lógica
```
