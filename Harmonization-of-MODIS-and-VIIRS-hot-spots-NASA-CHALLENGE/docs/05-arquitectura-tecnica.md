# 05 · Arquitectura técnica

## Visión general

```
FIRMS (anual global + NRT 7 días)        Natural Earth · RESOLVE
            │                                     │
   download.py → ingest.py (DuckDB)          strata.py (rasterizado PIL)
            │   celda-día 0.1° → parquet          │  país · bioma · reino por celda 0.25°
            └───────────────┬─────────────────────┘
                     calibrate.py  (2 etapas, shrinkage jerárquico, validación dejando un año fuera, bootstrap)
                            │
                      export.py  → app/public/data/  (series, tiles, overview, meta, validación)
                            │
                        nrt.py  → nrt.json, nrt_points.bin, overview.bin   (diario, sin el archivo de 7 GB)
                            │
      app/ (React 19 + TypeScript + Vite · MapLibre 6 · deck.gl 9.4 · ECharts 6 · zustand)
```

Reproducir todo:

```bash
.venv/Scripts/python pipeline/run_all.py
```

La primera vez descarga unos 7 GB; después procesa en unos 10 min. Tiempos medidos: ingesta de 40 archivos en unos 5 min, estratificación 60 s, calibración 45 s y exportación 10 s.

## Datos que consume la app (`app/public/data`, unos 80 MB)

| Archivo | Contenido | Cuándo se carga |
|---|---|---|
| `meta.json` | Grilla, calendario, países, biomas, disposición de `overview.bin` | Al inicio |
| `overview.bin` (4.4 MB) | Una fila por celda con fuego: id, media, tendencia, significancia, mes pico, observado/esperado NRT, país, bioma (columnas binarias) | Al inicio |
| `series/{ISO3 | B{n} | WORLD}.json` | Series mensuales precalculadas por país, bioma o mundo (unos 10 KB cada una) | Al elegir el área |
| `tiles/{tx}_{ty}.bin` (406 tiles de 10°) | Factores de calibración por unidad y meses dispersos MODIS/VIIRS por celda; el navegador armoniza igual que Python | Al dibujar un área |
| `nrt.json`, `nrt_points.bin` (2.6 MB) | Ranking semanal y cada detección VIIRS de la ventana | Al inicio / al abrir la capa *Esta semana* |
| `validation.json`, `countries.geojson` | Métricas de validación y contornos 1:110m | Página de método / mapa |

**Consistencia comprobada.** Al sumar en el navegador las 1 586 celdas de Perú desde los tiles se obtiene exactamente la serie precalculada en Python: MODIS y VIIRS idénticos, armonizado con diferencia máxima de 0.05 por redondeo.

## Decisiones de renderizado (respuesta a la retroalimentación sobre el "pixelado")

| Recomendación recibida | Qué hicimos | Por qué |
|---|---|---|
| Mapa base con teselas vectoriales | ✅ **OpenFreeMap "dark"**, vectorial, gratuito y sin API key; nítido a cualquier zoom | `mapbox://styles/...` exige cuenta y token de Mapbox |
| Mapas base NASA con niveles de detalle | ✅ GIBS ya sirve teselas por nivel de zoom (hasta el nivel 8) | Sin cambios |
| Dejar de pintar un raster estirado | ✅ Las celdas ahora son **geometría vectorial** (polígonos binarios en deck.gl), con un borde fino entre ellas | Antes se dibujaban como bitmap: al hacer zoom se agrandaban los píxeles |
| Mapa de calor suave | ✅ Modo **Suave** (HeatmapLayer en GPU) para la vista general | Se marca como "densidad relativa": la escala absoluta está en la cuadrícula |
| Pintar cada punto y agruparlos en clústeres | ✅ **Parcial:** en *Esta semana* se dibuja **cada detección VIIRS real** (286 596 puntos, 375 m) como círculo vectorial. ❌ No se dibujan puntos crudos del histórico | La celda de 0.25° es la unidad donde se armonizan los sensores; dibujar puntos crudos de MODIS y VIIRS volvería a mezclar escalas, que es justo el error que el reto pide corregir |
| Íconos SVG | ✅ Todos los íconos son SVG en línea (antes había caracteres Unicode y emojis, que cambian según el sistema operativo) | Nitidez en cualquier pantalla |
| Calendario en canvas o SVG | ✅ Ya lo era: ECharts dibuja en canvas con antialiasing y exporta PNG a 2× | Sin cambios |

**Limitación técnica encontrada.** El modo "interleaved" de deck.gl 9.4, que dibuja los datos dentro de la pila de MapLibre para dejar las etiquetas encima, falla con MapLibre 6. Por eso los datos se dibujan en una capa superpuesta; las etiquetas siguen visibles a través de las celdas semitransparentes.

## Calidad y operación

- **Tests:** 7 pruebas del núcleo científico (shrinkage, reglas de armonización, Mann–Kendall, FDR, Poisson, métricas y formato binario de los tiles). Comando: `python -m pytest tests -q`.
- **CI (`.github/workflows/ci.yml`):** pyflakes, pytest, instalación y build de la app en cada push o PR.
- **Actualización diaria (`.github/workflows/nrt-pages.yml`):** descarga el NRT, recalcula la alerta y despliega a GitHub Pages. Solo necesita `data/state/nrt_state.npz` (4 MB). No está activado: requiere crear el repositorio.
- **Rendimiento:** bundle de 796 KB comprimido; la página de método se carga bajo demanda; ECharts importa solo los módulos que usa.
- **Licencias:** código MIT. Los datos conservan las suyas: NASA (libre), RESOLVE (CC-BY 4.0), Natural Earth (dominio público) y OpenStreetMap (ODbL, vía OpenFreeMap).
