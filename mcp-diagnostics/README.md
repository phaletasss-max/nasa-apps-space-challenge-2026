# MCP Diagnostics — NASA Space Apps 2026

Servidor MCP (Model Context Protocol) para diagnosticar el estado de los proyectos del NASA Space Apps Challenge 2026 desde Antigravity u otro cliente MCP compatible.

## Instalación

```bash
cd mcp-diagnostics
npm install
```

## Uso

```bash
npm start
```

El servidor usa transporte **stdio** y es compatible con la configuración MCP de Antigravity.

## Herramientas disponibles

| Tool | Parámetros | Descripción |
|---|---|---|
| `list_projects` | — | Lista los 3 proyectos con estado de salud resumido (🟢/🟡) |
| `diagnose_project` | `project` | Diagnóstico completo: README, node_modules, .venv, CI, docs, dist |
| `git_status` | — | Branch, remote, últimos 10 commits, archivos modificados |
| `check_deps` | `project` | Verifica npm (package.json, lock, node_modules) y pip (requirements.txt, .venv) |
| `run_tests` | `project` | Corre el test suite y devuelve la salida (solo lectura) |

**Valores válidos para `project`:** `firecal` · `mission-game` · `astronaut-trainer`

## Configurar en Antigravity (`.gemini/settings.json`)

```json
{
  "mcpServers": {
    "nasa-diagnostics": {
      "command": "node",
      "args": ["D:/nasa-space-apps-2026/mcp-diagnostics/index.js"]
    }
  }
}
```

## Ejemplos de uso en Antigravity

> "Diagnostica el proyecto firecal"  
> "¿Cuál es el estado del repo?"  
> "Corre los tests de mission-game"  
> "Lista todos los proyectos y su estado"
