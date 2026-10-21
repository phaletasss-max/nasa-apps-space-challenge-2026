# 09 · Harmonization of MODIS and VIIRS Hot Spots ⭐ (recomendado)

> ✅ **v2 GLOBAL funcionando en `D:\nasa-space-apps-2026\Harmonization-of-MODIS-and-VIIRS-hot-spots-NASA-CHALLENGE\`**: 392.6 M de detecciones, calibración jerárquica por bioma validada (MAE 126 → 28), app EN/ES con 4 capas, historias y alerta semanal NRT, CI + actualización diaria, video 3D del globo. La v1 (solo Perú) está en `Harmonization-of-MODIS-and-VIIRS-hot-spots-NASA-CHALLENGE/archive/v1-peru/`.
>
> Las casuísticas de abajo eran de la v1. En la v2 global, Perú sigue como una de las 8 historias, junto a Canadá 2023, Australia 2019, Siberia 2021, Indonesia 2015, Pantanal, Bolivia 2024 y las sabanas tropicales.

> **Reto:** una aplicación web que armonice los registros de focos de calor de MODIS y VIIRS en un **calendario de actividad de quema**, para que equipos de alerta temprana, científicos y gestores de territorio examinen patrones históricos, condiciones inusuales y periodos críticos en un área de interés.

| Dificultad | Viabilidad 48 h | Perfil | Riesgo principal |
|---|---|---|---|
| Avanzado / Intermedio | 🟢 Alta | Data (pandas o DuckDB) y web con mapas | Que la "armonización" sea un simple concatenado de datos (el jurado lo notará) |

## 1. Datos y fuentes
- **NASA FIRMS** (firms.modaps.eosdis.nasa.gov):
  - **MODIS C6.1** (Terra y Aqua, 1 km): desde noviembre de 2000.
  - **VIIRS S-NPP** (375 m): desde enero de 2012. **NOAA-20**: desde 2018. **NOAA-21**: desde 2024.
  - **Descarga histórica:** archivos por país o región en CSV o SHP (Archive Download), para obtener el histórico completo de Perú.
  - **API de área** con una MAP_KEY gratuita: consulta los últimos días (máximo unos 10 por consulta) para el modo "en vivo".
- **Contexto:** MODIS está al final de su vida útil y VIIRS es su sucesor. Sin armonizar, la serie larga se rompe. Ese es el argumento de impacto.
- **Capas extra (opcionales):** MODIS Land Cover (MCD12Q1) para separar bosque de agrícola y pastizal, y precipitación de IMERG para explicar las anomalías.

## 2. Método de armonización (núcleo científico)
1. **Grilla común:** pasar ambos sensores a celdas de 0.1° (unos 11 km) y por día. La métrica es la **celda-día con fuego** (binaria), que resiste mejor la diferencia de resolución que contar píxeles.
2. **Filtros:** confianza de MODIS ≥ 30 % y VIIRS "nominal" o "high". Separar día y noche, porque los pasos de órbita difieren.
3. **Calibración en el periodo de solapamiento (2012–hoy):** por región (ecozona o bioma) y por mes, ajustar la relación VIIRS ≈ f(MODIS), primero con un ratio simple y luego con regresión lineal o de Poisson.
4. **Retroproyección:** aplicar f a MODIS 2000–2011 para obtener una **serie continua "equivalente VIIRS" de 2000 a hoy**, con una banda de incertidumbre.
5. **Validación:** dejar fuera un año del solapamiento (por ejemplo 2015), predecirlo desde MODIS y reportar el error.

## 3. Stack recomendado
- **Data:** Python con DuckDB o pandas, geopandas y statsmodels. Se precalculan agregados en Parquet (celda × día × sensor).
- **Backend:** FastAPI con `/calendar?aoi=geojson&years=`, `/anomaly`, `/live`.
- **Frontend:** React con MapLibre (dibujar el AOI y un mapa de calor de densidad) y ECharts (calendario año × mes o heatmap año × semana, línea de climatología y anomalías).

## 4. MVP
**Sí:**
- Perú completo, de 2000 a hoy.
- Dibujar un polígono o elegir una región, provincia o área natural protegida.
- **Calendario de quema:** heatmap año × mes con la serie armonizada, y un toggle "crudo frente a armonizado" que hace visible el salto de 2012.
- **Climatología y anomalías:** qué meses son críticos y qué años o meses fueron inusuales (z-score frente a la climatología).
- **Modo en vivo:** los focos de los últimos 7 días frente a lo normal para esta semana.

**No:**
- Escala global.
- Área quemada (eso es otro producto, MCD64).
- Predicción con machine learning.

## 5. Plan de trabajo
| Bloque | Data | Backend | Frontend | Story |
|---|---|---|---|---|
| **Pre** | **Descargar el archivo histórico de MODIS y VIIRS de Perú y sacar la MAP_KEY** | — | — | Contactos o fuentes de SERFOR e INDECI |
| H0–H4 | Cargar a DuckDB y armar la grilla 0.1° por día | FastAPI | Mapa y dibujo del AOI | Usuarios |
| H4–H12 | Filtros y agregados | `/calendar` (crudo) | Heatmap del calendario | Explicador de "por qué armonizar" |
| H12–H24 | Calibración del solapamiento y retroproyección | `/calendar` armonizado | Toggle crudo/armonizado → **demo mínima** | Guion |
| H24–H36 | Validación por año excluido y anomalías | `/anomaly`, `/live` | Climatología, anomalías y modo en vivo | Casuísticas |
| H36–H44 | Gráfico de validación para el pitch | Caché y despliegue | Pulido y móvil | Video y slides |
| H44–H48 | — | — | Revisar enlaces | Entrega |

## 6. Riesgos
- **Volumen:** Perú son pocos millones de filas, manejable con DuckDB en una laptop. Precalcular agregados y no servir puntos crudos.
- **Calibración inestable en celdas con pocos fuegos:** calibrar por región o bioma y mes, no por celda.
- **Cambio de cobertura (NOAA-20 y 21):** usar S-NPP como referencia única de VIIRS para la serie y los demás solo en el modo en vivo.

## 7. Tres casuísticas
### A. Amazonía: temporada de quemas en Madre de Dios y Ucayali
- **Usuario:** SERFOR, guardaparques del SERNANP y ONG de conservación.
- **Problema:** las quemas para habilitar chacras y pastos se concentran entre agosto y octubre, y cada año hay que saber si la temporada viene peor de lo normal.
- **Uso:** dibujar la zona de amortiguamiento de Tambopata, ver el calendario 2000–hoy y una alerta de "septiembre por encima del percentil 90".
- **Datos:** la serie armonizada, el modo en vivo y la cobertura del suelo (bosque o agrícola).
- **Demo:** el calendario muestra 2005, 2010, 2020 y 2024 como años extremos. Con el modo en vivo: "esta semana va 2.3 veces lo normal".

### B. Andes norte: incendios forestales y de pastizales (Amazonas, Cajamarca y Áncash, temporada 2024)
- **Usuario:** INDECI, gobiernos regionales y COER.
- **Problema:** en 2024 hubo una ola de incendios con declaratoria de emergencia. La pregunta es si fue inédita o ya había pasado.
- **Uso:** comparar la temporada 2024 con la climatología armonizada de 24 años (con datos crudos, el salto del sensor en 2012 exagera la tendencia).
- **Datos:** la serie armonizada e IMERG, para relacionar el exceso de focos con el déficit de lluvia.
- **Demo:** "Con los datos crudos, 2024 parece 4 veces peor que 2005; armonizado es 1.8 veces. Sigue siendo extremo, pero ahora la cifra se puede defender".

### C. Agricultura: quema de caña y rastrojos en la costa norte (La Libertad y Lambayeque)
- **Usuario:** OEFA, municipios y DIRESA (calidad del aire).
- **Problema:** la quema de caña antes de la cosecha afecta la salud de ciudades como Chiclayo y Trujillo, y hacen falta calendarios para fiscalizar y emitir alertas sanitarias.
- **Uso:** el calendario muestra los meses pico de quema agrícola. Los municipios planifican la fiscalización y las alertas de calidad del aire.
- **Datos:** la serie armonizada filtrada por cobertura "cultivos".
- **Demo:** el heatmap revela el patrón estacional y su desplazamiento en los últimos años.

## 8. Pitch
"Hay 25 años de datos de fuego, pero de dos sensores que no se pueden comparar, y uno de ellos se está apagando. Los unimos en un solo calendario confiable, para que un guardaparque sepa si este septiembre es normal o una emergencia."
