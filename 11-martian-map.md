# 11 · Interplanetary Survival Guide: Martian Map

> **Reto:** una vista integrada y por capas de un lugar o ruta en la superficie de Marte, que combine datos de varias misiones de NASA y ayude a un explorador humano a planificar y ejecutar una caminata marciana (Marswalk) segura que además produzca ciencia nueva.

| Dificultad | Viabilidad 48 h | Perfil | Riesgo principal |
|---|---|---|---|
| Intermedio | 🟡 Media | GIS web y Python geoespacial | Las capas se superponen pero no "dicen" nada: falta la lógica de planificación |

## 1. Datos y fuentes
- **Mars Trek** (trek.nasa.gov/mars): servicios WMTS listos (CTX, HiRISE, MOLA, THEMIS, geología), fáciles de consumir.
- **HiRISE** (uahirise.org): imágenes a 25–50 cm/px y DTMs en sitios específicos (Jezero y Gale tienen cobertura).
- **Mosaico global CTX** (Murray Lab, Caltech): unos 5 m/px.
- **MOLA y HRSC:** topografía, para calcular pendientes.
- **Clima:** MEDA (Perseverance) y REMS (Curiosity) en el PDS, con temperatura, presión, viento y UV. Mars Climate Database para el contexto estacional.
- **Ciencia y recursos:** CRISM (minerales), los mapas SWIM de hielo subsuperficial y las trayectorias reales de los rovers (PDS y NASA).

## 2. Stack recomendado
- **Frontend:** CesiumJS (3D con terreno marciano) o MapLibre (2D con hillshade), más tiles de Trek.
- **Backend:** Python con rasterio, la pendiente calculada desde el DEM y un **planificador A\*** sobre una grilla de costo (pendiente, rugosidad y distancia al hábitat). FastAPI.
- **Panel:** Recharts para el perfil de elevación de la ruta y las condiciones.

## 3. MVP
**Sí:**
- 1 sitio (Jezero) con 5 capas: imagen, pendiente, geología o minerales, peligros y puntos de interés científico.
- Elegir el inicio (hábitat) y los waypoints → ruta automática con A\* que evita pendientes de más de 15° y terreno rocoso.
- Una "ficha de EVA": distancia, desnivel, tiempo estimado, consumo de O₂ del traje (con el margen de regreso) y la ventana de luz y temperatura del día (sol).
- 3 paradas científicas sugeridas sobre la ruta (por ejemplo el delta y los carbonatos).

**No:**
- Varios sitios.
- Clima en tiempo real (usar la climatología de MEDA).
- Una simulación física del traje.

## 4. Plan de trabajo
| Bloque | Data | Backend | Frontend | Story |
|---|---|---|---|---|
| H0–H4 | Recortar el DEM y las capas de Jezero | FastAPI | Cesium o MapLibre con tiles de Trek | Usuarios |
| H4–H12 | Pendiente, rugosidad y costo | A\* | Capas que se activan y desactivan | Puntos de interés |
| H12–H24 | Climatología de MEDA | Ficha de EVA | Dibujar waypoints → ruta → **demo mínima** | Guion |
| H24–H36 | Hielo (SWIM) y CRISM | Paradas científicas | Perfil de elevación y paneles | Casuísticas |
| H36–H44 | — | Despliegue | Pulido | Video y slides |
| H44–H48 | — | — | — | Entrega |

## 5. Riesgos
- **DEM de HiRISE pesado:** recortar unos 10×10 km alrededor del sitio y bajar la resolución a 5 m.
- **Proyecciones de Marte:** trabajar en una sola proyección (equirectangular o la del DTM) y validar con la trayectoria real de Perseverance.
- **Interfaz recargada:** la ficha de EVA es la protagonista y el mapa es soporte.

## 6. Tres casuísticas
### A. Planificación de una EVA científica en Jezero
- **Usuario:** el comandante de la tripulación y el equipo científico en la Tierra.
- **Problema:** muestrear el delta en una salida de 6 horas con margen de seguridad.
- **Uso:** ruta automática del hábitat al delta con 3 paradas, perfil de pendientes, O₂ con margen de regreso y ventana térmica.
- **Datos:** HiRISE DTM, CRISM y MEDA.
- **Demo:** la ruta se recalcula en vivo al mover un waypoint a una zona demasiado empinada.

### B. Prospección de hielo para ISRU (Arcadia Planitia)
- **Usuario:** ingenieros de recursos in situ.
- **Problema:** una base necesita agua y hay que elegir dónde perforar sin poner en riesgo a la tripulación.
- **Uso:** combinar el mapa SWIM de hielo cercano a la superficie con la pendiente y la distancia al hábitat. Se ordenan los puntos de perforación por "agua accesible por km caminado".
- **Datos:** SWIM, MOLA y CTX.
- **Demo:** un mapa de calor de hielo con el top 3 de puntos y la ruta a cada uno.

### C. Educación: "Camina con Perseverance"
- **Usuario:** estudiantes y público.
- **Problema:** las noticias de los rovers son abstractas.
- **Uso:** recorrer la trayectoria real de Perseverance día por día, con lo que vio y midió en cada parada, y luego planificar una EVA propia y comparar.
- **Datos:** la trayectoria publicada, imágenes de navegación y MEDA.
- **Demo:** línea de tiempo animada de la ruta real y un botón "ahora planifica tú".

## 7. Pitch
"Los primeros astronautas en Marte no necesitarán más datos, sino respuestas: por dónde caminar, cuánto oxígeno llevar y dónde está la ciencia. Este mapa lo responde en una pantalla."
