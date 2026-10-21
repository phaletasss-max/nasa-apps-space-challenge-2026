# 02 · Utilidad: para qué sirve y a quién

## El problema práctico, sin tecnicismos

Supón que eres jefe de guardaparques y quieres saber si **este septiembre viene peor de lo normal**. Para responder necesitas dos cosas:

1. **Qué es "normal"**, es decir, muchos años de historia comparables entre sí.
2. **Qué está pasando ahora**, con datos de esta semana.

Los satélites de NASA tienen ambas, pero **partidas en dos sensores que miden distinto**:

- **MODIS** (desde 2000) ve el fuego con píxeles de 1 km.
- **VIIRS** (desde 2012, y el de esta semana) los ve de 375 m y detecta unas **2.6 veces más** celdas con fuego en el mundo.

Si comparas esta semana (VIIRS) con un promedio histórico que mezcla MODIS, **todo parece una emergencia**. Si pegas los dos registros tal cual, la quema mundial "sube" un **+148 % en 2012**. Ese salto no existe: es el cambio de satélite.

FireCal **pone toda la historia en la misma escala que VIIRS**. Así el "normal" y el "ahora" se comparan directamente, en cualquier lugar del planeta.

## Quién lo usa y para qué decisión

| Usuario | Pregunta que responde | Qué mira en FireCal |
|---|---|---|
| **Defensa civil / respuesta a emergencias** (INDECI, COER, protección civil) | ¿Esta semana hay más fuego de lo esperado en mi región? ¿Dónde mover brigadas? | Capa *Esta semana*, KPI *Esta semana*, ranking mundial |
| **Gestores de áreas protegidas y forestales** (SERNANP, SERFOR, parques nacionales) | ¿Cuándo empieza y termina la temporada en mi zona? ¿Este año es atípico? | *Temporada de fuego*, *Calendario*, *Año vs. normal* |
| **Gobiernos regionales y municipios** | ¿En qué meses fiscalizar quemas agrícolas y emitir alertas de calidad del aire? | Calendario de un área dibujada (por ejemplo, valles cañeros) |
| **Científicos** | ¿Hay tendencia real de 25 años o es el cambio de sensor? ¿Dónde es significativa? | Capa *Tendencia* (con control FDR), CSV con intervalos, página de método |
| **Aseguradoras y agro** | ¿Cuál es el riesgo histórico de fuego de una zona y en qué meses? | CSV por área, mes pico, récords |
| **Periodistas y ONG** | ¿Lo de este año es inédito o ya pasó antes? | Historias, año récord, *Empalme crudo vs. armonizado* |
| **Educación** | ¿Cómo y cuándo arde el planeta? | Capa *Mes pico* (la temporada se invierte entre hemisferios), globo 3D |

## Casos reales que la app reproduce sola

Ninguna de estas cifras está escrita a mano en la app: salen de los datos al seleccionar el área.

| Caso | Lo que muestra FireCal |
|---|---|
| **Canadá 2023** | Año récord de 25 años: **3.0×** lo normal (+203 %). Los meses más extremos son septiembre y junio de 2023. |
| **Sureste de Australia, Verano Negro** | Los meses más anómalos del registro son **diciembre de 2019 (6.1× lo normal)** y noviembre de 2019 (4.8×). |
| **Indonesia 2015 (El Niño)** | 2015 queda en el puesto 2 de 25 años (+111 %); septiembre y octubre son meses críticos (z ≥ 2). El récord es 2006, otro año de El Niño. |
| **Andes del norte del Perú** | 2024 queda en el puesto 2 de 25 (+61 % en el área dibujada). **Esta semana (6–11 oct 2026) va a 2.1× lo esperado**: 257 frente a 123. |
| **Mundo** | Tendencia de **−9 % por década**, significativa. Coincide con la caída de la actividad de fuego global que reporta la literatura. |

## Qué aporta frente a lo que ya existe

Lo que sigue es una comparación general de enfoques, no una evaluación detallada de cada servicio.

| Herramienta típica | Qué ofrece | Qué le falta para esta pregunta |
|---|---|---|
| Mapas de focos en tiempo casi real (como NASA FIRMS) | Detecciones recientes, punto por punto | No dicen si esto es "normal" para el lugar y la fecha; la historia viene en dos sensores no comparables |
| Productos de área quemada y emisiones | Estadística científica de largo plazo | Llegan con retraso, a resolución gruesa y sin alerta semanal |
| Analizar los CSV a mano | Flexibilidad total | Semanas de trabajo técnico: descargar GB, armonizar y validar |

**FireCal une las tres cosas**: historia armonizada y validada, más la semana actual en la misma escala, para cualquier área y en segundos. Además permite descargar todo en CSV para seguir analizando.

## Por qué es urgente

MODIS (en los satélites Terra y Aqua) está al final de su vida útil y VIIRS es su sucesor. Sin armonización, los registros de largo plazo **se cortan justo en el cambio de sensor**. El método de FireCal permite seguir usando los 25 años como una sola serie y comparar cada semana nueva contra ella.

## Ejemplo de flujo real: un COER regional

1. El lunes, el analista abre FireCal en su región (enlace guardado).
2. En el KPI **Esta semana** ve "2.1× · Actividad inusual".
3. En la capa *Esta semana* hace zoom y ve **cada detección VIIRS** coloreada por día. Identifica dos focos de concentración.
4. En el **Calendario** confirma que la temporada va de julio a diciembre y que este año ya superaba el promedio.
5. Descarga el **CSV** y adjunta el **gráfico** al reporte semanal, con fuente NASA FIRMS y método documentado.

Tiempo total: unos minutos, sin instalar nada ni procesar datos.
