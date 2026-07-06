$root = Join-Path $PSScriptRoot 'public'
$port = 8080

foreach ($p in 8080..8099) {
  Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    Where-Object { $_ -gt 4 } |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}
Start-Sleep -Seconds 1

function Test-PortFree([int]$p) {
  try {
    $l = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $p)
    $l.Start()
    $l.Stop()
    return $true
  } catch {
    return $false
  }
}

while (-not (Test-PortFree $port) -and $port -lt 8090) {
  Write-Host "Port $port is busy, trying next..."
  $port++
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

$url = "http://localhost:$port/"
Write-Host ""
Write-Host "  Voodoo Staking Portal is running"
Write-Host "  Open EXACTLY this URL: $url"
if ($port -ne 8080) {
  Write-Host "  WARNING: Port 8080 was busy. Do NOT use http://localhost:8080/"
}
Write-Host ""
Write-Host "  Keep this window open while using the dapp."
Write-Host "  Press Ctrl+C to stop."
Write-Host ""

Start-Process $url

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $path = [Uri]::UnescapeDataString($context.Request.Url.LocalPath).TrimStart('/')

  $context.Response.Headers.Add('Access-Control-Allow-Origin', '*')
  $context.Response.Headers.Add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  $context.Response.Headers.Add('Access-Control-Allow-Headers', 'Content-Type')

  if ($context.Request.HttpMethod -eq 'OPTIONS') {
    $context.Response.StatusCode = 204
    $context.Response.Close()
    continue
  }

  if ($path -eq 'rpc' -and $context.Request.HttpMethod -eq 'POST') {
    try {
      $reader = New-Object System.IO.StreamReader($context.Request.InputStream, $context.Request.ContentEncoding)
      $body = $reader.ReadToEnd()
      $rpcResponse = Invoke-RestMethod -Uri 'https://rpc.pulsechain.com' -Method POST -ContentType 'application/json' -Body $body
      $json = $rpcResponse | ConvertTo-Json -Compress -Depth 12
      $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
      $context.Response.StatusCode = 200
      $context.Response.ContentType = 'application/json; charset=utf-8'
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
      $err = @{ jsonrpc = '2.0'; id = $null; error = @{ code = -32000; message = $_.Exception.Message } } | ConvertTo-Json -Compress
      $bytes = [System.Text.Encoding]::UTF8.GetBytes($err)
      $context.Response.StatusCode = 500
      $context.Response.ContentType = 'application/json; charset=utf-8'
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    $context.Response.Close()
    continue
  }

  if ([string]::IsNullOrWhiteSpace($path)) { $path = 'index.html' }

  $file = [IO.Path]::GetFullPath((Join-Path $root ($path -replace '/', [IO.Path]::DirectorySeparatorChar)))
  $rootFull = [IO.Path]::GetFullPath($root)

  if (-not $file.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
    $context.Response.StatusCode = 403
    $context.Response.Close()
    continue
  }

  if (Test-Path $file -PathType Leaf) {
    $bytes = [IO.File]::ReadAllBytes($file)
    $ext = [IO.Path]::GetExtension($file).ToLowerInvariant()
    $contentType = switch ($ext) {
      '.html' { 'text/html; charset=utf-8' }
      '.webp' { 'image/webp' }
      '.png' { 'image/png' }
      '.jpg' { 'image/jpeg' }
      '.jpeg' { 'image/jpeg' }
      '.js' { 'application/javascript; charset=utf-8' }
      '.css' { 'text/css; charset=utf-8' }
      '.json' { 'application/json; charset=utf-8' }
      default { 'application/octet-stream' }
    }
    $context.Response.ContentType = $contentType
    $context.Response.Headers.Add('Cache-Control', 'no-store, no-cache, must-revalidate')
    $context.Response.Headers.Add('Pragma', 'no-cache')
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $context.Response.StatusCode = 404
  }

  $context.Response.Close()
}