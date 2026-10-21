# 10 · Identify Earth Analogs for Moon Bases and Mars

> **Reto:** usar datos abiertos de la Tierra, la Luna y Marte (de NASA y otras agencias) para identificar y caracterizar **nuevos análogos terrestres** de sitios de aterrizaje o bases futuras: desiertos, zonas polares, terrenos volcánicos y áridos, cuevas, etc.

| Dificultad | Viabilidad 48 h | Perfil | Riesgo principal |
|---|---|---|---|
| Avanzado / Intermedio / Juvenil | 🟡 Media | GIS, geología y data | Un criterio de "análogo" difuso: hay que definir un índice cuantitativo y defenderlo |

## 1. Datos y fuentes
**Objetivo (Luna y Marte):**
- **Luna:** LOLA (topografía y pendiente), Diviner (temperatura superficial) y LROC (imágenes).
- **Marte:** MOLA y HRSC (topografía), THEMIS (inercia térmica), CRISM (mineralogía: arcillas, sulfatos, cloruros), TES (polvo) y Mars Climate Database (clima).

**Candidatos en la Tierra:**
- **Copernicus DEM o SRTM:** relieve y rugosidad.
- **MODIS LST:** amplitud térmica.
- **ASTER GED:** emisividad, como aproximación a la composición.
- **EMIT (en la ISS):** mineralogía superficial de regiones áridas. Es el equivalente terrestre de CRISM.
- **Aridez y precipitación:** IMERG o CHIRPS. **UV:** OMI.
- **Referencia:** análogos conocidos para calibrar el índice (Atacama, Haughton, Death Valley, Islandia, Antártida Dry Valleys).

## 2. Método
1. Definir un **vector de características** por sitio: aridez, amplitud térmica, rugosidad, albedo, clases minerales, altitud y UV.
2. Normalizar y calcular la **similitud** con un objetivo (por ejemplo, el cráter Jezero o el borde del Shackleton) con distancia ponderada o Gower.
3. **Calibrar los pesos** para que los análogos conocidos queden arriba en el ranking (validación).
4. Recorrer una región (Perú, o los Andes Centrales) en grilla y obtener un **mapa de similitud** con los mejores candidatos.
5. Para cada candidato, una **ficha de caracterización** que explica en qué se parece, en qué no y para qué pruebas sirve.

## 3. Stack recomendado
- **Data:** Python con rasterio, xarray, geopandas y scikit-learn (normalización y distancias). Google Earth Engine si el equipo lo maneja, porque acelera mucho la parte terrestre.
- **Frontend:** React con MapLibre: mapa de similitud, ficha del candidato y "radar chart" de la Tierra frente al objetivo.

## 4. MVP
**Sí:**
- 2 objetivos (un sitio en Marte y uno en la Luna) y 1 región terrestre (sur del Perú y norte de Chile).
- Índice de similitud validado con Atacama como análogo conocido.
- Top 5 candidatos con su ficha.
- Sliders de pesos: "quiero probar rovers" (relieve) o "quiero probar instrumentos de vida" (aridez y química).

**No:**
- Escaneo global.
- Mineralogía detallada pixel a pixel.
- Cuevas (no hay datos sistemáticos), salvo mencionarlas como trabajo futuro.

## 5. Plan de trabajo
| Bloque | Data planetaria | Data terrestre | Frontend | Story |
|---|---|---|---|---|
| H0–H4 | Elegir los 2 objetivos y extraer sus valores | Elegir la región y las capas | Mapa base | Usuarios |
| H4–H12 | Vectores de los objetivos | Grilla de características de la región | Mapa de capas | Fichas tipo |
| H12–H24 | Índice de similitud y validación con Atacama | Calcular el mapa | Mapa de similitud → **demo mínima** | Guion |
| H24–H36 | Sliders de pesos | Fichas del top 5 | Radar chart y fichas | Casuísticas |
| H36–H44 | — | — | Pulido | Video y slides |
| H44–H48 | — | — | — | Entrega |

## 6. Riesgos
- **Comparar cantidades distintas** (temperatura en Marte frente a la Tierra): usar rangos y percentiles relativos, no valores absolutos, y documentar cada equivalencia.
- **Pesos arbitrarios:** calibrar contra análogos conocidos y mostrar el gráfico de validación.
- **Exceso de capas:** como máximo 6 variables.

## 7. Tres casuísticas (todas en Perú)
### A. Pampas de La Joya (Arequipa): análogo de suelo marciano
- **Usuario:** astrobiólogos, CONIDA y universidades (UNSA).
- **Problema:** probar instrumentos de detección de vida y suelos oxidantes sin viajar a Atacama.
- **Uso:** la app confirma y cuantifica la similitud con Marte (hiperaridez, UV extremo, química del suelo) y la ubica en el ranking frente a Atacama. Ya existe literatura científica que la propone como análogo de suelo marciano.
- **Datos:** IMERG (aridez), OMI (UV), EMIT o ASTER (mineralogía).
- **Demo:** radar chart de La Joya frente a Jezero frente a Atacama.

### B. Valle de los Volcanes de Andagua (Arequipa): análogo volcánico para la Luna y Marte
- **Usuario:** ingenieros que prueban rovers y trajes en terreno basáltico.
- **Problema:** hacen falta campos de lava jóvenes y rugosos para probar movilidad y muestreo.
- **Uso:** con el slider en "probar rovers", la app pondera relieve, rugosidad y basalto y propone zonas de prueba concretas.
- **Datos:** Copernicus DEM (rugosidad) y ASTER GED (emisividad basáltica).
- **Demo:** mapa con 3 polígonos sugeridos para pruebas de movilidad.

### C. Laguna de Salinas (Arequipa): análogo de depósitos salinos marcianos
- **Usuario:** geólogos planetarios y educadores.
- **Problema:** los depósitos de cloruros y sulfatos de Marte son clave para el agua pasada y la habitabilidad.
- **Uso:** comparar la mineralogía evaporítica y la estacionalidad del salar con las firmas de CRISM. La app sugiere en qué meses visitarlo (seco o con agua).
- **Datos:** EMIT, ASTER y MODIS (ciclo de inundación).
- **Demo:** ficha de caracterización con "se parece en X, difiere en Y, sirve para Z".

## 8. Pitch
"Atacama ya es famosa. Nosotros encontramos, con datos de NASA, los próximos análogos de Marte y la Luna, y algunos están a pocas horas de Arequipa."
