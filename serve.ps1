# Dependency-free static file server (Windows PowerShell 5.1, no Python/Node required).
# Serves the folder this script lives in. Usage: powershell -File serve.ps1 -Port 5190
param([int]$Port = 5190)

$ErrorActionPreference = "Stop"
$root   = $PSScriptRoot
$prefix = "http://localhost:$Port/"

$mime = @{
  ".html" = "text/html; charset=utf-8";  ".htm" = "text/html; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".mjs"  = "text/javascript; charset=utf-8"
  ".css"  = "text/css; charset=utf-8";   ".json" = "application/json; charset=utf-8"
  ".webmanifest" = "application/manifest+json; charset=utf-8"
  ".txt"  = "text/plain; charset=utf-8"
  ".png"  = "image/png";  ".jpg" = "image/jpeg"; ".jpeg" = "image/jpeg"
  ".svg"  = "image/svg+xml"; ".ico" = "image/x-icon"; ".woff2" = "font/woff2"
  ".pdf"  = "application/pdf"; ".docx" = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "ERROR: could not bind $prefix - $($_.Exception.Message)"
  exit 1
}
Write-Host "Static server listening on $prefix (root: $root)"

while ($listener.IsListening) {
  try {
    $context = $listener.GetContext()
    $req = $context.Request
    $res = $context.Response

    $rel = [Uri]::UnescapeDataString($req.Url.LocalPath).TrimStart("/")
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }

    $filePath = Join-Path $root $rel
    if (Test-Path $filePath -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
      $ct  = $mime[$ext]; if (-not $ct) { $ct = "application/octet-stream" }
      $res.ContentType = $ct
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $rel")
      $res.OutputStream.Write($msg, 0, $msg.Length)
    }
    $res.OutputStream.Close()
  } catch {
    # Keep serving even if one request fails
  }
}
