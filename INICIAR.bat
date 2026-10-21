@echo off
rem Lanzador portable de los proyectos NASA Space Apps 2026.
rem Todas las rutas son relativas a esta carpeta: funciona aunque el USB tenga otra letra de unidad.
setlocal EnableExtensions
set "RAIZ=%~dp0"

:menu
cls
echo.
echo   NASA Space Apps Challenge 2026 - proyectos de practica
echo   ======================================================
echo.
echo   Abrir la version compilada (no necesita instalar nada en Windows):
echo     1. Dv Mission Control        (Space Mission Design Game)
echo     2. Base lunar y marciana     (Build a Junior Astronaut Mission Trainer)
echo     3. FireCal Global            (Harmonization of MODIS and VIIRS Hot Spots)
echo.
echo   Modo desarrollo (necesita Node.js 20.19 o superior):
echo     4. Dv Mission Control
echo     5. Base lunar y marciana
echo     6. FireCal Global
echo     7. Pruebas automaticas de los tres proyectos
echo.
echo     0. Salir
echo.
set "op="
set /p op="  Opcion: "
if "%op%"=="1" call :compilada "Space-Mission-Design-Game-NASA-CHALLENGE\app" 5180
if "%op%"=="2" call :compilada "Build-a-Junior-Astronaut-Mission-Trainer-NASA-CHALLENGE\app" 5181
if "%op%"=="3" call :compilada "Harmonization-of-MODIS-and-VIIRS-hot-spots-NASA-CHALLENGE\app" 5178
if "%op%"=="4" call :desarrollo "Space-Mission-Design-Game-NASA-CHALLENGE\app" 5180
if "%op%"=="5" call :desarrollo "Build-a-Junior-Astronaut-Mission-Trainer-NASA-CHALLENGE\app" 5181
if "%op%"=="6" call :desarrollo "Harmonization-of-MODIS-and-VIIRS-hot-spots-NASA-CHALLENGE\app" 5178
if "%op%"=="7" call :pruebas
if "%op%"=="0" goto :eof
goto :menu

:compilada
set "APP=%RAIZ%%~1"
if not exist "%APP%\dist\index.html" (
  echo.
  echo   No existe la version compilada en %~1\dist. Usa el modo desarrollo para generarla ^(npm run build^).
  pause
  goto :eof
)
echo.
echo   Abriendo http://localhost:%~2/ ... cierra esta ventana o pulsa Ctrl+C para detener el servidor.
powershell -NoProfile -ExecutionPolicy Bypass -File "%RAIZ%herramientas\servir.ps1" -Carpeta "%APP%\dist" -Puerto %~2
goto :eof

:desarrollo
call :hay_node || goto :eof
set "APP=%RAIZ%%~1"
pushd "%APP%"
if not exist "node_modules" (
  echo   Instalando dependencias por primera vez en esta PC ^(npm ci^)...
  call npm ci || (popd & pause & goto :eof)
)
call npx vite --port %~2 --open
popd
goto :eof

:pruebas
call :hay_node || goto :eof
for %%P in ("Space-Mission-Design-Game-NASA-CHALLENGE\app" "Build-a-Junior-Astronaut-Mission-Trainer-NASA-CHALLENGE\app") do (
  echo.
  echo   === %%~P ===
  pushd "%RAIZ%%%~P"
  if not exist "node_modules" call npm ci
  call npx vitest run
  popd
)
pause
goto :eof

:hay_node
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js no esta instalado en esta PC. Descargalo de https://nodejs.org ^(version LTS^)
  echo   o usa las opciones 1 a 3, que no lo necesitan.
  pause
  exit /b 1
)
exit /b 0
