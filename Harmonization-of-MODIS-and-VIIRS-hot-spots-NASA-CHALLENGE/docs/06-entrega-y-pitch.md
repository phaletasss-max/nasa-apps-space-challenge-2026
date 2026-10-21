# 06 · Entrega y pitch

> Recordatorio: según las FAQ oficiales no se puede empezar a trabajar en el reto antes del hackathon. Consulten con el Local Lead qué se puede reutilizar ([01](01-el-reto.md#estado-frente-a-las-reglas)). La guía oficial de entrega se publica el **13 de noviembre**: verifiquen ahí el formato exacto.

## Checklist de entrega (formato de ediciones anteriores; confirmar el 13 nov)

- [ ] Equipo de hasta 6 personas, inscrito en el mismo evento local
- [ ] Página del proyecto en spaceappschallenge.org, con título, resumen y reto elegido
- [ ] **Demo**: video de unos 30 s o presentación corta (ver abajo)
- [ ] **Enlace al proyecto**: sitio publicado y repositorio
- [ ] Lista de **datos y recursos de NASA** usados (FIRMS MODIS C6.1, VIIRS S-NPP 375 m, VIIRS NRT, GIBS)
- [ ] Declaración del **uso de IA** si la guía lo pide
- [ ] Entregar antes del cierre: **domingo 15 nov, 23:59 hora local**, con al menos 1 h de margen

## Guion del video de 30 s

| Tiempo | Imagen | Voz / texto en pantalla |
|---|---|---|
| 0–4 s | Globo 3D girando (`media/firecal_globe.mp4`) | "25 años de fuego en la Tierra, vistos por dos satélites de NASA" |
| 4–10 s | Serie mundial en *Empalme crudo*: salto en 2012 | "Pero no miden igual: si los unes tal cual, el fuego 'sube' un 148 % en 2012. Es falso" |
| 10–16 s | Cambio a *Armonizado*: el salto desaparece, banda de incertidumbre | "FireCal los armoniza por bioma y región: el error baja de 126 a 28, con sesgo de −0.2 %" |
| 16–24 s | Historia Canadá 2023 → calendario → KPI 3.0× | "Para cualquier lugar: calendario de quema, temporadas, récords y anomalías" |
| 24–30 s | Capa *Esta semana*, zoom a los puntos VIIRS en Perú, KPI 2.1× | "Y cada semana, una alerta: ¿esto es normal? FireCal: un registro de fuego, dos satélites, 25 años" |

## Presentación de 7 diapositivas

1. **Título:** FireCal Global. "Un registro de fuego. Dos satélites. 25 años." (imagen del globo)
2. **Problema:** dos sensores incompatibles, el salto falso de +148 % y MODIS cerca de su fin
3. **Solución:** calendario armonizado para cualquier área más alerta semanal (captura de la app)
4. **Método:** celda-día, jerarquía mundo → bioma → reino → bloque, dos etapas (diagrama de [03](03-como-funciona.md))
5. **Validación:** tabla 126 → 60 → 28 y prueba fuera de ventana (−0.4 %)
6. **Impacto:** Canadá 2023, Australia 2019 y la semana actual en Perú; usuarios y decisiones ([02](02-utilidad.md))
7. **Siguientes pasos y equipo:** FRP, área quemada y alertas por correo ([07](07-limitaciones-y-roadmap.md)); créditos de datos NASA

## Preguntas probables del jurado (y respuestas cortas)

| Pregunta | Respuesta |
|---|---|
| ¿Por qué no usan los puntos individuales? | La celda-día de 0.1° es la unidad común entre sensores. Los puntos crudos mezclarían escalas. Los puntos VIIRS de la semana sí se muestran, porque están en la escala de referencia |
| ¿Cómo saben que la armonización es correcta? | Validación dejando un año fuera, prueba en 2020–2025 sin calibrar y bootstrap. Error 28 frente a 126 sin ajustar |
| ¿Por qué calibrar solo con 2012–2019? | Es el periodo más cercano a los años que se reconstruyen y anterior a la deriva orbital de Terra y Aqua. Fuera de esa ventana el sesgo sigue en −0.4 % |
| ¿Funciona fuera de Perú? | Es global: 233 países y 14 biomas. Perú es solo una de las 8 historias |
| ¿Qué pasa cuando MODIS deje de funcionar? | Nada se rompe: la serie ya está en escala VIIRS y la alerta usa VIIRS NRT |
| ¿Cuánto cuesta operarlo? | Es un sitio estático más un trabajo diario gratuito en GitHub Actions. Sin servidores ni API keys |

## Plan para el hackathon si se empieza de cero

El equipo ya sabe qué funciona; en 48 h se puede reconstruir un núcleo equivalente:

| Bloque | Objetivo |
|---|---|
| H0–H3 | Repo, descarga FIRMS (archivo anual por país/región o global en segundo plano), app base con mapa |
| H3–H10 | Ingesta DuckDB → celda-día 0.1°; calibración global × mes como primera versión |
| H10–H20 | Jerarquía bioma → bloque y validación dejando un año fuera: **demo mínima** |
| H20–H30 | Calendario, KPIs, temporada, tendencia, alerta NRT |
| H30–H40 | Historias, CSV, idioma, pulido visual |
| H40–H48 | Video, slides, entrega con margen |
