# 07 · Field Shift: Adapting Farms with NASA Data

> **Reto:** una herramienta de apoyo a decisiones que combine observaciones de NASA con información local de suelos, características de cultivos y prioridades del agricultor, para explorar estrategias de rotación que mejoren la salud del suelo y la adaptación al clima.

| Dificultad | Viabilidad 48 h | Perfil | Riesgo principal |
|---|---|---|---|
| Avanzado / Intermedio | 🟡 Media | Data, agronomía y UX | Lógica agronómica débil: "recomendaciones" que un agrónomo destruye en 10 segundos |

## 1. Datos y fuentes
- **NASA POWER Agroclimatology** (power.larc.nasa.gov): precipitación, temperatura, radiación y ET de referencia diaria por punto desde 1981. Es la columna vertebral.
- **SMAP:** humedad del suelo, de 3 a 9 km.
- **GPM IMERG:** precipitación reciente y anomalías.
- **MODIS/HLS NDVI:** historial de vigor de la parcela (lo que se sembró antes).
- **Suelo local:** SoilGrids (ISRIC, 250 m: textura, carbono orgánico y pH) o los análisis que ingrese el agricultor.
- **Cultivos:** coeficientes Kc de FAO-56, ciclo, demanda de agua y fijación de nitrógeno (leguminosas).

## 2. Stack recomendado
- **Backend:** Python con FastAPI, cliente de POWER y un motor de puntuación de rotaciones (reglas explicables, no caja negra).
- **Modelo:** balance hídrico simple (FAO-56: ETc = Kc × ET₀ frente a la precipitación efectiva) más índices de salud del suelo: cobertura, leguminosas, diversidad y años de descanso.
- **Frontend:** React con Leaflet (marcar la parcela), un formulario de prioridades (agua, ingreso, suelo, riesgo) y un comparador de 3 rotaciones en línea de tiempo.

## 3. MVP
**Sí:**
- Marcar la parcela → obtener el clima de los últimos 30 años y el perfil del suelo.
- El agricultor elige su rotación actual y sus prioridades con sliders.
- La app compara su rotación actual con 2 alternativas en déficit hídrico, balance de nitrógeno, cobertura del suelo y riesgo de helada o sequía.
- Cada puntaje se explica ("Haba aporta ~X kg N/ha").
- Escenario "año seco": se repite la simulación con un año seco histórico real (por ejemplo, 2016 en el sur andino).

**No:**
- Predicción de rendimiento con machine learning.
- Precios de mercado en vivo.
- Más de 8 cultivos por región.

## 4. Plan de trabajo
| Bloque | Agro / Data | Backend | Frontend | Story |
|---|---|---|---|---|
| H0–H4 | Tabla de 8 cultivos (Kc, ciclo, N) y validación con alguien de agronomía | Cliente POWER | Mapa y formulario | Personas (agricultores) |
| H4–H12 | Reglas de rotación y salud del suelo | Balance hídrico mensual | Sliders de prioridades | Textos |
| H12–H24 | SoilGrids y SMAP | Motor de puntuación | Comparador → **demo mínima** | Guion |
| H24–H36 | Escenario año seco | Explicaciones | Línea de tiempo de rotación | Casuísticas |
| H36–H44 | — | Despliegue | Pulido y móvil | Video y slides |
| H44–H48 | — | — | — | Entrega |

## 5. Riesgos
- **Credibilidad agronómica:** cada regla con su fuente (FAO o INIA). Mostrar como "explorar escenarios", nunca como "debes sembrar X".
- **Resolución:** POWER (unos 50 km) es gruesa. Decirlo y dejar que el agricultor corrija con sus datos.
- **Usuario real:** la interfaz debe funcionar en celular y con poco texto.

## 6. Tres casuísticas
### A. Papa en el altiplano (Puno)
- **Usuario:** comunidad campesina y técnico de Agro Rural.
- **Problema:** heladas más erráticas, lluvias que llegan tarde y suelos agotados por acortar el descanso.
- **Uso:** comparar la rotación tradicional por aynoqas (papa → quinua o cañihua → haba o cebada → varios años de descanso) con una versión intensificada sin descanso.
- **Datos:** POWER (temperatura mínima para heladas y lluvia) y SoilGrids (carbono orgánico).
- **Demo:** la rotación tradicional sale mejor en salud del suelo y resiste mejor el año seco de 2016. El saber ancestral queda validado con datos de NASA.

### B. Arroz frente a menestras en la costa norte (Piura y Lambayeque)
- **Usuario:** junta de usuarios de riego y productor mediano.
- **Problema:** el arroz consume mucha agua en un valle con reservorio limitado (Poechos o Tinajones) y hay alternancia de años Niño y años secos.
- **Uso:** comparar arroz-arroz con arroz → frijol caupí o algodón, según el agua disponible.
- **Datos:** POWER (ET₀), IMERG y SMAP.
- **Demo:** "La rotación con caupí usa 35 % menos agua y repone nitrógeno; el ingreso baja X, pero el riesgo en año seco cae a la mitad".

### C. Agroexportación con estrés hídrico (Ica)
- **Usuario:** productor de espárrago o uva y su asesor técnico.
- **Problema:** el acuífero de Ica está sobreexplotado y el monocultivo empobrece el suelo.
- **Uso:** explorar cultivos de cobertura y rotaciones entre campañas, con prioridad "agua" al máximo.
- **Datos:** POWER, SMAP y NDVI histórico de la parcela.
- **Demo:** el slider de prioridad del agua cambia la recomendación en vivo.

## 7. Pitch
"No le decimos al agricultor qué sembrar: le mostramos con 30 años de datos de NASA qué pasaría con su suelo y su agua con cada rotación, y él decide."
