# 07 · Limitaciones y siguientes pasos

## Limitaciones conocidas (dichas con honestidad)

1. **Foco activo ≠ área quemada.** Los incendios pequeños, breves o bajo nubes pueden escapar a ambos sensores. FireCal mide *actividad detectada*, no hectáreas.
2. **Celda-día ≠ intensidad.** Indica si una celda de 0.1° ardió, no cuánta energía liberó. La potencia radiativa (FRP) todavía no está armonizada.
3. **Supuesto de estabilidad.** Asumimos que la relación MODIS–VIIRS observada en 2012–2019 también valía en 2000–2011. La prueba en 2020–2025 la respalda (sesgo de −0.4 %), pero antes de 2012 no se puede comprobar directamente.
4. **La incertidumbre de la Etapa A no entra en la banda.** La banda del 90 % cubre el factor MODIS → VIIRS, no el factor Terra → Terra+Aqua de 2000–2002. Este último está validado aparte: error de 66 a 17, sesgo 0.0 %.
5. **NRT provisional.** Los datos de la semana no traen el indicador de tipo de fuego. Enmascaramos fuentes estáticas conocidas del archivo, pero puede quedar alguna industrial nueva.
6. **Año calendario.** En el hemisferio sur, una temporada puede partirse entre dos años (por ejemplo, Australia de diciembre de 2019 a enero de 2020). La tabla de meses críticos la muestra como un solo evento.
7. **Fronteras simplificadas.** Los países salen de Natural Earth 1:50m. En costas e islas pequeñas algunas celdas se asignan al vecino más cercano.
8. **Datos sobre etiquetas.** Por la incompatibilidad entre deck.gl 9.4 y MapLibre 6, las celdas se dibujan sobre los nombres del mapa ([05](05-arquitectura-tecnica.md)).

## Hoja de ruta

| Prioridad | Mejora | Valor |
|---|---|---|
| Alta | **Año de fuego** configurable (por ejemplo, julio–junio en el hemisferio sur) | Temporadas australes completas |
| Alta | Publicar sitio y repo, y activar la actualización diaria | Enlace público para jurado y usuarios |
| Alta | **Alertas suscribibles** (correo o webhook) cuando un área supere 2× lo esperado | Alerta temprana real, no solo consultable |
| Media | Armonizar **FRP** (potencia radiativa) además de celda-días | Intensidad, no solo presencia |
| Media | Añadir VIIRS NOAA-20 y NOAA-21 | Más pases diarios y continuidad si S-NPP falla |
| Media | Cruzar con precipitación (GPM IMERG) y sequía | Explicar *por qué* un año es anómalo |
| Media | Divisiones administrativas de nivel 1 (regiones, estados) | Uso directo por gobiernos regionales |
| Baja | Dibujar las celdas bajo las etiquetas (actualizar deck.gl o usar un renderizado nativo de MapLibre) | Pulido cartográfico |
| Baja | Más idiomas (portugués, francés) | Alcance en Brasil y África |
