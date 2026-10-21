# 04 · CLPS Lunar Mission Browser

> **Reto:** una herramienta intuitiva para que planificadores, educadores y público comparen sitios y fechas de alunizaje en el polo sur lunar, visualizando la posición del Sol y de la Tierra respecto al horizonte. Sirve para evaluar la generación de energía y las ventanas de comunicación directa con la Tierra.

| Dificultad | Viabilidad 48 h | Perfil | Riesgo principal |
|---|---|---|---|
| Avanzado / Intermedio | 🟢 Alta | Astronomía computacional, Python y web | La máscara de horizonte (el relieve local tapa el Sol y la Tierra) |

## 1. Datos y fuentes
- **SPICE (NAIF, naif.jpl.nasa.gov):** efemérides `de440.bsp` y kernels de orientación lunar (PCK/FK `moon_pa_de440…`, `moon_de440…tf`).
- **Skyfield (Python):** admite marcos lunares con esos kernels y da altitud y azimut del Sol y la Tierra para una latitud y longitud selenográficas. Es más simple que spiceypy.
- **LOLA DEM del polo sur** (PGDA, pgda.gsfc.nasa.gov): mosaicos de 5–20 m/px para calcular la máscara de horizonte.
- **Sitios candidatos:** las 9 regiones candidatas de Artemis III (Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Mons Mouton, Nobile Rim 1 y 2, de Gerlache Rim 2, Slater Plain) y los sitios de misiones CLPS.
- **Moon Trek** (trek.nasa.gov/moon): mapa base y capas de iluminación promedio.

## 2. Stack recomendado
- **Backend:** Python con Skyfield, numpy y rasterio. FastAPI con el endpoint `/ephemeris?site=&start=&end=&step=`.
- **Máscara de horizonte:** se precalcula por sitio con ray-casting sobre el DEM en 360 azimuts (un JSON por sitio).
- **Frontend:** React con un diagrama polar del cielo en D3 (trayectorias del Sol y la Tierra sobre la máscara de horizonte), una línea de tiempo y un mapa en Leaflet con tiles de Trek.

## 3. MVP
**Sí:**
- Unos 6 sitios precargados y la opción de elegir fecha y duración (por ejemplo 28 días).
- Diagrama polar con la trayectoria del Sol y de la Tierra y el horizonte real.
- Una línea de tiempo con dos bandas: **"Sol visible"** (energía) y **"Tierra visible"** (comunicación directa).
- Métricas: % de iluminación, % de comunicación, % con ambos a la vez y la noche más larga continua.
- Comparador lado a lado de 2 sitios o 2 fechas.

**No:**
- Iluminación parcial del disco solar con precisión de penumbra (se puede aproximar con el centro más el semidiámetro).
- Sitios arbitrarios fuera del DEM precargado.

## 4. Plan de trabajo
| Bloque | Astro / Data | Backend | Frontend | Story |
|---|---|---|---|---|
| H0–H4 | Kernels y Skyfield funcionando para 1 sitio | Esqueleto de FastAPI | Diagrama polar estático | Definir usuarios |
| H4–H12 | Recortar DEM y hacer ray-cast del horizonte para 6 sitios | Endpoint de efemérides | Diagrama polar con datos reales | Fichas de sitios |
| H12–H24 | Validar contra iluminación publicada (Mazarico et al.) | Métricas y ventanas | Línea de tiempo → **demo mínima** | Guion |
| H24–H36 | Más sitios y caché | Comparador | Mapa y comparador | Casuísticas |
| H36–H44 | — | Despliegue | Pulido y modo educativo | Video y slides |
| H44–H48 | — | — | Revisar enlaces | Entrega |

## 5. Riesgos
- **Marcos de referencia:** validar el día 1 con un caso conocido (la Tierra siempre a menos de unos 7° del horizonte cerca del polo, por la libración).
- **DEM grande:** recortar a unos 20 km alrededor de cada sitio y bajar la resolución a 20 m para el horizonte.
- **Rendimiento:** precalcular cada sitio a un paso de 1 h para todo un año (unas 8,760 filas, que es poco).

## 6. Tres casuísticas
### A. Planificador de misión: elegir la ventana de aterrizaje
- **Usuario:** ingeniero de operaciones de un proveedor CLPS.
- **Problema:** el lander es solar y necesita aterrizar al inicio de un periodo largo de luz con la Tierra visible para enviar telemetría.
- **Uso:** compara Mons Mouton con Malapert para enero y febrero, y ordena las fechas por "horas continuas con Sol y Tierra a la vez".
- **Datos:** Skyfield y la máscara LOLA.
- **Demo:** "Aterrizar el día X en Malapert te da 9 días de energía con comunicación; el día Y solo 3".

### B. Educador: ¿por qué todos quieren ir al polo sur?
- **Usuario:** profesor de física o astronomía de secundaria o universidad.
- **Problema:** explicar los cráteres de sombra permanente, el hielo de agua y por qué en los picos casi nunca anochece.
- **Uso:** un modo de animación que acelera un mes y muestra cómo el Sol "rueda" por el horizonte sin salir ni ponerse. Se compara con un sitio ecuatorial (Apollo 11).
- **Datos:** los mismos, más un sitio de referencia.
- **Demo:** diagrama polar animado lado a lado: polo frente a ecuador.

### C. Público: seguir una misión en vivo
- **Usuario:** aficionados y planetarios durante un alunizaje CLPS o Artemis.
- **Problema:** las noticias dicen "el lander perdió comunicación" y nadie entiende por qué.
- **Uso:** una página de misión en vivo que muestra la posición actual del Sol y la Tierra vista desde el lander y una cuenta regresiva hasta que la Tierra se oculte tras el horizonte.
- **Datos:** efemérides en tiempo real.
- **Demo:** widget "Ahora mismo desde Mons Mouton: Sol a 1.2°, Tierra a 4.8°, comunicación ✅ por 37 h más".

## 7. Pitch
"Las herramientas de efemérides existen, pero hablan en kernels SPICE. Nosotros respondemos en 3 segundos la única pregunta que importa: ¿tendré Sol y podré llamar a casa?"
