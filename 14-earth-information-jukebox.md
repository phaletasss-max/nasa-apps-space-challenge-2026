# 14 · The Earth Information Jukebox

> **Reto:** construir un "Earth Jukebox", una interfaz, script o aplicación que empareje cuadros de visualizaciones del Earth Information Center (EIC) de NASA con **sonificaciones generadas en tiempo real**, para que la ciencia de la Tierra sea accesible y multisensorial.

| Dificultad | Viabilidad 48 h | Perfil | Riesgo principal |
|---|---|---|---|
| Intermedio / Juvenil | 🟢 Alta | Audio y música, creatividad y web | Que el sonido sea bonito pero arbitrario: el mapeo de dato a sonido tiene que ser legible y explicable |

## 1. Datos y fuentes
- **Earth Information Center** (earth.gov): visualizaciones e indicadores (temperatura, nivel del mar, hielo, incendios, gases de efecto invernadero).
- **NASA Scientific Visualization Studio** (svs.gsfc.nasa.gov): secuencias de frames en alta resolución con las fuentes de datos documentadas.
- **GIBS/Worldview:** tiles diarios para generar frames propios (por ejemplo, temperatura superficial del mar).
- **Datos numéricos detrás de las imágenes:** usar el dato numérico, no solo el píxel. Por ejemplo, las anomalías de temperatura GISTEMP o el nivel del mar por altimetría.
- **Inspiración:** el proyecto de sonificación de datos de Chandra (NASA), que sirve de referencia de buenas prácticas.

## 2. Stack recomendado
- **Audio:** Tone.js sobre la Web Audio API, en tiempo real en el navegador.
- **Análisis de frame:** canvas `getImageData`, que convierte el color a valor con la paleta (colormap) inversa de la visualización, y opcionalmente el dato numérico.
- **Mapeo:**
  - Valor → tono (escala pentatónica para que no suene mal).
  - Extensión o área → volumen.
  - Variable → instrumento (timbre).
  - Posición → paneo estéreo.
- **Frontend:** React con un reproductor que recorre los frames y una "barra de escaneo" visual que muestra qué parte de la imagen está sonando.

## 3. MVP
**Sí:**
- 3 "discos" (datasets) en el jukebox, uno por casuística.
- Reproducción sincronizada entre frame e imagen, con una barra de escaneo.
- **Leyenda sonora:** antes de cada pista, un "tutorial de 10 segundos" (este sonido = frío, este = caliente).
- Controles: velocidad, instrumento y aislar una región.
- Accesibilidad completa por teclado y lector de pantalla, con descripciones de texto alternativas.

**No:**
- Composición generativa con IA.
- Más de 3 datasets.
- App nativa.

## 4. Plan de trabajo
| Bloque | Data | Audio | Frontend | Story / A11y |
|---|---|---|---|---|
| H0–H4 | Elegir 3 visualizaciones y descargar los frames | Prototipo con Tone.js (un valor → una nota) | Reproductor de frames | Usuarios |
| H4–H12 | Paleta inversa (color → valor) | Mapeo completo para el disco 1 | Barra de escaneo sincronizada | Leyenda sonora |
| H12–H24 | Discos 2 y 3 | Instrumentos por variable | Controles → **demo mínima** | Guion |
| H24–H36 | Validar el mapeo con alguien externo | Mezcla y efectos | Teclado, lector de pantalla y modo aislar región | Casuísticas y prueba con un usuario con discapacidad visual si es posible |
| H36–H44 | — | — | Pulido | Video (¡con buen audio!) y slides |
| H44–H48 | — | — | — | Entrega |

## 5. Riesgos
- **Sonido arbitrario:** documentar el mapeo y tener siempre a mano la leyenda sonora.
- **Fatiga auditiva:** pistas cortas (30–60 s) y escalas consonantes.
- **Paleta inversa imprecisa:** cuando se pueda, usar el dato numérico original en lugar del color.

## 6. Tres casuísticas
### A. Accesibilidad: ciencia de la Tierra para personas con discapacidad visual
- **Usuario:** estudiantes con discapacidad visual (colegios y CEBE en Perú, con la Unión Nacional de Ciegos del Perú como posible aliada).
- **Problema:** casi toda la divulgación climática es visual.
- **Uso:** navegación solo por teclado. El usuario "escucha" cómo se calienta el planeta década por década y puede aislar Sudamérica.
- **Datos:** la serie de anomalías de temperatura de NASA (GISTEMP) y su visualización.
- **Demo:** con los ojos cerrados, el tono sube con las décadas y el último tramo suena claramente más agudo.

### B. Instalación inmersiva en museo o planetario
- **Usuario:** visitantes del Planetario de Lima, de museos o de festivales de arte y ciencia.
- **Problema:** hay que atraer público nuevo a la ciencia del clima.
- **Uso:** un modo instalación en pantalla grande con audio espacial. Cada visitante elige un disco y el sonido llena la sala mientras la visualización avanza.
- **Datos:** las secuencias de frames de alta resolución de SVS.
- **Demo:** una grabación de la sala con el disco "La Tierra respira" (NDVI estacional: el hemisferio norte y el sur se alternan como respiración).

### C. Aula de música y ciencia: El Niño en sonido
- **Usuario:** docentes de arte y de ciencias trabajando juntos.
- **Problema:** El Niño es clave para Perú, pero es abstracto para los alumnos.
- **Uso:** sonificar la temperatura superficial del mar del Pacífico ecuatorial durante El Niño 1997–98, 2015–16 o 2023. Los alumnos identifican "el momento del Niño" solo de oído y luego componen variaciones.
- **Datos:** temperatura superficial del mar de GIBS o SVS.
- **Demo:** el tono sube cuando la lengua de agua caliente llega a la costa peruana.

## 7. Pitch
"El cambio climático se ve, pero también se puede escuchar. El Jukebox convierte las visualizaciones de NASA en música explicable, para quienes no pueden verlas y para quienes ya se cansaron de verlas."
