# 05 · Create Health Monitoring Software for Astronauts

> **Reto:** software que recoge indicadores de salud y permite al astronauta evaluar su estado y actuar ante cambios (radiación, aislamiento, gravedad alterada, pérdida ósea, eventos cardiovasculares, salud conductual).

| Dificultad | Viabilidad 48 h | Perfil | Riesgo principal |
|---|---|---|---|
| Intermedio | 🟡 Media | Full-stack, UX y algo de fisiología | No hay datos reales de astronautas: todo es simulado, y la "validez" depende de citar bien los umbrales |

> ⚠️ Es un prototipo educativo y de investigación, no un dispositivo médico. Hay que decirlo en la app y en el pitch.

## 1. Datos y fuentes
- **NASA Human Research Program (HRP):** la lista de riesgos de salud (Human System Risk Board), que estructura los módulos de la app.
- **NASA OSDR / GeneLab** (osdr.nasa.gov): datos de experimentos biológicos en vuelo, como contexto y referencia.
- **NASA Twins Study:** cambios documentados (cognición, presión ocular, microbioma).
- **Referencias clínicas:** pérdida ósea de ≈1–1.5 % de densidad mineral ósea al mes en huesos de carga, dosis de radiación según ubicación (ISS, superficie de Marte) y escalas validadas de sueño y estado de ánimo.
- **Wearables:** datos simulados, o reales de un reloj del equipo (exportación de Apple Health o Google Fit) para la demo.

## 2. Stack recomendado
- **Frontend:** React como PWA **local-first** (IndexedDB con Dexie), porque una nave no tiene nube estable. Recharts para las tendencias.
- **Motor de reglas:** umbrales personalizados por tripulante (línea base de 14 días con z-score) y semáforo por sistema.
- **Opcional:** un LLM local o vía API que redacta el resumen diario y la recomendación, siempre citando la regla que se disparó.
- **Simulador:** un script que genera 180 días de datos con eventos inyectados (insomnio, una tormenta solar, una caída de SpO₂).

## 3. MVP
**Sí:**
- Check-in diario de 60 segundos: sueño, ánimo, dolor y síntomas.
- Datos de sensores: FC, VFC, SpO₂, presión arterial y dosis de radiación acumulada.
- Panel por sistema (cardio, óseo-muscular, radiación, conducta, sueño) en semáforo, con tendencia frente a la línea base propia.
- Alertas que se pueden accionar: "VFC baja 3 días seguidos → revisa el sueño; protocolo X".
- Registro de ejercicio (ARED, cinta) vinculado al riesgo óseo.
- Exportar un reporte para el cirujano de vuelo, preparado para enviarse con retraso de comunicación.

**No:**
- Diagnóstico.
- Integración real con hardware médico.
- Cuentas multiusuario complejas (basta con 4 tripulantes fijos).

## 4. Plan de trabajo
| Bloque | Data / Simulación | Frontend | Lógica | Story |
|---|---|---|---|---|
| H0–H4 | Definir indicadores y umbrales con su fuente | Repo, PWA y deploy | Esquema de datos | Personas (tripulantes) |
| H4–H12 | Simulador de 180 días | Check-in y panel | Línea base y z-scores | Textos de alertas |
| H12–H24 | Inyectar eventos | Gráficos de tendencia → **demo mínima** | Reglas y semáforo | Guion |
| H24–H36 | Variantes de las casuísticas | Alertas y reporte | Resumen LLM (opcional) | Casuísticas |
| H36–H44 | — | Pulido y modo offline | Tests de reglas | Video y slides |
| H44–H48 | — | — | — | Entrega |

## 5. Riesgos
- **Credibilidad médica:** cada umbral se muestra con su fuente. Nada de "la IA diagnostica".
- **Privacidad:** los datos se quedan en el dispositivo y se mencionan los principios de HIPAA y de la Ley 29733 de Perú.
- **Demasiados indicadores:** limitarse a 5 sistemas.

## 6. Tres casuísticas
### A. Tripulación de larga duración (ISS, Gateway o tránsito a Marte)
- **Usuario:** astronauta y cirujano de vuelo con 20 minutos de retraso de comunicación.
- **Problema:** el astronauta tiene que autoevaluarse sin consulta inmediata.
- **Uso:** una tormenta solar sube la dosis, la app recomienda ir al refugio y registra la dosis evitada. Tres noches de mal sueño disparan el protocolo conductual.
- **Datos:** simulados con los parámetros de HRP y RAD.
- **Demo:** línea de tiempo de 6 meses con 3 eventos y la acción tomada en cada uno.

### B. Base antártica (Estación Científica Antártica Machu Picchu, Perú)
- **Usuario:** personal científico y militar de la campaña antártica peruana.
- **Problema:** aislamiento, luz de 24 h y ritmo circadiano alterado, con un médico para todo el grupo. Es un análogo clásico de misión espacial.
- **Uso:** check-in diario de toda la dotación y un panel grupal para el médico (quién se desvía de su línea base).
- **Datos:** el mismo motor, con constantes de la Antártida en lugar de las espaciales.
- **Demo:** el médico ve que 3 de 12 personas tienen el sueño alterado en la semana 3.

### C. Minería a gran altura (Cerro de Pasco, más de 4,300 m)
- **Usuario:** trabajadores en turnos de 14×7 y el área de salud ocupacional.
- **Problema:** hipoxia, mal de montaña crónico (enfermedad de Monge, descrita por el peruano Carlos Monge), fatiga y aislamiento en campamento.
- **Uso:** el mismo check-in, más un oxímetro. Alertas de SpO₂ y de policitemia frente a la línea base al bajar y volver a subir.
- **Datos:** umbrales clínicos de altura y wearables.
- **Demo:** "Lo que NASA aprendió para Marte protege hoy a un minero en Pasco".

## 7. Pitch
"En Marte el médico está a 20 minutos de distancia. Diseñamos una app que convierte al astronauta en su propio primer médico, y que funciona igual en la Antártida o en una mina a 4,300 m."
