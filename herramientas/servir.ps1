# Servidor web estatico minimo (solo Windows, sin instalar nada): sirve una carpeta "dist" en localhost.
# Uso: powershell -ExecutionPolicy Bypass -File servir.ps1 -Carpeta <ruta\dist> -Puerto 5180
# Los navegadores no cargan modulos JavaScript desde file://, por eso hace falta un servidor local.
param(
  [Parameter(Mandatory = $true)][string]$Carpeta,
  [int]$Puerto = 5180,
  [switch]$SinNavegador
)

$raiz = (Resolve-Path $Carpeta).Path
$tipos = @{
  ".html" = "text/html; charset=utf-8"; ".js" = "text/javascript; charset=utf-8"; ".mjs" = "text/javascript; charset=utf-8"
  ".css" = "text/css; charset=utf-8"; ".json" = "application/json"; ".geojson" = "application/geo+json"; ".svg" = "image/svg+xml"
  ".png" = "image/png"; ".jpg" = "image/jpeg"; ".jpeg" = "image/jpeg"; ".webp" = "image/webp"; ".ico" = "image/x-icon"
  ".mp4" = "video/mp4"; ".wasm" = "application/wasm"; ".bin" = "application/octet-stream"; ".pbf" = "application/x-protobuf"
  ".csv" = "text/csv; charset=utf-8"; ".txt" = "text/plain; charset=utf-8"; ".woff2" = "font/woff2"; ".glb" = "model/gltf-binary"
}

$http = New-Object System.Net.HttpListener
$http.Prefixes.Add("http://localhost:$Puerto/")
try { $http.Start() } catch { Write-Host "No se pudo abrir el puerto $Puerto (puede estar en uso)." -ForegroundColor Red; exit 1 }
Write-Host "Sirviendo $raiz en http://localhost:$Puerto/  (Ctrl+C para detener)" -ForegroundColor Cyan
if (-not $SinNavegador) { Start-Process "http://localhost:$Puerto/" }

try {
  while ($http.IsListening) {
    $ctx = $http.GetContext()
    $ruta = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart("/"))
    if ($ruta -eq "") { $ruta = "index.html" }
    $archivo = Join-Path $raiz $ruta
    $completo = [IO.Path]::GetFullPath($archivo)
    $res = $ctx.Response
    if (-not $completo.StartsWith($raiz) -or -not (Test-Path $completo -PathType Leaf)) {
      $res.StatusCode = 404
      $bytes = [Text.Encoding]::UTF8.GetBytes("404")
    } else {
      $ext = [IO.Path]::GetExtension($completo).ToLower()
      $res.ContentType = $(if ($tipos.ContainsKey($ext)) { $tipos[$ext] } else { "application/octet-stream" })
      $bytes = [IO.File]::ReadAllBytes($completo)
    }
    $res.ContentLength64 = $bytes.Length
    try { $res.OutputStream.Write($bytes, 0, $bytes.Length) } catch { }
    $res.Close()
  }
} finally { $http.Stop() }
