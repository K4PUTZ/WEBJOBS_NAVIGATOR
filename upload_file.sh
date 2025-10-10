#!/bin/bash
# Quick single file upload script
# Usage: ./upload_file.sh filename.php
# Example: ./upload_file.sh api.php

if [ $# -eq 0 ]; then
    echo "Usage: $0 <filename>"
    echo "Example: $0 api.php"
    exit 1
fi

FILE="$1"
if [ ! -f "$FILE" ]; then
    echo "Error: File '$FILE' not found"
    exit 1
fi

# FTP credentials (set via env)
: "${FTP_HOST:?Set FTP_HOST}"
: "${FTP_USER:?Set FTP_USER}"
: "${FTP_PASS:?Set FTP_PASS}"
: "${FTP_REMOTE:=jobs_navigator}"

echo "🚀 Uploading $FILE to server..."

# Upload single file using lftp
lftp -p 21 -u "$FTP_USER,$FTP_PASS" "$FTP_HOST" <<EOF
set ftp:ssl-allow false
set ftp:passive-mode on
cd $FTP_REMOTE
put '$FILE'
bye
EOF

if [ $? -eq 0 ]; then
    echo "✅ Successfully uploaded $FILE"
    echo "🌐 Available at: https://www.mateusribeiro.com/jobs_navigator/$FILE"
else
    echo "❌ Upload failed"
    exit 1
fi
