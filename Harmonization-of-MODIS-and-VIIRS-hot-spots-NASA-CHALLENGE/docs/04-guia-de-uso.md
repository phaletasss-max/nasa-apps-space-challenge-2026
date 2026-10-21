# 04 · Guía de uso

## Abrir la app

Con el proyecto en local (detalles en [05](05-arquitectura-tecnica.md)):

```bash
cd app && npm run dev
```

Luego abre http://localhost:5178. La versión compilada (`app/dist`) es un sitio estático que puede publicarse en GitHub Pages o Vercel.

## 1. Elegir el área de interés

| Forma | Cómo |
|---|---|
| **Mundo** | Botón 🌐 (globo) o clic en el logo |
| **País** | Clic sobre el país en el mapa, o escríbelo en el buscador (acepta tildes y nombres en español) |
| **Bioma** | Escribe en el buscador, por ejemplo "Savannas" o "Boreal" |
| **Rectángulo** | Botón ▭ y arrastra sobre el mapa |
| **Polígono** | Botón ⬠, clic para cada vértice, doble clic para cerrar y Esc para cancelar |
| **Historia** | Botón *Historias*: casos guiados como Canadá 2023, Australia 2019, Perú o Indonesia 2015 |

La URL se actualiza sola. Copia el enlace (botón *Copiar enlace*) para compartir exactamente la misma vista.

## 2. Capas del mapa

| Capa | Qué muestra | Cómo leerla |
|---|---|---|
| **Actividad de fuego** | Celda-días con fuego por año (promedio 2001–2025, equivalente VIIRS) | Más claro = más fuego. Escala logarítmica |
| **Mes pico de quema** | El mes con más quema en cada celda | Color = mes; más opaco = temporada más concentrada |
| **Tendencia 25 años** | Cambio por década (Theil–Sen) | Rojo = aumenta, azul = disminuye; intenso = significativo tras el control FDR |
| **Esta semana** | Celdas: observado / esperado. Puntos: cada detección VIIRS de la semana | Rojo > 3×, naranja 1.5–3×, beige normal, azul por debajo, magenta = sin historial. Los puntos aparecen al acercarse |

**Modos de dibujo** (barra de herramientas):

- **Cuadrícula** (por defecto): celdas vectoriales nítidas a cualquier zoom. Es la unidad real del análisis.
- **Suave**: mapa de calor en GPU. Solo para la capa de actividad y solo como vista general; muestra densidad relativa.
- **3D**: columnas extruidas por actividad.

**Mapa base:** *Oscuro (vectorial)* (OpenFreeMap), *NASA Black Marble* o *NASA Blue Marble* (GIBS).

**Armonizado / Empalme crudo** (botón sobre el mapa): cambia la serie del panel para mostrar el salto falso de 2012 que aparece sin armonizar.

## 3. El panel de análisis

1. **KPIs:** actividad media anual, temporada, año récord, año elegido frente al promedio, tendencia y *Esta semana*. Un borde rojo indica actividad inusual con p < 0.01.
2. **Calendario de quema:** cada celda es un mes. *Intensidad* muestra cuánto se quemó; *Anomalía (z)* muestra cuánto se aparta de lo normal para ese mes. **Clic en una celda** selecciona ese año.
3. **Serie anual:** MODIS crudo, VIIRS crudo y la serie armonizada con su banda del 90 %.
4. **Temporada del año elegido frente a lo normal:** barras del año contra la mediana y el rango p10–p90. Las barras rojas superan el p90.
5. **Periodos críticos:** tabla de meses con z ≥ 2. Clic en una fila para ir a ese año.
6. **Alerta temprana:** ranking mundial de los países más inusuales de la semana. Clic para ir a uno.

## 4. Exportar

- **Descargar CSV:** serie mensual del área con MODIS crudo, VIIRS crudo, empalme crudo, armonizado e intervalo 5–95 %.
- **Guardar gráfico:** PNG del calendario en alta resolución.
- **Copiar enlace:** URL con el área, la capa, el año y el idioma.

## 5. Idioma

Botones **EN / ES** arriba a la derecha. La app arranca en el idioma del navegador.
