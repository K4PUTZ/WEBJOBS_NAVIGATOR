#!/usr/bin/env bash
# Quick deployment and testing script for WEBJOBS_NAVIGATOR_PHP

set -euo pipefail

echo "🚀 WEBJOBS_NAVIGATOR_PHP - Quick Deploy & Test"
echo "============================================="

# Check if we're in the right directory
if [[ ! -f "index.php" || ! -f "api.php" ]]; then
    echo "❌ Error: Run this script from the WEBJOBS_NAVIGATOR_PHP directory"
    exit 1
fi

# FTP credentials (set via env)
: "${FTP_HOST:?Set FTP_HOST}"
: "${FTP_USER:?Set FTP_USER}"
: "${FTP_PASS:?Set FTP_PASS}"
: "${FTP_REMOTE:=jobs_navigator}"
VERIFY_URL="https://www.mateusribeiro.com/jobs_navigator/"

echo "📦 Creating deployment package..."
zip -r deploy_quick.zip . -x "test_*.php" "deploy*.sh" "deploy*.ps1" "*.zip" "Dev/*" > /dev/null 2>&1

echo "⬆️  Uploading via FTP..."
lftp -p 21 -u "$FTP_USER,$FTP_PASS" "$FTP_HOST" <<EOF
set ftp:ssl-allow false
set ftp:passive-mode on
cd $FTP_REMOTE
put deploy_quick.zip
bye
EOF

echo "📜 Creating extraction script..."
cat > extract_quick.php << 'EXTRACT_PHP'
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
EXTRACT_PHP

echo "⬆️  Uploading extraction script..."
lftp -p 21 -u "$FTP_USER,$FTP_PASS" "$FTP_HOST" <<EOF
set ftp:ssl-allow false
set ftp:passive-mode on
cd $FTP_REMOTE
put extract_quick.php
bye
EOF

echo "🔧 Executing extraction..."
curl -s "$VERIFY_URL/extract_quick.php"

echo "🧹 Cleaning up extraction script..."
lftp -p 21 -u "$FTP_USER,$FTP_PASS" "$FTP_HOST" <<EOF
set ftp:ssl-allow false
set ftp:passive-mode on
cd $FTP_REMOTE
rm extract_quick.php
bye
EOF

echo "🧪 Testing deployment..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$VERIFY_URL")
if [[ "$HTTP_CODE" == "200" ]]; then
    echo "✅ Application is accessible: $VERIFY_URL"
else
    echo "⚠️  HTTP $HTTP_CODE - Check for issues"
fi

echo "🔍 Testing API..."
API_RESPONSE=$(curl -s "$VERIFY_URL/api.php?action=status")
if echo "$API_RESPONSE" | grep -q '"timestamp"'; then
    echo "✅ API is working"
    echo "📊 Status: $API_RESPONSE"
else
    echo "⚠️  API test failed"
    echo "Response: $API_RESPONSE"
fi

# Clean up local files
rm -f deploy_quick.zip extract_quick.php

echo ""
echo "🎉 Deployment completed!"
echo "🌐 App: $VERIFY_URL"
echo "🔧 API: $VERIFY_URL/api.php?action=status"
echo ""
