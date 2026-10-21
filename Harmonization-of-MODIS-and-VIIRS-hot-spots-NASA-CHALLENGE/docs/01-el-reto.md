# 01 · El reto

## Qué pide NASA

Reto oficial **Harmonization of MODIS and VIIRS Hot Spots**, del NASA Space Apps Challenge 2026. Dificultad Avanzado/Intermedio; temas Earth Science y Software. La foto del reto está acreditada a CONAE, la agencia espacial argentina.

Resumen oficial, parafraseado:

- **Por qué importa.** Saber cómo se distribuye la quema en el planeta y en el tiempo (incendios forestales y quemas agrícolas detectables por satélite) permite anticipar periodos críticos, orientar el monitoreo y mejorar la respuesta.
- **El problema.** Los satélites registran focos de calor desde hace más de 20 años, pero ese registro está partido entre sensores que no se pueden comparar directamente. Los gestores del fuego no tienen una imagen consistente de cuándo y dónde se ha quemado.
- **La tarea.** Construir una **aplicación web** que armonice esos registros en un **calendario de actividad de quema basado en focos de calor activos**.
- **Para quién.** Alerta temprana y respuesta a emergencias, científicos y gestores del territorio.
- **Qué deben poder hacer.** Examinar patrones históricos, condiciones inusuales y periodos críticos dentro de un área de interés.

Texto completo y requisitos detallados: el enunciado completo ("Challenge Statement") se publica el **28 de octubre de 2026**. Hay que releerlo ese día, porque puede añadir requisitos, recursos o datos sugeridos.

## Cómo responde FireCal a cada requisito

| Lo que pide el reto | Cómo lo cumple FireCal | Dónde verlo |
|---|---|---|
| Aplicación **web** | App estática (React + MapLibre + deck.gl) que funciona en escritorio y celular, en inglés y español | `app/` |
| **Armonizar** los registros de distintos sensores | Calibración jerárquica en dos etapas (Terra → Terra+Aqua, luego MODIS → VIIRS) por bioma, reino y bloque de 2.5°, validada | [03](03-como-funciona.md), página *Método y validación* |
| **Calendario de actividad de quema** | Mapa de calor año × mes (2000–2025) para el área elegida, en intensidad o anomalía | Panel derecho → *Calendario de quema* |
| Basado en **focos de calor activos** | NASA FIRMS: MODIS C6.1 y VIIRS S-NPP 375 m (archivo anual global + NRT de 7 días) | `pipeline/` |
| **Alerta temprana** y respuesta a emergencias | Capa *Esta semana*: observado vs. esperado con prueba de Poisson, ranking mundial y puntos de cada detección VIIRS; se actualiza a diario | Capa *Esta semana*, tarjeta *Alerta temprana* |
| **Patrones históricos** | Serie anual de 25 años, temporada de fuego, tendencia Theil–Sen | Panel → *Serie anual*, KPIs |
| **Condiciones inusuales** | Anomalías z por mes, año frente al promedio, alerta semanal | *Anomalía (z)*, *Esta semana* |
| **Periodos críticos** | Temporada (meses con el 80 % de la quema), mes pico, tabla de meses críticos (z ≥ 2) | KPIs, tabla *Periodos críticos* |
| **Área de interés seleccionable** | País, bioma, rectángulo o polígono dibujado, o el mundo entero; enlace compartible | Buscador y herramientas de dibujo |

## Fechas oficiales 2026 (FAQ de Space Apps)

| Fecha | Hito |
|---|---|
| 26 ago | Abre la inscripción |
| 17 sep | Resúmenes de los retos y formación de equipos |
| **28 oct** | **Enunciados completos de los retos** |
| 2–3 nov | Abre Space Apps Connect |
| 13 nov | Guías de entrega y de jurado; ofertas de colaboradores globales |
| **14–15 nov** | **Hackathon.** La entrega abre el sábado 14 a las 9:00 y cierra el domingo 15 a las 23:59, hora local |
| Dic 2026 / ene 2027 | Nominados y finalistas globales / ganadores |

Equipos de **hasta 6 personas**, inscritos en el mismo evento local, o en el evento universal virtual si no hay uno cerca. Cada equipo trabaja un solo reto.

## Estado frente a las reglas

Las FAQ oficiales dicen: *"Teams are not allowed to begin working on the challenges prior to the hackathon."* Es decir, los equipos no pueden empezar a trabajar en los retos antes del hackathon.

**Este proyecto se construyó el 12–13 de octubre de 2026, antes del evento.** Por eso:

- **No conviene presentarlo tal cual como entrega del hackathon.** Hacerlo podría incumplir esa regla.
- **Sí sirve como estudio y preparación.** El equipo ya conoce los datos (FIRMS, formatos, tamaños), el problema científico (el salto de 2012, el periodo solo-Terra), qué funciona (celda-día, calibración jerárquica), qué rinde en 48 h y qué no.
- **Antes del evento, consulten al Local Lead o al equipo organizador** (página *Contact* de Space Apps) qué uso está permitido. Por ejemplo: herramientas y librerías generales propias, datos ya descargados, o empezar de cero ese fin de semana con lo aprendido. La decisión es de la organización, no nuestra.
- **Fuera de la competencia** (portafolio, proyecto abierto, publicación) puede usarse sin esta restricción.

El plan de 48 h del día del evento está en [06-entrega-y-pitch.md](06-entrega-y-pitch.md#plan-para-el-hackathon-si-se-empieza-de-cero).

## Criterios de jurado

La guía oficial de jurado 2026 se publica el **13 de noviembre**. En ediciones anteriores se evaluaba:

| Criterio | Cómo lo atiende FireCal |
|---|---|
| **Impacto** | Alerta temprana global diaria; sirve a gestores, ciencia y medios en cualquier país ([02](02-utilidad.md)) |
| **Creatividad** | Armonización jerárquica por bioma, calendario por área arbitraria, alerta en escala VIIRS sin conversiones |
| **Validez** | Validación dejando un año fuera, prueba fuera de ventana, intervalos bootstrap, tests automáticos |
| **Relevancia** | Usa directamente los productos FIRMS de NASA y responde punto por punto al enunciado |
| **Presentación** | App pulida y bilingüe, historias guiadas, video 3D del globo, página de método |
