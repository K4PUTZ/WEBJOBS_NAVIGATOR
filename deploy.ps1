#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Deploy WEBJOBS_NAVIGATOR_PHP to Hostinger via FTP using .NET WebRequest
# Usage: pwsh -File WEBJOBS_NAVIGATOR_PHP/deploy.ps1

$ScriptDir = Split-Path -Parent $PSCommandPath
$Root = Resolve-Path (Join-Path $ScriptDir '..')
$LocalDir = Join-Path $Root 'WEBJOBS_NAVIGATOR_PHP'

$FTP_HOST   = $env:FTP_HOST   ? $env:FTP_HOST   : '195.179.238.91'
$FTP_PORT   = $env:FTP_PORT   ? $env:FTP_PORT   : '21'
$FTP_USER   = $env:FTP_USER   ? $env:FTP_USER   : 'u343523827'
$FTP_PASS   = $env:FTP_PASS   ? $env:FTP_PASS   : '3s>C]t32ZdSJ!a.'
$FTP_REMOTE = $env:FTP_REMOTE ? $env:FTP_REMOTE : 'public_html/jobs_navigator'
$VERIFY_URL = $env:VERIFY_URL ? $env:VERIFY_URL : 'https://www.mateusribeiro.com/jobs_navigator/'

Write-Host "[deploy] host=$FTP_HOST port=$FTP_PORT user=$FTP_USER remote=$FTP_REMOTE"

foreach ($f in @('index.php','.htaccess')) {
  if (-not (Test-Path (Join-Path $LocalDir $f))) {
    throw "Missing file: $LocalDir/$f"
  }
}

function Upload-File($LocalPath, $RemotePath) {
  $uri = "ftp://$FTP_HOST`:$FTP_PORT/$RemotePath"
  $request = [System.Net.FtpWebRequest]::Create($uri)
  $request.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
  $request.Credentials = New-Object System.Net.NetworkCredential($FTP_USER, $FTP_PASS)
  $request.UseBinary = $true
  $request.UsePassive = $true
  $bytes = [System.IO.File]::ReadAllBytes($LocalPath)
  $request.ContentLength = $bytes.Length
  $stream = $request.GetRequestStream()
  $stream.Write($bytes, 0, $bytes.Length)
  $stream.Close()
  $response = $request.GetResponse()
  $response.Close()
}

# Ensure remote dir exists by uploading with full path (most FTP servers create dirs as needed)
$remoteIndex = "$FTP_REMOTE/index.php"
$remoteHt = "$FTP_REMOTE/.htaccess"
Upload-File (Join-Path $LocalDir 'index.php') $remoteIndex
Upload-File (Join-Path $LocalDir '.htaccess')  $remoteHt

Write-Host "[deploy] Upload complete. Verifying..."
try {
  $rc = (Invoke-WebRequest -Uri $VERIFY_URL -UseBasicParsing -Method Head -TimeoutSec 10).StatusCode
  Write-Host "[verify] GET $VERIFY_URL -> HTTP $rc"
} catch {
  Write-Host "[verify] Open $VERIFY_URL in your browser." -ForegroundColor Yellow
}

Write-Host "[done] Deployed to $FTP_REMOTE on $FTP_HOST"

