# Base Sandbox: Build a Junior Astronaut Mission Trainer (práctica)

> **Estado: sandbox de práctica, no es una entrega.** Las FAQ de NASA Space Apps dicen que no se puede empezar a trabajar en los retos antes del hackathon (14–15 nov 2026). Esto es un ejercicio para aprender el modelo físico y el estilo visual antes del evento. Consulten con el Local Lead qué se puede reutilizar.

**Reto:** *Build a Junior Astronaut Mission Trainer*. Un juego o app donde estudiantes manejan una base en la Luna o Marte, equilibrando soporte vital, blindaje contra radiación, energía y producción de comida, para vivir en carne propia las decisiones que hacen fracasar o triunfar una misión. Plan del reto: [`../03-junior-astronaut-mission-trainer.md`](../03-junior-astronaut-mission-trainer.md).

## Cómo se juega

1. **Elige el lugar:**
   - **Luna, ecuador:** noche de 14 días.
   - **Luna, polo sur:** el Sol casi no se pone y hay hielo.
   - **Marte, Jezero:** soles de 24 h 40 min, polvo y CO₂.
2. **Diseña la base** con un **límite de masa** (lo que pueden llevar los módulos de aterrizaje):
   - Tripulación.
   - Paneles solares, baterías y reactores de fisión.
   - Reciclador de agua, electrólisis, ISRU de CO₂ (Marte) y minería de hielo (polo).
   - Invernadero, víveres y blindaje de regolito.
3. **Inicia la misión** y acelera el tiempo (de 1 h/s a 30 días/s). Mira el día y la noche, las tormentas y cómo suben y bajan los recursos.
4. **Sobrevive** los días de la misión. Pierdes si se acaba el oxígeno o el agua, si el hábitat se queda sin energía para calefacción, si pasas 10 días sin comida o si la tripulación llega a **600 mSv**, el límite de carrera de NASA.

### Lecciones (escenarios que fallan por una razón real)

| Lección | Qué pasa | Qué aprende el jugador |
|---|---|---|
| Base Artemis (polo sur) | Configuración equilibrada: completa los 180 días | Cómo se ve una base que funciona |
| La noche lunar | Solo paneles en el ecuador: **se congela durante la primera noche de 14 días** | Por qué la NASA estudia reactores de fisión para la superficie |
| Polvo en Marte | Base solar: **una tormenta de polvo la congela el día 106** | Las tormentas duran semanas; la energía solar sola es frágil |
| Radiación | Sin blindaje en una misión larga: **límite de 600 mSv el día 379** | El regolito protege muy bien de las tormentas solares y menos de los rayos cósmicos |

## El modelo (simplificado, con órdenes de magnitud reales)

| Elemento | Valor usado | Referencia |
|---|---|---|
| Consumo por persona y día | 0.84 kg O₂, 4 kg agua, 1.8 kg comida | Estilo NASA BVAD (Baseline Values and Assumptions) |
| Reciclaje de agua | 98 % | Sistema de agua de la ISS |
| Electrólisis | 1.125 kg de agua y ~6 kWh por kg de O₂ | Estequiometría + eficiencia típica |
| ISRU de CO₂ en Marte | ~25 kWh por kg de O₂ | Versión a escala del experimento MOXIE (Perseverance) |
| Reactor | 10 kWe, 1 800 kg | Clase Kilopower / Fission Surface Power |
| Luz solar | 1 361 W/m² en la Luna; ~590 W/m² en Marte, reducida por el polvo (τ) | Constante solar; atmósfera marciana |
| Polvo en paneles (Marte) | −0.2 % por sol, con limpiezas por viento | Rovers Spirit y Opportunity |
| Dosis en superficie | Luna 1.37 mSv/día; Marte 0.67 mSv/día | Chang'e-4 (LND); Curiosity (RAD) |
| Límite de carrera | 600 mSv | NASA-STD-3001 |

Los eventos (tormentas solares, tormentas de polvo, fallas del reciclador y limpiezas por viento) son aleatorios pero **reproducibles con una semilla**. Los tests automáticos comprueban, entre otras cosas, que la base solar del ecuador lunar se congela en la noche y que con reactor sobrevive.

## Correr

```bash
cd app && npm install && npm run dev
```

Tests:

```bash
cd app && npx vitest run
```

Stack: Vite + TypeScript + Canvas 2D, sin dependencias de runtime. La escena es procedural, sin imágenes.

## Estructura

```
app/src/sim.ts     modelo de masa y energía hora a hora (+ sim.test.ts)
app/src/scene.ts   dibujo procedural de la base: cielo, Sol, terreno, módulos, clima
app/src/main.ts    interfaz: diseño, estado, historial, lecciones, tiempo
```

Mapa completo de la lógica (paso horario, fórmulas, masas, lecciones y pruebas): [`docs/LOGICA.md`](docs/LOGICA.md).
