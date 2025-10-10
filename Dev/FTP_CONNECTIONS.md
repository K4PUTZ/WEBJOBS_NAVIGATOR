# FTP Connections (Local Reference)

This file exists only to speed up local work. It includes the real FTP details you provided so the next AI can deploy quickly. Do not commit or share outside your machine.

## Quick Env Exports (copy/paste)

export FTP_HOST=195.179.238.91
export FTP_PORT=21
export FTP_USER='u343523827'
export FTP_PASS='3s>C]t32ZdSJ!a.'
export FTP_REMOTE='public_html/jobs_navigator'
export FTP_REMOTE_ALT='jobs_navigator'

Notes
- Hostinger only supports plain FTP for this account (not FTPS/SFTP). Use `set ftp:ssl-allow false` in lftp.
- For lftp, the username format is `user,password` (comma in between): `u343523827,3s>C]t32ZdSJ!a.`

## Single File Upload (curl)

curl --ftp-method nocwd --ftp-create-dirs \
  -T WEBJOBS_NAVIGATOR_PHP/index.php \
  "ftp://$FTP_USER:$FTP_PASS@$FTP_HOST/$FTP_REMOTE/index.php"

If your account is chrooted to `public_html/`, try:

curl --ftp-method nocwd --ftp-create-dirs \
  -T WEBJOBS_NAVIGATOR_PHP/index.php \
  "ftp://$FTP_USER:$FTP_PASS@$FTP_HOST/$FTP_REMOTE_ALT/index.php"

## lftp (interactive)

lftp -p "$FTP_PORT" -u "$FTP_USER,$FTP_PASS" "$FTP_HOST"
> set ftp:ssl-allow false
> set ftp:passive-mode on
> cd $FTP_REMOTE
> put index.php
> bye

Or mirror the whole folder:

lftp -p "$FTP_PORT" -u "$FTP_USER,$FTP_PASS" "$FTP_HOST" <<EOF
set ftp:ssl-allow false
set ftp:passive-mode on
mirror -R --verbose=0 WEBJOBS_NAVIGATOR_PHP $FTP_REMOTE
bye
EOF

## Project Helper Scripts (env‑based)

- One file: `bash WEBJOBS_NAVIGATOR_PHP/upload_file.sh WEBJOBS_NAVIGATOR_PHP/api.php`
- Mirror: `bash WEBJOBS_NAVIGATOR_PHP/deploy.sh`
- ZIP method (fallback/first‑time): `bash WEBJOBS_NAVIGATOR_PHP/deploy_zip.sh`

Make sure you exported the env vars first (see top of this file).

## Verify

curl -I "https://www.mateusribeiro.com/jobs_navigator/index.php"
curl -s "https://www.mateusribeiro.com/jobs_navigator/api.php?action=status"

If index uses caching, append `?nocache=$(date +%s)`.

