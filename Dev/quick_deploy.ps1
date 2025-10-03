# Quick deployment and testing script for WEBJOBS_NAVIGATOR_PHP (PowerShell)

Write-Host "🚀 WEBJOBS_NAVIGATOR_PHP - Quick Deploy & Test" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "index.php") -or -not (Test-Path "api.php")) {
    Write-Host "❌ Error: Run this script from the WEBJOBS_NAVIGATOR_PHP directory" -ForegroundColor Red
    exit 1
}

# Configuration
$FTP_HOST = "195.179.238.91"
$FTP_USER = "u343523827"
$FTP_PASS = '3s>C]t32ZdSJ!a.'
$FTP_REMOTE = "jobs_navigator"
$VERIFY_URL = "https://www.mateusribeiro.com/jobs_navigator/"

Write-Host "📦 Creating deployment package..." -ForegroundColor Yellow

# Create zip file (excluding dev files)
$exclude = @("test_*.php", "deploy*.sh", "deploy*.ps1", "*.zip", "Dev/*")
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipPath = "deploy_quick.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath }

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')

Get-ChildItem -Recurse | Where-Object { 
    $file = $_
    -not ($exclude | Where-Object { $file.Name -like $_ -or $file.FullName -like "*\$($_)" })
} | ForEach-Object {
    $relativePath = $_.FullName.Substring((Get-Location).Path.Length + 1)
    if ($_.PSIsContainer -eq $false) {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $relativePath) | Out-Null
    }
}

$zip.Dispose()

Write-Host "⬆️  Uploading via FTP..." -ForegroundColor Yellow

# Create FTP script
$ftpScript = @"
open $FTP_HOST
$FTP_USER
$FTP_PASS
cd $FTP_REMOTE
binary
put deploy_quick.zip
quit
"@

$ftpScript | ftp -n

Write-Host "📜 Creating extraction script..." -ForegroundColor Yellow

$extractScript = @'
<?php
$zip = new ZipArchive;
if ($zip->open('deploy_quick.zip') === TRUE) {
    echo "Extracting " . $zip->numFiles . " files...\n";
    $zip->extractTo('./');
    $zip->close();
    unlink('deploy_quick.zip');
    echo "✅ Deployment completed!\n";
} else {
    echo "❌ Failed to extract deployment zip\n";
}
?>
'@

$extractScript | Out-File -FilePath "extract_quick.php" -Encoding UTF8

Write-Host "⬆️  Uploading extraction script..." -ForegroundColor Yellow

$ftpScript2 = @"
open $FTP_HOST
$FTP_USER
$FTP_PASS
cd $FTP_REMOTE
binary
put extract_quick.php
quit
"@

$ftpScript2 | ftp -n

Write-Host "🔧 Executing extraction..." -ForegroundColor Yellow
$extractResponse = Invoke-WebRequest -Uri "$VERIFY_URL/extract_quick.php" -UseBasicParsing
Write-Host $extractResponse.Content

Write-Host "🧹 Cleaning up extraction script..." -ForegroundColor Yellow

$ftpScript3 = @"
open $FTP_HOST
$FTP_USER
$FTP_PASS
cd $FTP_REMOTE
delete extract_quick.php
quit
"@

$ftpScript3 | ftp -n

Write-Host "🧪 Testing deployment..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $VERIFY_URL -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Application is accessible: $VERIFY_URL" -ForegroundColor Green
    } else {
        Write-Host "⚠️  HTTP $($response.StatusCode) - Check for issues" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Connection test failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "🔍 Testing API..." -ForegroundColor Yellow
try {
    $apiResponse = Invoke-WebRequest -Uri "$VERIFY_URL/api.php?action=status" -UseBasicParsing
    if ($apiResponse.Content -like '*"timestamp"*') {
        Write-Host "✅ API is working" -ForegroundColor Green
        Write-Host "📊 Status: $($apiResponse.Content)"
    } else {
        Write-Host "⚠️  API test failed" -ForegroundColor Yellow
        Write-Host "Response: $($apiResponse.Content)"
    }
} catch {
    Write-Host "⚠️  API test failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Clean up local files
Remove-Item -Path "deploy_quick.zip", "extract_quick.php" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "🎉 Deployment completed!" -ForegroundColor Green
Write-Host "🌐 App: $VERIFY_URL" -ForegroundColor Cyan
Write-Host "🔧 API: $VERIFY_URL/api.php?action=status" -ForegroundColor Cyan
Write-Host ""