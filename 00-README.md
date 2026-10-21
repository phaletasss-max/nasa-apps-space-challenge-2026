# NASA Space Apps Challenge 2026

Repositorio oficial del equipo para el **[NASA Space Apps Challenge 2026](https://www.spaceappschallenge.org/)** (14–15 noviembre 2026).

## Proyectos

| Proyecto | Carpeta | Puerto (dev) | Estado |
|---|---|:---:|---|
| **FireCal Global** — Armonización MODIS + VIIRS | [`Harmonization-of-MODIS-and-VIIRS-hot-spots-NASA-CHALLENGE/`](Harmonization-of-MODIS-and-VIIRS-hot-spots-NASA-CHALLENGE/) | 5178 | ✅ App · pipeline · tests · docs · video |
| **Δv Mission Control** — Space Mission Design Game | [`Space-Mission-Design-Game-NASA-CHALLENGE/`](Space-Mission-Design-Game-NASA-CHALLENGE/) | 5180 | ✅ Campaña completa (práctica) |
| **Junior Astronaut Mission Trainer** | [`Build-a-Junior-Astronaut-Mission-Trainer-NASA-CHALLENGE/`](Build-a-Junior-Astronaut-Mission-Trainer-NASA-CHALLENGE/) | 5181 | ✅ Base lunar y marciana (práctica) |

> **Nota sobre las reglas:** Las FAQ de NASA Space Apps indican que no se puede empezar a trabajar en los retos antes del hackathon. Los proyectos "práctica" de este repo son ejercicios de aprendizaje y preparación. Consultar con el Local Lead qué partes se pueden reutilizar.

## Inicio rápido

### Windows

```bat
INICIAR.bat
```

Opciones del menú:
- **1–3** → Sirve la versión compilada de cada proyecto (sin Node, usa PowerShell).  
- **4–6** → Modo desarrollo con Vite (requiere Node ≥ 20).  
- **7** → Corre las pruebas automáticas.

### macOS / Linux

```bash
sh iniciar.sh mision        # Δv Mission Control (compilado)
sh iniciar.sh mision dev    # modo desarrollo
sh iniciar.sh firecal
sh iniciar.sh base
```

## Estructura

```
nasa-space-apps-2026/
├── Harmonization-of-MODIS-and-VIIRS-hot-spots-NASA-CHALLENGE/
│   ├── app/          React + MapLibre + deck.gl + ECharts
│   ├── pipeline/     Python: descarga, armonización, validación, NRT
│   ├── tests/        pytest (ciencia y formato de tiles)
│   ├── docs/         documentación en español (7 capítulos)
│   ├── archive/      v1 Perú
│   └── media/        video, capturas, escena Blender
├── Space-Mission-Design-Game-NASA-CHALLENGE/
│   ├── app/src/      physics/ · game/ · scenes/ · app/ (React)
│   └── docs/         LOGICA.md
├── Build-a-Junior-Astronaut-Mission-Trainer-NASA-CHALLENGE/
│   ├── app/src/      sim.ts · scene.ts · main.ts
│   └── docs/         LOGICA.md
├── mcp-diagnostics/  🔧 MCP server para diagnosticar los proyectos
├── herramientas/     servir.ps1 (servidor estático PowerShell)
├── 00-README.md      planes de trabajo de los 14 retos
├── INICIAR.bat
└── iniciar.sh
```

## MCP de diagnóstico

El directorio [`mcp-diagnostics/`](mcp-diagnostics/) contiene un servidor MCP (Model Context Protocol) para diagnosticar el estado de los proyectos desde Antigravity u otro cliente MCP compatible.

```bash
cd mcp-diagnostics && npm install && npm start
```

**Herramientas disponibles:**

| Tool | Descripción |
|---|---|
| `list_projects` | Lista los 3 proyectos con estado de salud resumido |
| `diagnose_project` | Diagnóstico completo de un proyecto (deps, CI, docs, etc.) |
| `git_status` | Estado git + últimos commits + remoto |
| `check_deps` | Verifica dependencias npm y pip |
| `run_tests` | Corre el test suite (solo lectura) |

## Equipo

- **GitHub:** [phaletasss-max](https://github.com/phaletasss-max)
- **Repo:** [nasa-apps-space-challenge-2026](https://github.com/phaletasss-max/nasa-apps-space-challenge-2026)

## Licencia

Código: MIT. Los datos mantienen sus licencias originales (ver README de cada proyecto).
