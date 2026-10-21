#!/usr/bin/env sh
# Lanzador para macOS / Linux. Uso: sh iniciar.sh [mision|base|firecal] [dev]
# Sin "dev" sirve la version compilada (dist/) con Python 3; con "dev" arranca Vite (Node.js >= 20.19).
# node_modules trae binarios de Windows: en macOS/Linux puede hacer falta "npm ci" (luego, de vuelta en Windows, otra vez npm ci).
set -e
RAIZ="$(cd "$(dirname "$0")" && pwd)"
case "${1:-mision}" in
  mision)  APP="$RAIZ/Space-Mission-Design-Game-NASA-CHALLENGE/app"; PUERTO=5180 ;;
  base)    APP="$RAIZ/Build-a-Junior-Astronaut-Mission-Trainer-NASA-CHALLENGE/app"; PUERTO=5181 ;;
  firecal) APP="$RAIZ/Harmonization-of-MODIS-and-VIIRS-hot-spots-NASA-CHALLENGE/app"; PUERTO=5178 ;;
  *) echo "Proyecto desconocido: $1 (mision | base | firecal)"; exit 1 ;;
esac
if [ "${2:-}" = "dev" ]; then
  cd "$APP"
  [ -d node_modules ] || npm ci
  npx vite --port "$PUERTO" --open || echo "Si falla por binarios de otra plataforma, ejecuta: cd \"$APP\" && npm ci"
else
  echo "Sirviendo $APP/dist en http://localhost:$PUERTO/"
  python3 -m http.server "$PUERTO" --directory "$APP/dist"
fi
