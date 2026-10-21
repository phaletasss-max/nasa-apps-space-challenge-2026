# FireCal Global: documentación del reto

**NASA Space Apps Challenge 2026 · Reto: _Harmonization of MODIS and VIIRS Hot Spots_**
Dificultad oficial: Avanzado / Intermedio · Temas: Earth Science, Software
Página oficial: https://www.spaceappschallenge.org/2026/challenges/harmonization-of-modis-and-viirs-hot-spots/

> ⚠️ **Antes de leer, revisa el estado frente a las reglas.** Las FAQ oficiales dicen que los equipos no pueden empezar a trabajar en los retos antes del hackathon (14–15 de noviembre de 2026). Este proyecto se construyó antes, como estudio y preparación. Cómo encaja eso con una entrega oficial está en [01-el-reto.md](01-el-reto.md#estado-frente-a-las-reglas).

## Índice

| Documento | Para qué sirve |
|---|---|
| [01 · El reto](01-el-reto.md) | Qué pide NASA, fechas, reglas y cómo responde FireCal a cada requisito |
| [02 · Utilidad](02-utilidad.md) | **Para quién sirve, qué decisiones apoya, casos reales y valor frente a lo que ya existe** |
| [03 · Cómo funciona](03-como-funciona.md) | El método explicado sin tecnicismos, con cifras de validación |
| [04 · Guía de uso](04-guia-de-uso.md) | Paso a paso de la app: capas, áreas, calendario, alerta y exportación |
| [05 · Arquitectura técnica](05-arquitectura-tecnica.md) | Pipeline, formatos de datos, decisiones de renderizado, CI y despliegue |
| [06 · Entrega y pitch](06-entrega-y-pitch.md) | Checklist de entrega, guion del video de 30 s, 7 diapositivas y preguntas del jurado |
| [07 · Limitaciones y siguientes pasos](07-limitaciones-y-roadmap.md) | Lo que no hace todavía y la hoja de ruta |

## En una frase

FireCal convierte 25 años de focos de calor de dos satélites de NASA que no se pueden comparar (MODIS y VIIRS) en **un solo calendario de quema confiable para cualquier lugar del mundo**, y compara **esta semana** contra esa historia para detectar a tiempo lo que no es normal.

## Cifras clave (verificadas en esta versión)

| | |
|---|---|
| Detecciones procesadas | **392.6 millones**: MODIS 111.4 M (2000–2025) y VIIRS 281.1 M (2012–2025) |
| Celdas de 0.25° con fuego | **184 267**, en 233 países y 14 biomas |
| Salto falso en 2012 si se empalman los datos crudos | **+148 %** a nivel mundial; armonizado, **−4 %** |
| Error al predecir un año dejado fuera (bloque 2.5° × mes) | MODIS crudo **126**, un factor global **60**, FireCal **28** celda-días |
| Sesgo de FireCal | **−0.2 %** dentro de la ventana de calibración; **−0.4 %** fuera de ella (2020–2025) |
| Alerta semanal | Ventana 6–11 oct 2026: 78 622 celda-días observados frente a 85 211 esperados en el mundo |
