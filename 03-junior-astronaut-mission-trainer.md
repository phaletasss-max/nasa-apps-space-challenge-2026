# 03 · Build a Junior Astronaut Mission Trainer

> **Reto:** un juego o app donde estudiantes dirigen una base en la Luna o en Marte y equilibran soporte vital, blindaje contra radiación, energía y producción de alimentos, para que vivan en carne propia los trade-offs que hacen fracasar o triunfar una misión.

| Dificultad | Viabilidad 48 h | Perfil | Riesgo principal |
|---|---|---|---|
| Intermedio / Juvenil | 🟢 Alta | Desarrollo de juegos, diseño y algo de física | Que el juego sea divertido pero los números sean inventados (falla en "validez") |

## 1. Datos y fuentes (para que los números sean reales)
- **NASA BVAD (Baseline Values and Assumptions Document):** consumo por tripulante y día (≈0.84 kg de O₂, ≈1.8 kg de comida y unos 2.5–3.5 L de agua para beber), producción de CO₂ y potencia de los sistemas.
- **Radiación:** Curiosity/RAD midió ≈0.64–0.67 mSv/día en la superficie de Marte y ≈1.8 mSv/día en el crucero. Los límites de carrera vienen del estándar NASA-STD-3001.
- **Energía:** irradiancia solar ≈1361 W/m² en la Luna y ≈590 W/m² en Marte. Las tormentas de polvo y la noche lunar de unos 14 días terrestres cambian todo.
- **Alimentos:** experimentos Veggie/APH en la ISS (lechuga, rábano, chile) con sus tiempos de cultivo.

## 2. Stack recomendado
- **Juego:** Phaser 3 (2D, web) o React + Zustand si es un simulador de tarjetas y paneles. Godot si el equipo ya lo maneja.
- **Motor de simulación:** un módulo TypeScript puro, sin dependencias, que avanza en ticks de un sol o un día y es testeable aparte de la UI.
- **Distribución:** una PWA que funcione offline.

## 3. MVP
**Sí:**
- Elegir el destino (Luna Shackleton o Marte Jezero) cambia las constantes.
- 4 recursos (O₂/aire, agua, energía, comida) y 1 de amenaza (dosis de radiación).
- Construir 6 módulos: panel solar, reactor Kilopower, invernadero, reciclador de agua, refugio de regolito y batería.
- Eventos aleatorios (tormenta solar, tormenta de polvo, falla de bomba) con decisiones.
- Pantalla final con un "informe de misión" que explica por qué ganaste o perdiste, con el dato real de NASA detrás.

**No:**
- Multijugador.
- Gráficos 3D.
- Más de 6 módulos.

## 4. Plan de trabajo
| Bloque | Sim / Data | Frontend / Juego | Diseño / Story |
|---|---|---|---|
| H0–H4 | Tabla de constantes con la fuente de cada una | Proyecto Phaser y deploy | Bocetos de la UI y del loop de juego |
| H4–H12 | Motor de recursos por tick y tests | HUD de recursos y menú de construcción | Íconos de módulos |
| H12–H24 | Eventos y condiciones de victoria y derrota | Partida completa jugable → **demo mínima** | Textos de eventos |
| H24–H36 | Balanceo (que una partida dure unos 10 min) | Pantalla de informe y tutorial | Las 3 casuísticas |
| H36–H44 | Ajustes | Pulido, sonido y móvil | Video y slides |
| H44–H48 | — | Revisar enlaces | Entrega |

## 5. Riesgos
- **Balanceo:** probar desde H20 con alguien ajeno al equipo y ajustar multiplicadores. Documentar en qué se simplifica respecto a la realidad.
- **Alcance:** el juego se gana con un loop corto y claro, no con muchas features.
- **Mucha competencia:** diferenciarse con números reales citados en pantalla ("Dato NASA").

## 6. Tres casuísticas
### A. Aula de secundaria (CTA y Matemática)
- **Usuario:** docente y alumnos de 12 a 16 años.
- **Problema:** las proporciones, la energía y la biología se enseñan por separado.
- **Uso:** partidas de 15 minutos en grupos. Cada grupo presenta su informe de misión y se discute por qué cayó la energía. Incluye una ficha docente con preguntas guía.
- **Datos:** las constantes del BVAD aparecen en pantalla.
- **Demo:** dos grupos eligen Marte y la Luna, y la noche lunar de 14 días destruye la estrategia solar del segundo.

### B. Club de ciencia o feria escolar (modo competencia)
- **Usuario:** clubes de robótica o astronomía.
- **Problema:** les faltan retos cortos y competitivos.
- **Uso:** una "semilla" de misión fija (los mismos eventos para todos) y un ranking de días sobrevividos con la dosis mínima de radiación.
- **Datos:** los mismos, más una tabla de récords.
- **Demo:** mostrar el ranking y la misma tormenta solar golpeando a dos jugadores con estrategias distintas.

### C. Colegios rurales con poca conectividad (PWA offline)
- **Usuario:** escuelas de zonas altoandinas con PCs antiguas o celulares.
- **Problema:** no hay internet estable.
- **Uso:** se instala una vez y funciona sin red. Se puede jugar con un recurso local: "tu base está a 4,000 m, como en Puno", comparando la radiación UV andina con Marte como gancho.
- **Datos:** constantes embebidas.
- **Demo:** activar el modo avión y seguir jugando.

## 7. Pitch
"Cada número del juego viene de NASA. Si tu base muere, el informe te dice exactamente qué ingeniero real habría tomado otra decisión, y por qué."
