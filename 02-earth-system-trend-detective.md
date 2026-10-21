# 02 · Be An Earth System Trend Detective!

> **Reto:** encontrar variables medidas por misiones o modelos de NASA, visualizar cómo cambian en el tiempo y determinar qué cambia, dónde, cuánto y si el cambio es estadísticamente **significativo**.

| Dificultad | Viabilidad 48 h | Perfil | Riesgo principal |
|---|---|---|---|
| Avanzado | 🟡 Media | Data science, estadística y web | Estadística mal aplicada (autocorrelación, comparaciones múltiples) |

## 1. Datos y fuentes
- **NASA POWER API** (power.larc.nasa.gov): temperatura, precipitación y radiación mensuales desde 1981, en JSON por punto o región. Es la vía más rápida.
- **Giovanni** (giovanni.gsfc.nasa.gov): series y mapas promediados de MERRA-2, GPM IMERG y MODIS sin descargar nada pesado.
- **GPM IMERG** (precipitación), **MODIS NDVI/LST** (vegetación y temperatura de superficie), **MERRA-2** (reanálisis): en Earthdata, se descargan en NetCDF.
- **GRACE/GRACE-FO** (agua subterránea y masa de hielo): mascons mensuales desde 2002.

## 2. Stack recomendado
- **Backend:** Python con xarray, pymannkendall (tendencia de Mann-Kendall y pendiente de Sen) y statsmodels. FastAPI para servir los resultados.
- **Precálculo:** las tendencias por píxel se calculan antes y se guardan en COG o NetCDF, y se sirven como tiles (titiler) o PNG.
- **Frontend:** React con MapLibre (mapa de pendientes y de p-values) y Plotly (series al hacer clic).

## 3. MVP
**Sí:**
- 3 variables (por ejemplo LST, precipitación y NDVI) sobre 1 región (Perú), en una grilla a 0.1–0.5°.
- Mapa de pendiente por década con píxeles no significativos sombreados.
- Clic en un píxel → serie temporal con línea de tendencia, intervalo de confianza y p-value.
- Corrección por comparaciones múltiples (FDR de Benjamini-Hochberg) y una explicación visible de qué significa "significativo".
- Un panel "¿Por qué sube aquí y baja allá?" que compara dos regiones.

**No:**
- Escala global en alta resolución.
- Más de 3 variables.
- Modelos de atribución causal.

## 4. Plan de trabajo
| Bloque | Data | Backend | Frontend | Story |
|---|---|---|---|---|
| H0–H4 | Elegir variables, región y periodo | Esqueleto de FastAPI | Mapa base | Definir las 3 casuísticas |
| H4–H12 | Descargar series (POWER o Giovanni) | Mann-Kendall, Sen y FDR por píxel | Capa de pendientes | Textos de ayuda |
| H12–H24 | Validar con 2–3 estaciones o papers | Endpoint de serie por píxel | Clic → gráfico → **demo mínima** | Guion |
| H24–H36 | 2.ª y 3.ª variable, desestacionalización | Comparador de regiones | Panel de comparación y leyendas | Casuísticas |
| H36–H44 | Revisión de cifras | Caché | Pulido | Video y slides |
| H44–H48 | — | — | Revisar enlaces | Entrega |

## 5. Riesgos
- **Autocorrelación serial:** usar Mann-Kendall modificado (Hamed-Rao) o pre-whitening.
- **Estacionalidad:** trabajar con anomalías mensuales o con Mann-Kendall estacional.
- **Descargas lentas:** usar POWER (es por punto, pero muy rápido) o resoluciones gruesas. Precalcular todo antes de H24.
- **Sobreinterpretar:** separar "tendencia" de "causa" en la UI.

## 6. Tres casuísticas
### A. Calentamiento y glaciares en la Cordillera Blanca (Áncash)
- **Usuario:** autoridad local del agua (ANA) e investigadores.
- **Problema:** los glaciares retroceden y el agua de Huaraz depende de ellos.
- **Uso:** la tendencia de LST (MODIS, desde 2000) y la de masa (GRACE) sobre la cordillera, comparadas con la costa.
- **Datos:** MODIS LST, GRACE-FO y NASA POWER (temperatura a 2 m).
- **Demo:** "La temperatura de superficie sube X °C por década sobre los 4,500 m, y el cambio es significativo con p < 0.01".

### B. Precipitación en la costa norte y El Niño (Piura y Tumbes)
- **Usuario:** INDECI y gobiernos regionales.
- **Problema:** separar la variabilidad de El Niño (1998, 2017, 2023) de una tendencia real.
- **Uso:** la precipitación de IMERG se analiza de dos formas, con y sin los años Niño, para ver si la tendencia sobrevive. Es justo el caso de "misma variable, signo opuesto" que pide el reto: la costa sube y la sierra sur baja.
- **Datos:** GPM IMERG mensual y el índice ONI de NOAA como covariable.
- **Demo:** un mapa dividido donde una región tiene tendencia positiva y otra negativa.

### C. Verdor de la Amazonía y frontera agrícola (Ucayali y Madre de Dios)
- **Usuario:** ONG ambientales y SERFOR.
- **Problema:** detectar dónde cae el NDVI de forma sostenida, no solo un año malo.
- **Uso:** mapa de tendencia de NDVI con píxeles significativos resaltados, superpuesto a carreteras (la Interoceánica).
- **Datos:** MODIS NDVI (MOD13) a 1 km desde 2000.
- **Demo:** zoom a la Interoceánica, donde se ve el patrón en forma de espina de pescado con pendiente negativa.

## 7. Pitch
"No basta con ver que algo sube: hay que saber si es real. Somos el detector de mentiras de las tendencias climáticas: cada mapa te dice qué cambia, dónde, cuánto y si es significativo."
