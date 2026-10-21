# 06 · Dancing with the SARs (NISAR)

> **Reto:** una aplicación interactiva que use datos de radar de la misión NASA-ISRO **NISAR** para seguir y visualizar uno o más tipos de cambio en la superficie terrestre (humedales, incendios, sismos, agricultura, glaciares) en distintos lugares del mundo.

| Dificultad | Viabilidad 48 h | Perfil | Riesgo principal |
|---|---|---|---|
| Avanzado / Intermedio | 🔴 Baja | Teledetección SAR, Python geoespacial y web | Volumen de datos (GB por escena) y disponibilidad real de productos NISAR para el AOI elegido |

## 1. Datos y fuentes
- **NISAR** (lanzado en julio de 2025): productos en **ASF DAAC** (search.asf.alaska.edu y la librería `asf_search`). Los productos L2 útiles son **GCOV** (retrodispersión, ideal para cambios) y **GUNW** (interferogramas, para deformación). **Verificar antes del evento qué productos ya son públicos para el AOI.**
- **Plan B en banda L:** ALOS-2 PALSAR-2 (mosaicos anuales de JAXA) o UAVSAR (NASA).
- **Plan B en banda C:** Sentinel-1 RTC (OPERA RTC-S1 de NASA/JPL, ya corregido y listo) en ASF.
- **Aprendizaje:** el SAR Handbook de NASA SERVIR, con notebooks gratuitos.

## 2. Stack recomendado
- **Procesamiento previo:** Python con `asf_search`, rasterio, xarray y rioxarray. Recortar a un AOI pequeño (≤ 50×50 km) y convertir a COG en dB.
- **Servidor de tiles:** titiler, o PNGs pregenerados por fecha si no hay tiempo.
- **Frontend:** MapLibre con un slider de tiempo, un swipe de antes y después, y un gráfico de retrodispersión media del polígono dibujado.

## 3. MVP
**Sí:**
- 1 tipo de cambio y 3 AOIs (las casuísticas), con 4–8 fechas cada uno.
- Swipe de antes y después y animación temporal.
- Mapa de cambio (log-ratio entre fechas) con umbral ajustable.
- Una explicación visual de por qué el radar "ve" a través de las nubes y de noche, con un clic que compara la imagen óptica nublada con el SAR.

**No:**
- Procesar el interferograma desde cero (usar GUNW listo o descartar deformación).
- Cobertura global.

## 4. Plan de trabajo
| Bloque | Data SAR | Backend | Frontend | Story |
|---|---|---|---|---|
| **Pre** | **Confirmar la disponibilidad de NISAR (o del plan B) para los 3 AOI y descargar muestras** | — | — | Elegir el tipo de cambio |
| H0–H4 | Recortar el AOI 1 | titiler o PNG | Mapa base y swipe | Guion |
| H4–H12 | Pasar a dB, filtrar speckle y log-ratio en el AOI 1 | Endpoint de series | Slider temporal | Explicador del SAR |
| H12–H24 | AOI 2 y 3 | Estadística por polígono | Dibujar polígono → gráfico → **demo mínima** | Casuísticas |
| H24–H36 | Validar con imagen óptica (Sentinel-2/HLS) | Caché | Comparar óptico frente a SAR | Textos |
| H36–H44 | — | Despliegue | Pulido | Video y slides |
| H44–H48 | — | — | — | Entrega |

## 5. Riesgos
- **NISAR sin datos para el AOI:** esto se resuelve antes del evento. Usar plan B (ALOS-2 o Sentinel-1) y presentar NISAR como "listo para conectarse".
- **Speckle y geometría (layover, sombra):** usar productos RTC o GCOV ya corregidos y aplicar un filtro Lee simple.
- **Tamaño:** nunca servir escenas completas, solo recortes en COG.

## 6. Tres casuísticas
### A. Minería ilegal y deforestación en Madre de Dios (La Pampa)
- **Usuario:** fiscalías ambientales, SERNANP y periodistas.
- **Problema:** las nubes casi permanentes de la Amazonía ciegan a los satélites ópticos.
- **Uso:** el SAR detecta la pérdida de bosque y las nuevas pozas mineras mes a mes, con alertas sobre la zona de amortiguamiento de la Reserva Tambopata.
- **Datos:** GCOV en banda L (la banda L penetra el dosel) o Sentinel-1.
- **Demo:** imagen óptica nublada frente al radar nítido, con la nueva poza resaltada en rojo.

### B. Retroceso glaciar y lagunas peligrosas en la Cordillera Blanca
- **Usuario:** ANA, INAIGEM y defensa civil de Huaraz.
- **Problema:** lagunas glaciares como Palcacocha pueden desbordarse (GLOF).
- **Uso:** la serie temporal de retrodispersión distingue hielo, agua y roca y mide el crecimiento de la laguna y el cambio en el frente glaciar.
- **Datos:** SAR más Copernicus DEM.
- **Demo:** animación de la laguna creciendo y gráfico de su área por fecha.

### C. Inundaciones y arroz en la costa norte (Piura y Lambayeque)
- **Usuario:** el Ministerio de Agricultura y aseguradoras agrarias.
- **Problema:** durante el Niño costero llueve y está nublado justo cuando hace falta ver la inundación.
- **Uso:** mapa de áreas inundadas (agua abierta = baja retrodispersión) y del ciclo del arroz (inundación, crecimiento, cosecha), para estimar pérdidas.
- **Datos:** series SAR de enero a abril.
- **Demo:** "Este polígono de 1,200 ha estuvo bajo agua 18 días; el seguro puede calcular la pérdida sin visitar el campo".

## 7. Pitch
"Donde las nubes ciegan a los satélites, el radar sigue bailando. Convertimos los datos de NISAR, que son difíciles de usar, en un antes y después que entiende un fiscal, un alcalde o un agricultor."
