# WEBJOBS_NAVIGATOR_PHP Setup Guide

## Current Status ✅
- ✅ Core PHP files created
- ✅ API endpoints implemented  
- ✅ Frontend JavaScript updated
- ✅ OAuth flow implemented
- ⚠️ **Google API client library not installed** (expected lint errors)

## Next Steps to Complete Setup

### 1. **Install Google API Client Library**
```bash
cd /Volumes/Expansion/----- PESSOAL -----/PYTHON/WEBJOBS_NAVIGATOR_PHP
composer install
```
This will:
- Create `vendor/` directory with Google API PHP client
- Resolve all the "Undefined type" lint errors
- Enable Google Drive API functionality

### 2. **Create OAuth Web Application Credentials**

#### A. Google Cloud Console Setup:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (same as Python version)
3. Navigate to **APIs & Services > Credentials**
4. Click **+ CREATE CREDENTIALS > OAuth 2.0 Client IDs**
5. Choose **Application type: Web application**
6. Set **Name**: `Jobs Navigator Web`
7. **Authorized redirect URIs**: Add exactly:
   ```
   https://www.mateusribeiro.com/jobs_navigator/callback.php
   ```
8. Click **CREATE**

#### B. Download & Install Credentials:
1. Download the JSON file from Google Cloud Console
2. **Rename it to `credentials.json`**
3. Place it in `WEBJOBS_NAVIGATOR_PHP/` directory

### 3. **Deploy to Server**
```bash
# After composer install and credentials.json are ready:
bash WEBJOBS_NAVIGATOR_PHP/deploy.sh
```

### 4. **Test the Application**
1. Visit: https://www.mateusribeiro.com/jobs_navigator/
2. Click "Connect" button
3. Complete Google OAuth flow
4. Test SKU detection with clipboard
5. Test favorites navigation

## Troubleshooting

### Lint Errors (Expected Until Step 1)
```
Undefined type 'Google_Service_Drive'
Undefined type 'Google_Service_Oauth2'
```
**Solution**: Run `composer install` - these errors will disappear.

### OAuth Errors
- **"OAuth client not found"** → Wrong credentials.json
- **"Redirect URI mismatch"** → Check exact URL in Google Cloud Console
- **"API not enabled"** → Enable Google Drive API in same project

### API Errors  
- **"Google API client not installed"** → Run `composer install`
- **"Drive service unavailable"** → Check authentication & credentials
- **"SKU root folder not found"** → Verify SKU exists in Google Drive

## File Structure After Setup
```
WEBJOBS_NAVIGATOR_PHP/
├── credentials.json          # ← YOUR OAUTH CREDENTIALS
├── vendor/                   # ← COMPOSER DEPENDENCIES  
│   └── google/apiclient/     # ← GOOGLE API CLIENT
├── index.php                 # Main UI
├── api.php                   # Drive API endpoints
├── auth.php                  # OAuth initiation
├── callback.php              # OAuth callback
├── logout.php                # Sign out
├── config.php                # Configuration
└── assets/                   # CSS/JS
    ├── style.css
    └── app.js
```

## Security Notes
- ✅ `credentials.json` is in `.gitignore` 
- ✅ OAuth uses HTTPS redirect URI
- ✅ Session-based token storage
- ✅ API error handling with logging

---

**Current lint errors are expected and will resolve after `composer install`**