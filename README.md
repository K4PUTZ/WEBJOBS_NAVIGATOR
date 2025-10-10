Deploying to Hostinger via FTP
==============================

We will upload these files to `public_html/jobs_navigator/`.

Files
- index.php — web UI shell (console, favorites, recents)
- .htaccess — basic defaults
- config.php — PHP config & OAuth helpers
- auth.php / callback.php / logout.php — Google sign-in flow
- composer.json — Google PHP client dependency
- assets/ — CSS/JS

Upload from your machine (safe approach)
1) Set environment variables (avoid putting your password in shell history):

   macOS/Linux (bash/zsh):
   export FTP_HOST=YOUR_FTP_HOST
   export FTP_USER='YOUR_FTP_USER'
   export FTP_PASS='YOUR_FTP_PASSWORD'
   export FTP_REMOTE='public_html/jobs_navigator'

2) Using curl (plain FTP):
   curl --ftp-method nocwd --ftp-create-dirs \
     -T WEBJOBS_NAVIGATOR_PHP/index.php \
     "ftp://$FTP_USER:$FTP_PASS@$FTP_HOST/$FTP_REMOTE/index.php"

   (Optional) Upload .htaccess:
   curl --ftp-method nocwd --ftp-create-dirs \
     -T WEBJOBS_NAVIGATOR_PHP/.htaccess \
     "ftp://$FTP_USER:$FTP_PASS@$FTP_HOST/$FTP_REMOTE/.htaccess"

3) Verify:
   Open https://your-domain.com/jobs_navigator/

Alternative (lftp with FTPS, if available):
   lftp -e "set ftp:ssl-allow yes; set ftp:passive-mode on; \
             open -u $FTP_USER,$FTP_PASS $FTP_HOST; \
             mkdir -p $FTP_REMOTE; \
             put -O $FTP_REMOTE WEBJOBS_NAVIGATOR_PHP/index.php; \
             put -O $FTP_REMOTE WEBJOBS_NAVIGATOR_PHP/.htaccess; bye"

Security notes
- Do NOT commit credentials to the repository.
- Prefer env vars or a ~/.netrc file for credentials.
- If your host supports FTPS, use it instead of plain FTP.

Phase 2 (OAuth) setup
1) Create Google OAuth client (type: Web application) in Google Cloud Console.
   - Authorized redirect URI: https://www.mateusribeiro.com/jobs_navigator/callback.php
2) Save the client JSON as WEBJOBS_NAVIGATOR_PHP/credentials.json
3) Install dependencies locally:
   - cd WEBJOBS_NAVIGATOR_PHP
   - composer install
   This creates vendor/ with google/apiclient.
4) Deploy using lftp mirror (recommended):
   - bash WEBJOBS_NAVIGATOR_PHP/deploy.sh   # will mirror the whole folder (including vendor/)
5) Visit the site and click Connect.

If you cannot run composer locally, use Hostinger’s Composer tool in hPanel pointed at public_html/jobs_navigator, then press “Install”.
