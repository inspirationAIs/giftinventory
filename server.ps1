param([int]$Port = 8080)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }
$dataPath = Join-Path $scriptDir "data\database.json"

$localIp = "127.0.0.1"
try {
    $ips = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) | Where-Object { 
        $_.AddressFamily -eq 'InterNetwork' -and $_.IPAddressToString -notlike "127.*" -and $_.IPAddressToString -notlike "169.*" 
    }
    if ($ips) { $localIp = $ips[0].IPAddressToString }
} catch {}

function Get-ContentType([string]$path) {
    $ext = [System.IO.Path]::GetExtension($path).ToLower()
    switch ($ext) {
        ".html" { return "text/html; charset=utf-8" }
        ".css"  { return "text/css; charset=utf-8" }
        ".js"   { return "application/javascript; charset=utf-8" }
        ".json" { return "application/json; charset=utf-8" }
        ".png"  { return "image/png" }
        ".jpg"  { return "image/jpeg" }
        ".svg"  { return "image/svg+xml" }
        ".ico"  { return "image/x-icon" }
        default { return "application/octet-stream" }
    }
}

function Send-HttpResponse($stream, [int]$code, [string]$status, [string]$contentType, [byte[]]$bodyBytes) {
    $hdr = "HTTP/1.1 $code $status`r`n" +
           "Content-Type: $contentType`r`n" +
           "Content-Length: $($bodyBytes.Length)`r`n" +
           "Access-Control-Allow-Origin: *`r`n" +
           "Access-Control-Allow-Methods: GET, POST, OPTIONS`r`n" +
           "Access-Control-Allow-Headers: Content-Type`r`n" +
           "Connection: close`r`n`r`n"
    $hdrBytes = [System.Text.Encoding]::UTF8.GetBytes($hdr)
    $stream.Write($hdrBytes, 0, $hdrBytes.Length)
    if ($bodyBytes.Length -gt 0) {
        $stream.Write($bodyBytes, 0, $bodyBytes.Length)
    }
}

$ep = New-Object System.Net.IPEndPoint ([System.Net.IPAddress]::Any, $Port)
$listener = $null
try {
    $listener = New-Object System.Net.Sockets.TcpListener $ep
    $listener.Start()
} catch {
    $Port = 8081
    $ep = New-Object System.Net.IPEndPoint ([System.Net.IPAddress]::Any, $Port)
    $listener = New-Object System.Net.Sockets.TcpListener $ep
    $listener.Start()
}

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  Telecom Sales Promo Inventory Server" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " PC Web:    http://localhost:$Port" -ForegroundColor Yellow
Write-Host " Mobile:    http://$($localIp):$Port" -ForegroundColor Yellow
Write-Host "======================================================" -ForegroundColor Cyan

try {
    Start-Process "http://localhost:$Port"
} catch {}

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)

        try {
            $reqLine = $reader.ReadLine()
            if ([string]::IsNullOrWhiteSpace($reqLine)) { $client.Close(); continue }

            $tokens = $reqLine.Split(" ")
            $method = $tokens[0]
            $rawUrl = if ($tokens.Length -gt 1) { $tokens[1] } else { "/" }

            $contentLen = 0
            while ($true) {
                $line = $reader.ReadLine()
                if ([string]::IsNullOrEmpty($line)) { break }
                if ($line -match "(?i)^Content-Length:\s*(\d+)") {
                    $contentLen = [int]$matches[1]
                }
            }

            $body = ""
            if ($contentLen -gt 0) {
                $buf = New-Object char[] $contentLen
                $read = 0
                while ($read -lt $contentLen) {
                    $c = $reader.Read($buf, $read, $contentLen - $read)
                    if ($c -le 0) { break }
                    $read += $c
                }
                $body = New-Object string ($buf, 0, $read)
            }

            $path = $rawUrl.Split("?")[0]
            if ($path -eq "/") { $path = "/index.html" }

            if ($method -eq "OPTIONS") {
                Send-HttpResponse $stream 200 "OK" "text/plain" (New-Object byte[] 0)
                $client.Close()
                continue
            }

            if ($path -eq "/api/info") {
                $info = @{ status = "ok"; port = $Port; localIp = $localIp; mobileUrl = "http://$($localIp):$Port" } | ConvertTo-Json
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($info)
                Send-HttpResponse $stream 200 "OK" "application/json; charset=utf-8" $bytes
                $client.Close()
                continue
            }

            if ($path -eq "/api/data" -and $method -eq "GET") {
                if (Test-Path -LiteralPath $dataPath) {
                    $bytes = [System.IO.File]::ReadAllBytes($dataPath)
                } else {
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes("{}")
                }
                Send-HttpResponse $stream 200 "OK" "application/json; charset=utf-8" $bytes
                $client.Close()
                continue
            }

            if ($path -eq "/api/data" -and $method -eq "POST") {
                [System.IO.File]::WriteAllText($dataPath, $body, [System.Text.Encoding]::UTF8)
                $okBytes = [System.Text.Encoding]::UTF8.GetBytes('{"status":"ok"}')
                Send-HttpResponse $stream 200 "OK" "application/json; charset=utf-8" $okBytes
                $client.Close()
                continue
            }

            $rel = $path.TrimStart("/").Replace("/", "\")
            $filePath = Join-Path $scriptDir $rel

            if (Test-Path -LiteralPath $filePath -PathType Leaf) {
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $ct = Get-ContentType $filePath
                Send-HttpResponse $stream 200 "OK" $ct $bytes
            } else {
                $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
                Send-HttpResponse $stream 404 "Not Found" "text/plain; charset=utf-8" $msg
            }
        } catch {}
        finally {
            $client.Close()
        }
    }
} finally {
    if ($listener) { $listener.Stop() }
}