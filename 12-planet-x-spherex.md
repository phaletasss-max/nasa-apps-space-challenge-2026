# 12 · Planet X and SPHEREx

> **Reto:** una herramienta web pública que muestre imágenes del cielo de la misión **SPHEREx** (mapa completo cada 6 meses en 102 bandas del infrarrojo cercano) y haga fácil ver cómo cambian en el tiempo: cometas, asteroides, estrellas, enanas marrones y quizá planetas nuevos.

| Dificultad | Viabilidad 48 h | Perfil | Riesgo principal |
|---|---|---|---|
| Avanzado | 🔴 Baja | Astronomía (FITS y WCS), Python y web | El volumen de datos y entender el formato de SPHEREx en pocas horas |

## 1. Datos y fuentes
- **SPHEREx** (lanzada en marzo de 2025): los datos están en **IRSA** (irsa.ipac.caltech.edu). Las imágenes espectrales "Quick Release" se publican de forma continua. Acceso por la interfaz web, por búsqueda SIA o TAP con `astroquery` y por recortes (cutouts).
- **Rango:** 0.75–5.0 µm en 102 bandas. Cada píxel trae información espectral.
- **Cruce con catálogos:**
  - JPL Small-Body Database y Horizons, para las efemérides de asteroides y cometas conocidos.
  - Gaia DR3, para el movimiento propio de estrellas.
  - Las enanas marrones de CatWISE o Backyard Worlds.
- **Visualización:** Aladin Lite (HiPS) como mapa base de referencia del cielo.

## 2. Stack recomendado
- **Data:** Python con astroquery (IRSA), astropy (FITS y WCS) y reproject. Recortes pequeños (por ejemplo 0.5°×0.5°) de 2 épocas.
- **Procesamiento:** alinear las épocas al mismo WCS, restarlas o hacer "blink", y superponer las efemérides de objetos conocidos.
- **Frontend:** React con Aladin Lite (navegar el cielo), un visor blink en canvas (alternancia entre época A y B), un slider de banda (longitud de onda) y un gráfico del espectro del píxel.

## 3. MVP
**Sí:**
- 3 campos del cielo precargados (uno por casuística), con 2 épocas cada uno.
- Un **blink comparator** con velocidad ajustable y la opción de imagen diferencia.
- Superposición de los asteroides conocidos en ese campo y esa fecha (Horizons): "esto que se mueve es (12345) X".
- Un slider de banda y el espectro de un objeto al hacer clic.
- Un modo ciudadano: "marca algo que se mueve y no tenga etiqueta".

**No:**
- Navegar el cielo completo con datos de SPHEREx (usar Aladin solo como contexto).
- Detección automática de objetos nuevos (queda como trabajo futuro).

## 4. Plan de trabajo
| Bloque | Astro / Data | Backend | Frontend | Story |
|---|---|---|---|---|
| **Pre** | **Probar el acceso a IRSA, entender la estructura de los productos y descargar los recortes de prueba** | — | — | — |
| H0–H4 | Elegir los 3 campos con 2 épocas | Script de recortes | Aladin Lite | Usuarios |
| H4–H12 | Alinear (reproject) y normalizar | Generar PNGs por banda y época | Visor blink | Explicador de SPHEREx |
| H12–H24 | Efemérides de Horizons para los campos | Endpoint de overlays | Overlays sobre el blink → **demo mínima** | Guion |
| H24–H36 | Extraer espectros | Endpoint de espectro | Slider de banda y gráfico del espectro | Casuísticas |
| H36–H44 | — | Despliegue | Pulido y modo ciudadano | Video y slides |
| H44–H48 | — | — | — | Entrega |

## 5. Riesgos
- **Formato desconocido:** dedicar la preparación previa solo a descargar y abrir un FITS de SPHEREx. Si no se logra, cambiar de reto.
- **Volumen:** solo recortes y PNG pregenerados en el frontend.
- **Épocas:** confirmar que existen 2 visitas del mismo campo con separación útil. Para objetos del sistema solar sirven visitas de días distintos, incluso dentro del mismo mapeo.

## 6. Tres casuísticas
### A. Ciencia ciudadana: cazar asteroides
- **Usuario:** aficionados, clubes de astronomía y colegios.
- **Problema:** hay más datos de los que los astrónomos pueden revisar.
- **Uso:** el blink muestra puntos que se mueven. Los conocidos aparecen etiquetados con Horizons y los que no tienen etiqueta se marcan como "candidatos" para revisión.
- **Datos:** recortes de SPHEREx y efemérides de JPL.
- **Demo:** 3 asteroides conocidos etiquetados y 1 punto sin etiqueta que se invita a investigar.

### B. Enanas marrones cercanas (movimiento propio)
- **Usuario:** proyectos tipo Backyard Worlds y estudiantes de astronomía.
- **Problema:** las enanas marrones son frías, brillan en infrarrojo y están cerca, así que se mueven en el cielo con los años.
- **Uso:** comparar épocas de SPHEREx (y opcionalmente WISE) en campos con enanas marrones conocidas. El espectro de 102 bandas muestra la absorción de metano y agua que las delata.
- **Datos:** SPHEREx y CatWISE.
- **Demo:** el blink muestra el desplazamiento y el gráfico, la firma de metano.

### C. Aula: "ver" el infrarrojo y los hielos cósmicos
- **Usuario:** profesores de física de secundaria y universidad.
- **Problema:** el espectro electromagnético se enseña sin datos reales.
- **Uso:** el slider de banda recorre de 0.75 a 5 µm sobre una nube molecular, y los alumnos ven aparecer y desaparecer estructuras. El espectro muestra la banda de hielo de agua, que es uno de los objetivos científicos de SPHEREx.
- **Datos:** recortes de SPHEREx de una región de formación estelar.
- **Demo:** un "arcoíris infrarrojo" animado con el espectro marcando el hielo de agua.

## 7. Pitch
"SPHEREx fotografía todo el cielo en 102 colores invisibles. Hicimos la ventana para que cualquiera vea qué se movió entre dos fotos, y quizá encuentre algo que nadie ha visto."
