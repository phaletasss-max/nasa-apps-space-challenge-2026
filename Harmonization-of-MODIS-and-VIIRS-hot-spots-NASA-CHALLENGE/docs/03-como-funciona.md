# 03 · Cómo funciona (en lenguaje simple)

## 1. Los datos

- **NASA FIRMS** publica cada foco de calor detectado por satélite, con su latitud, longitud, fecha, confianza y tipo.
  - **MODIS C6.1** (Terra y Aqua): 2000–2025, **111.4 millones** de detecciones en el mundo.
  - **VIIRS S-NPP 375 m**: 2012–2025, **281.1 millones**.
  - **VIIRS NRT**: los últimos 7 días, actualizado varias veces al día.
- **Límites de países**: Natural Earth. **Biomas y reinos biogeográficos**: RESOLVE Ecoregions 2017.

Solo usamos fuegos de vegetación (`type = 0`), es decir, sin volcanes, industrias ni plataformas en el mar. También descartamos detecciones de baja confianza.

## 2. La unidad común: "celda-día con fuego"

VIIRS ve más píxeles por cada incendio porque sus píxeles son más chicos. Si contáramos píxeles, compararíamos peras con manzanas. Entonces:

- Dividimos el planeta en celdas de **0.1°** (unos 11 km).
- Para cada día preguntamos solo **"¿esta celda ardió hoy, sí o no?"**.
- Sumamos esos "sí" por mes en celdas de **0.25°** (unos 28 km).

Eso ya elimina gran parte de la diferencia de resolución, aunque no toda: VIIRS sigue viendo fuegos más pequeños.

## 3. La calibración (el corazón del método)

Desde 2012 los dos sensores funcionan a la vez. En esos años sabemos cuántas celdas-día ve VIIRS por cada una que ve MODIS: ese es el **factor k**. Pero k cambia según el lugar: no es lo mismo una sabana africana que un bosque boreal o un cultivo de caña. Por eso k se calcula por niveles:

```
Mundo  →  Bioma  →  Bioma × reino biogeográfico  →  bloque local de 2.5°   (y por mes del año)
```

Cada nivel **"pide prestada" información a su nivel superior**: donde hay muchos datos, el bloque local usa su propio factor; donde hay pocos, se parece al de su bioma. Esto se llama *shrinkage* empírico-bayesiano. La fuerza del préstamo (α = 30) **no la elegimos a ojo**: se escogió probando varios valores y quedándonos con el que mejor predice años que el modelo no vio.

**Etapa extra.** Antes de julio de 2002 solo existía el satélite Terra; Aqua llegó después. Un segundo factor, calibrado con 2003–2011, lleva esos meses a la escala Terra+Aqua. Sin esto aparecería un segundo salto falso en 2002.

**Resultado:** para cada mes desde noviembre de 2000 existe un valor **equivalente VIIRS**. Desde febrero de 2012 se usa VIIRS directamente.

## 4. ¿Cómo sabemos que funciona?

**Validación dejando un año fuera.** Escondemos un año (por ejemplo 2015), calibramos con los demás, predecimos lo que VIIRS vio ese año usando solo MODIS y medimos el error. Lo repetimos con cada año de 2012 a 2019.

| Método | Error medio por bloque de 2.5° y mes | Error por país y año | Sesgo |
|---|---:|---:|---:|
| MODIS sin ajustar | 126.0 | 13 860 | −62 % |
| Un solo factor global | 60.4 | 3 931 | 0 % |
| Por bioma y mes | 52.1 | 2 937 | 0.1 % |
| **FireCal jerárquico** | **28.1** | **943** | **−0.2 %** |

- **Prueba más dura.** Calibrado solo con 2012–2019 y usado para predecir 2020–2025 (años que nunca vio), el sesgo es de −0.4 %.
- **Incertidumbre.** Repetimos la calibración 200 veces remuestreando los años (*bootstrap*). Eso da la banda del 90 % que se ve en los gráficos antes de 2012.

## 5. Lo que calcula para cada área

| Indicador | Cómo se calcula |
|---|---|
| **Temporada de fuego** | La racha más corta de meses que concentra el 80 % de la quema media anual |
| **Año récord / año vs. normal** | Total anual armonizado frente al promedio 2001–2025 |
| **Tendencia** | Pendiente de Theil–Sen con prueba de Mann–Kendall. En el mapa, control de falsos positivos (Benjamini–Hochberg, 5 %) entre 110 mil celdas |
| **Periodos críticos** | Meses con z ≥ 2 respecto del mismo mes en los 25 años |
| **Esta semana** | Celdas-día VIIRS de los últimos días completos frente a lo esperado según la climatología armonizada de esas mismas fechas. Prueba de Poisson ("¿es improbable tanto fuego por azar?") |

**Por qué la alerta semanal es directa:** como la historia ya está en escala VIIRS, el dato de esta semana (VIIRS) se compara tal cual, sin ninguna conversión.
