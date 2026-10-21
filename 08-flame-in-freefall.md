# 08 · Flame in Freefall: AI-Powered Fire Safety Insights

> **Reto:** un dashboard interactivo con IA que resume, ordena e interpreta décadas de resultados de NASA sobre combustión en microgravedad, para extraer recomendaciones de seguridad contra incendios para la exploración humana.

| Dificultad | Viabilidad 48 h | Perfil | Riesgo principal |
|---|---|---|---|
| Avanzado / Intermedio | 🟡 Media | IA/RAG, data engineering y UX | Curar el corpus: los datos están en papers y reportes, no en una tabla lista |

## 1. Datos y fuentes
- **NASA Physical Sciences Informatics (PSI)** (psi.nasa.gov): datos de experimentos de combustión en la ISS (FLEX, BASS, ACME, SoFIE, CFI).
- **NASA Technical Reports Server (NTRS)** (ntrs.nasa.gov): reportes y papers de Saffire (incendios a gran escala en cargueros Cygnus), BASS y FLEX.
- **NASA-STD-6001:** el estándar de inflamabilidad de materiales (Test 1) como marco de clasificación.
- **Variables clave a extraer:** material, % de O₂, presión, velocidad del flujo, geometría, resultado (se extingue o se propaga), velocidad de propagación y método de extinción.

## 2. Stack recomendado
- **Ingesta:** 20–40 PDFs seleccionados → extracción de texto (pymupdf).
- **Extracción estructurada:** un LLM (Claude) con un esquema JSON fijo por experimento. Cada fila guarda **la cita (página y párrafo)**.
- **Almacén:** SQLite o DuckDB para la tabla y un índice vectorial (Chroma o pgvector) para preguntas en lenguaje natural.
- **Frontend:** React con filtros y gráficos (mapa de inflamabilidad: % de O₂ frente a velocidad del flujo, coloreado por resultado) y un chat que responde **solo con las fuentes cargadas**.

## 3. MVP
**Sí:**
- Un corpus curado con unos 30 documentos y 150–300 filas extraídas, revisadas a mano por muestreo.
- Un dashboard con ranking de materiales por riesgo bajo condiciones elegidas (por ejemplo O₂ al 34 % y 0.5 atm, la atmósfera propuesta para Artemis).
- Un "mapa de inflamabilidad" interactivo.
- Un chat RAG con citas obligatorias.
- 5 "insights" redactados y verificados, como "en microgravedad la llama puede sobrevivir con flujos de aire bajos que en Tierra no la sostendrían".

**No:**
- Ingestar todo NTRS.
- Modelos físicos de combustión.
- Respuestas sin cita.

## 4. Plan de trabajo
| Bloque | Data / Curación | IA | Frontend | Story |
|---|---|---|---|---|
| **Pre** | **Seleccionar y descargar unos 30 PDFs** | — | — | — |
| H0–H4 | Definir el esquema de extracción | Prompt de extracción y prueba con 3 PDFs | Esqueleto del dashboard | Usuarios |
| H4–H12 | Revisar extracciones | Extracción por lotes con citas | Tabla y filtros | — |
| H12–H24 | Muestreo de calidad (unas 30 filas) | RAG y chat | Mapa de inflamabilidad → **demo mínima** | Guion |
| H24–H36 | Corregir errores | Generar y verificar los insights | Ranking por escenario | Casuísticas |
| H36–H44 | — | — | Pulido | Video y slides |
| H44–H48 | — | — | — | Entrega |

## 5. Riesgos
- **Alucinación:** respuestas solo con fragmentos recuperados, cita visible y la opción de responder "no hay evidencia en el corpus".
- **Extracción incorrecta:** mostrar un % de filas verificadas a mano y marcar las no verificadas.
- **Corpus pobre:** elegir los PDFs antes del evento.

## 6. Tres casuísticas
### A. Ingeniero de hábitat lunar: selección de materiales
- **Usuario:** diseñador de interiores de un módulo de superficie.
- **Problema:** la atmósfera propuesta para hábitats de exploración (menos presión y más O₂) cambia qué materiales son seguros.
- **Uso:** filtrar por el escenario de atmósfera y ver el ranking de telas, espumas y plásticos según su comportamiento en ensayos, con citas.
- **Datos:** BASS, Saffire y NASA-STD-6001.
- **Demo:** "Con O₂ al 34 %, este Nomex pasa y esta espuma falla. Fuente: [reporte, pág. 12]".

### B. Oficial de seguridad de tripulación: protocolos de extinción
- **Usuario:** instructor de entrenamiento de tripulaciones.
- **Problema:** las intuiciones terrestres fallan: en microgravedad la llama es esférica, sin convección, y cortar la ventilación cambia todo.
- **Uso:** preguntar al chat "¿qué pasa si apago la ventilación?" o "¿qué extintor sirve con gotas de combustible?" y recibir la respuesta citada más una tarjeta de procedimiento.
- **Datos:** FLEX (extinción de gotas) y ACME.
- **Demo:** pregunta y respuesta con 2 citas, que se convierten en una tarjeta imprimible.

### C. Seguridad industrial en la Tierra: ambientes con O₂ enriquecido y espacios cerrados
- **Usuario:** prevencionistas de hospitales (UCI con oxígeno) y de minería subterránea en Perú.
- **Problema:** los incendios en ambientes ricos en oxígeno y con poca ventilación se parecen más a la física espacial de lo que se cree.
- **Uso:** el mismo dashboard filtrado por "O₂ alto, flujo bajo" muestra qué materiales y prácticas evitar.
- **Datos:** el mismo corpus, con una nota de transferibilidad.
- **Demo:** "Lo que aprendimos quemando cosas en la ISS aplica a una UCI en Lima".

## 7. Pitch
"Decenas de años de experimentos de fuego en el espacio estaban enterrados en PDFs. Los convertimos en un panel que responde con evidencia, y cada respuesta cita su fuente."
