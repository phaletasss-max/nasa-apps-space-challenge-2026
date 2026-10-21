# 01 · Abandoned but not Forgotten

> **Reto:** contar la historia del hardware que NASA dejó en la Luna, en Marte y en el espacio profundo (rovers, módulos, sondas), para que escolares descubran el equipo y la ciencia que hizo posible.

| Dificultad | Viabilidad 48 h | Perfil | Riesgo principal |
|---|---|---|---|
| Intermedio / Juvenil | 🟢 Alta | Contenido, diseño y 3D web | Que quede como una "enciclopedia bonita" sin interacción ni historia |

## 1. Datos y fuentes
- **NSSDCA Master Catalog** (nssdc.gsfc.nasa.gov): fichas de cada misión con fechas, masa, estado y coordenadas.
- **LROC** (lroc.asu.edu): fotos orbitales de los sitios Apollo donde se ven los módulos y las huellas.
- **Moon Trek / Mars Trek** (trek.nasa.gov): mapas base y ubicaciones de aterrizaje.
- **NASA 3D Resources** (science.nasa.gov/3d-resources): modelos GLB de rovers y sondas.
- **JPL Horizons** (ssd.jpl.nasa.gov/horizons): posición actual de Voyager 1 y 2, Pioneer y New Horizons.
- **NASA Images** (images.nasa.gov): fotos de archivo con licencia de uso libre.

## 2. Stack recomendado
- **Frontend:** Astro o React + Vite, Three.js (react-three-fiber) para los modelos 3D y Leaflet con tiles de Trek para los mapas.
- **Datos:** un JSON curado a mano (más o menos 25 objetos) y un script en Python que consulta Horizons para las sondas lejanas.
- **Hosting:** Vercel o GitHub Pages.

## 3. MVP
**Sí:**
- 3 "mundos" navegables (Luna, Marte, espacio profundo), con unos 8 objetos cada uno.
- Una ficha por objeto con: qué era, qué descubrió, en qué estado está hoy y una foto o modelo 3D.
- Un modo historia: recorrido guiado de unos 5 minutos ("La vida de Spirit").
- Distancia en vivo de las Voyager, recalculada desde Horizons.

**No:**
- Catalogar todos los objetos que existen (son más de 100 en la Luna).
- AR nativa.
- Login.

## 4. Plan de trabajo
| Bloque | Data / Contenido | Frontend | Diseño / Story |
|---|---|---|---|
| H0–H4 | Lista de los 25 objetos y esquema del JSON | Repo, deploy y layout de los 3 mundos | Personaje guía y paleta |
| H4–H12 | Fichas de la Luna y de Marte | Mapa lunar con marcadores | Ilustraciones y textos de la ficha tipo |
| H12–H24 | Fichas del espacio profundo y script de Horizons | Visor 3D y ficha → **demo mínima** | Guion del modo historia |
| H24–H36 | Quiz con 10 preguntas por mundo | Modo historia y quiz | Adaptar textos para niños de 8 a 14 años |
| H36–H44 | Revisión de datos | Pulido, móvil y accesibilidad | Video de 30 s y slides |
| H44–H48 | — | Revisar enlaces | Entrega |

## 5. Riesgos
- **Exceso de contenido:** limitar a 25 objetos y priorizar los que tienen foto o modelo 3D.
- **Modelos 3D pesados:** comprimirlos con gltf-transform (Draco) y cargarlos de forma diferida (lazy).
- **Datos sin fuente:** cada ficha debe enlazar a su fuente de NASA.

## 6. Tres casuísticas
### A. Clase de ciencia en primaria y secundaria (Perú, currículo CNEB de Ciencia y Tecnología)
- **Usuario:** docente de 5.º de primaria a 2.º de secundaria.
- **Problema:** el espacio aparece en el libro como texto plano y el profesor no tiene recursos interactivos en español.
- **Uso:** sesión de 45 minutos. Los alumnos eligen un objeto, completan una "ficha de detective" (qué hacía, qué encontró, por qué se quedó allí) y exponen.
- **Datos:** fichas de NSSDCA y fotos de LROC del lugar donde está el objeto.
- **Demo:** "Lucía encuentra el rover Spirit atascado en la arena y descubre que encontró evidencia de agua antigua".

### B. Kiosko de planetario o museo (Planetario de Lima o un museo regional)
- **Usuario:** público familiar que visita la sala.
- **Problema:** una visita dura poco y hace falta un gancho rápido.
- **Uso:** modo kiosko en pantalla táctil. El "Cementerio y museo del sistema solar" muestra un contador en vivo: "Voyager 1 está a X km y sigue alejándose".
- **Datos:** Horizons (distancias en vivo) y modelos 3D.
- **Demo:** pantalla en modo atracción con rotación automática de objetos; al tocar uno se abre la historia de 60 segundos.

### C. Divulgación bilingüe (español y quechua) en redes y radio escolar
- **Usuario:** colegios rurales y divulgadores.
- **Problema:** casi no hay contenido espacial en lenguas originarias.
- **Uso:** cada ficha genera una tarjeta vertical para compartir (formato 9:16, para TikTok o Instagram) y un guion de audio de 1 minuto. Hay versión en quechua para los 5 objetos principales, revisada por un hablante.
- **Datos:** los mismos de las fichas, exportados como imagen.
- **Demo:** botón "Compartir historia" que genera la tarjeta.

## 7. Pitch
"Hay más de 100 objetos humanos en la Luna, y cada uno es una historia de ciencia. Los convertimos en un museo que un niño puede recorrer en 5 minutos, desde su celular, en su idioma."
