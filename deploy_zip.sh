#!/usr/bin/env bash
set -euo pipefail

# Fast ZIP-based deployment for WEBJOBS_NAVIGATOR_PHP
# This creates a zip file and uploads it, then extracts remotely

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DIR="$ROOT_DIR/WEBJOBS_NAVIGATOR_PHP"

# ------------------ Config ------------------
: "${FTP_HOST:=195.179.238.91}"
: "${FTP_PORT:=21}"
: "${FTP_USER:=u343523827}"
: "${FTP_PASS:=3s>C]t32ZdSJ!a.}"
: "${FTP_REMOTE:=public_html/jobs_navigator}"
: "${VERIFY_URL:=https://www.mateusribeiro.com/jobs_navigator/}"

echo "[zip-deploy] Creating deployment package..."

# Create temporary zip file
ZIP_FILE="/tmp/jobs_navigator_$(date +%s).zip"
cd "$LOCAL_DIR"

# Create zip with all necessary files (exclude .git, tests, etc.)
zip -r "$ZIP_FILE" \
    index.php \
    .htaccess \
    config.php \
    auth.php \
    callback.php \
    logout.php \
    api.php \
    composer.json \
    credentials.json \
    assets/ \
    vendor/ \
    -x "*.DS_Store" "*.git*" "*.vscode*" "*.idea*" "tests/*" "*.log"

echo "[zip-deploy] Package created: $(du -h "$ZIP_FILE" | cut -f1)"

# Upload zip file
echo "[zip-deploy] Uploading package..."
if command -v curl >/dev/null 2>&1; then
    curl --ftp-method nocwd --ftp-create-dirs --fail \
         --user "$FTP_USER:$FTP_PASS" \
         -T "$ZIP_FILE" \
         "ftp://$FTP_HOST:$FTP_PORT/$FTP_REMOTE/deploy.zip"
else
    echo "[error] curl not found" >&2
    exit 1
fi

# Create extraction script
EXTRACT_SCRIPT="/tmp/extract.php"
cat > "$EXTRACT_SCRIPT" << 'EXTRACT_PHP'
<?php
// Simple extraction script
$zip = new ZipArchive;
if ($zip->open('deploy.zip') === TRUE) {
    $zip->extractTo('./');
    $zip->close();
    echo "Extraction completed successfully\n";
    unlink('deploy.zip'); // Clean up
    echo "Deployment zip removed\n";
} else {
    echo "Failed to open deployment zip\n";
    exit(1);
}
?>
EXTRACT_PHP

# Upload extraction script
echo "[zip-deploy] Uploading extraction script..."
curl --ftp-method nocwd --ftp-create-dirs --fail \
     --user "$FTP_USER:$FTP_PASS" \
     -T "$EXTRACT_SCRIPT" \
     "ftp://$FTP_HOST:$FTP_PORT/$FTP_REMOTE/extract.php"

# Execute extraction remotely
echo "[zip-deploy] Extracting files on server..."
curl -s "$VERIFY_URL/extract.php"

# Clean up local files
rm -f "$ZIP_FILE" "$EXTRACT_SCRIPT"

echo "[zip-deploy] Deployment completed! Testing..."

# Verify deployment
if command -v curl >/dev/null 2>&1; then
    set +e
    http_rc=$(curl -s -o /dev/null -w "%{http_code}" "$VERIFY_URL")
    set -e
    echo "[verify] GET $VERIFY_URL -> HTTP $http_rc"
    
    if [ "$http_rc" = "200" ]; then
        echo "✅ [success] Deployment successful!"
        echo "🌐 Visit: $VERIFY_URL"
    else
        echo "⚠️ [warning] HTTP $http_rc - check for issues"
    fi
else
    echo "[verify] Open $VERIFY_URL in your browser."
fi

echo "[done] Fast deployment completed in seconds!"