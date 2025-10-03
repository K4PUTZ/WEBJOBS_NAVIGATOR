#!/usr/bin/env bash
set -euo pipefail

# Deploy WEBJOBS_NAVIGATOR_PHP to Hostinger via FTP/FTPS
# - Defaults use your provided credentials; override by exporting env vars
# - Usage: bash WEBJOBS_NAVIGATOR_PHP/deploy.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DIR="$ROOT_DIR/WEBJOBS_NAVIGATOR_PHP"

# ------------------ Config (override via env) ------------------
: "${FTP_HOST:=195.179.238.91}"
: "${FTP_PORT:=21}"
: "${FTP_USER:=u343523827}"
: "${FTP_PASS:=3s>C]t32ZdSJ!a.}"
: "${FTP_REMOTE:=public_html/jobs_navigator}"
: "${VERIFY_URL:=https://www.mateusribeiro.com/jobs_navigator/}"

echo "[deploy] host=$FTP_HOST port=$FTP_PORT user=$FTP_USER remote=$FTP_REMOTE"

for f in index.php .htaccess config.php auth.php callback.php logout.php api.php assets/style.css assets/app.js; do
  if [[ ! -f "$LOCAL_DIR/$f" ]]; then
    echo "[error] Missing $LOCAL_DIR/$f" >&2
    exit 1
  fi
done

# ------------------ Prefer lftp (FTPS), else curl (FTP) ------------------
if command -v lftp >/dev/null 2>&1; then
  echo "[deploy] Using lftp (attempt FTPS, fallback to FTP)"
  # First try FTPS (mirror keeps directory structure)
  set +e
  lftp -p "$FTP_PORT" -u "$FTP_USER","$FTP_PASS" "$FTP_HOST" <<LFTP_CMDS
set ftp:ssl-allow true
set ftp:ssl-force true
set ftp:passive-mode on
mkdir -p $FTP_REMOTE
mirror -R --verbose=0 "$LOCAL_DIR" "$FTP_REMOTE"
bye
LFTP_CMDS
  rc=$?
  set -e
  if [[ $rc -ne 0 ]]; then
    echo "[warn] FTPS failed (code $rc). Trying plain FTP..."
    lftp -p "$FTP_PORT" -u "$FTP_USER","$FTP_PASS" "$FTP_HOST" <<LFTP_CMDS
set ftp:ssl-allow false
set ftp:passive-mode on
mkdir -p $FTP_REMOTE
mirror -R --verbose=0 "$LOCAL_DIR" "$FTP_REMOTE"
bye
LFTP_CMDS
  fi
elif command -v curl >/dev/null 2>&1; then
  echo "[deploy] Using curl (FTP)"
  curl_upload() {
    local remote="$1"; local rc=0
    # Core files
    curl --ftp-method nocwd --ftp-create-dirs --fail --user "$FTP_USER:$FTP_PASS" -T "$LOCAL_DIR/index.php" "ftp://$FTP_HOST:$FTP_PORT/$remote/index.php" || rc=$?
    if [[ $rc -ne 0 ]]; then return $rc; fi
    curl --ftp-method nocwd --ftp-create-dirs --fail --user "$FTP_USER:$FTP_PASS" -T "$LOCAL_DIR/.htaccess"  "ftp://$FTP_HOST:$FTP_PORT/$remote/.htaccess" || rc=$?
    if [[ $rc -ne 0 ]]; then return $rc; fi
    curl --ftp-method nocwd --ftp-create-dirs --fail --user "$FTP_USER:$FTP_PASS" -T "$LOCAL_DIR/config.php" "ftp://$FTP_HOST:$FTP_PORT/$remote/config.php" || rc=$?
    if [[ $rc -ne 0 ]]; then return $rc; fi
    curl --ftp-method nocwd --ftp-create-dirs --fail --user "$FTP_USER:$FTP_PASS" -T "$LOCAL_DIR/auth.php" "ftp://$FTP_HOST:$FTP_PORT/$remote/auth.php" || rc=$?
    if [[ $rc -ne 0 ]]; then return $rc; fi
    curl --ftp-method nocwd --ftp-create-dirs --fail --user "$FTP_USER:$FTP_PASS" -T "$LOCAL_DIR/callback.php" "ftp://$FTP_HOST:$FTP_PORT/$remote/callback.php" || rc=$?
    if [[ $rc -ne 0 ]]; then return $rc; fi
    curl --ftp-method nocwd --ftp-create-dirs --fail --user "$FTP_USER:$FTP_PASS" -T "$LOCAL_DIR/logout.php" "ftp://$FTP_HOST:$FTP_PORT/$remote/logout.php" || rc=$?
    if [[ $rc -ne 0 ]]; then return $rc; fi
    curl --ftp-method nocwd --ftp-create-dirs --fail --user "$FTP_USER:$FTP_PASS" -T "$LOCAL_DIR/api.php" "ftp://$FTP_HOST:$FTP_PORT/$remote/api.php" || rc=$?
    if [[ $rc -ne 0 ]]; then return $rc; fi
    # Assets
    curl --ftp-method nocwd --ftp-create-dirs --fail --user "$FTP_USER:$FTP_PASS" -T "$LOCAL_DIR/assets/style.css" "ftp://$FTP_HOST:$FTP_PORT/$remote/assets/style.css" || rc=$?
    if [[ $rc -ne 0 ]]; then return $rc; fi
    curl --ftp-method nocwd --ftp-create-dirs --fail --user "$FTP_USER:$FTP_PASS" -T "$LOCAL_DIR/assets/app.js"    "ftp://$FTP_HOST:$FTP_PORT/$remote/assets/app.js"    || rc=$?
    return $rc
  }
  set +e
  curl_upload "$FTP_REMOTE"
  rc=$?
  if [[ $rc -ne 0 ]]; then
    # Hostinger often chroots the FTP user to public_html; try without the prefix
    alt_remote="${FTP_REMOTE#public_html/}"
    if [[ "$alt_remote" != "$FTP_REMOTE" ]]; then
      echo "[deploy] First path failed (code $rc). Retrying at '$alt_remote'..."
      curl_upload "$alt_remote"
      rc=$?
    fi
  fi
  set -e
  if [[ $rc -ne 0 ]]; then
    echo "[error] Upload failed with code $rc. Try installing lftp (brew install lftp) and rerun." >&2
    exit $rc
  fi
else
  echo "[error] Neither lftp nor curl is installed. Please install one of them and re-run." >&2
  if [[ "$OSTYPE" == darwin* ]]; then
    echo "macOS: brew install lftp  # if Homebrew is installed" >&2
  else
    echo "Debian/Ubuntu: sudo apt-get update && sudo apt-get install -y lftp" >&2
  fi
  exit 1
fi

echo "[deploy] Upload complete. Verifying..."
if command -v curl >/dev/null 2>&1; then
  set +e
  http_rc=$(curl -s -o /dev/null -w "%{http_code}" "$VERIFY_URL")
  set -e
  echo "[verify] GET $VERIFY_URL -> HTTP $http_rc"
else
  echo "[verify] Open $VERIFY_URL in your browser."
fi

echo "[done] Deployed to $FTP_REMOTE on $FTP_HOST"
