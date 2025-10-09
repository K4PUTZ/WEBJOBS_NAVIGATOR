# WEBJOBS_NAVIGATOR_PHP - AI Assistant Guide

## 🚀 Quick Deployment Guide

### Deployment System Overview
This project now uses **single-file incremental FTP uploads** for day-to-day changes. The previous ZIP-based method is kept only as a fallback for emergencies or very large first-time uploads.

### ⚠️ CRITICAL DEPLOYMENT LESSONS LEARNED

#### 1. FTP Protocol Issues
- **SERVER ONLY SUPPORTS PLAIN FTP** (not FTPS/SFTP)
- Always use `set ftp:ssl-allow false` in lftp
- Authentication format: `u343523827,3s>C]t32ZdSJ!a.` (note: no closing `}`)

#### 2. Deployment Methods (in order of preference)
1. **Single-file incremental (RECOMMENDED from Oct/2025 onward)**
   - Upload each changed file individually so the hosting panel only asks approval once per path. Afterwards, later uploads to the same path won’t require re-approval.
   - Options:
     - Using `curl` (plain FTP):
       ```bash
       export FTP_HOST=195.179.238.91
       export FTP_USER='u343523827'
       export FTP_PASS='3s>C]t32ZdSJ!a.'
       # Upload a single file
       curl --ftp-method nocwd --ftp-create-dirs \
         -T WEBJOBS_NAVIGATOR_PHP/api.php \
         "ftp://$FTP_USER:$FTP_PASS@$FTP_HOST/jobs_navigator/api.php"
       ```
     - Using helper: `WEBJOBS_NAVIGATOR_PHP/upload_file.sh <filename>` (uses lftp if available)
     - Using `deploy.sh`: mirrors changed files; OK for multi-file increments

2. **ZIP Method (LEGACY / EMERGENCY ONLY)**
   - Keep for first-time or very large deployments when mirroring would be too slow.
   - See legacy snippet below if ever needed.

#### 3. Common Issues & Solutions

**Problem: "Access denied: 530"**
- Solution: Check password format (no closing `}`)
- Solution: Use plain FTP, not FTPS

**Problem: "Certificate verification failed"**
- Solution: Use `set ftp:ssl-allow false`

**Problem: Session errors in PHP**
- Solution: Already fixed in config.php with custom session path

**Problem: "File exists" during mkdir**
- This is normal - directory already exists

### 📁 Project Structure
```
WEBJOBS_NAVIGATOR_PHP/
├── index.php          # Main application
├── api.php           # Backend API endpoints
├── config.php        # Configuration & session handling
├── auth.php          # OAuth initialization
├── callback.php      # OAuth callback handler
├── logout.php        # Logout functionality
├── credentials.json  # Google OAuth credentials (upload manually)
├── assets/           # CSS, JS, images
├── vendor/           # Composer dependencies (35MB+)
├── deploy.sh         # File-by-file deployment script
└── Dev/              # Documentation & development files
```

### 🔧 Development Workflow

1. **Make changes locally**
2. **Test changes** (if possible)
3. **Deploy by uploading changed files (recommended)**
4. **Test on live server**: https://www.mateusribeiro.com/jobs_navigator/

### 🔐 Authentication System

**OAuth 2.0 Flow**:
1. User clicks "Connect with Google"
2. Redirected to Google OAuth
3. Callback receives authorization code
4. Exchange code for access token
5. Store token in PHP session
6. Use token for Drive API calls

**API Endpoints**:
- `GET /api.php?action=status` - Check connection status
- `POST /api.php?action=detect_sku` - Detect SKUs from text
- `POST /api.php?action=resolve_path` - Resolve Drive paths

### 🌐 Live Application
- **URL**: https://www.mateusribeiro.com/jobs_navigator/
- **Status Check**: https://www.mateusribeiro.com/jobs_navigator/api.php?action=status

### 🔍 Troubleshooting Commands

```bash
# Check if files exist on server
curl -I "https://www.mateusribeiro.com/jobs_navigator/index.php"

# Test API
curl -s "https://www.mateusribeiro.com/jobs_navigator/api.php?action=status"

# Check for PHP errors
curl -s "https://www.mateusribeiro.com/jobs_navigator/" | head -20

# Kill hanging FTP processes
pkill -f lftp
```

### 📝 Deployment Checklist

- [ ] Changes tested locally (if possible)
- [ ] Upload changed files one by one (api.php, assets/app.js, etc.)
- [ ] Test live application
- [ ] Test API status endpoint
  
  Optional (mass changes only):
  - [ ] Create ZIP + extract remotely

### 🚨 Emergency Recovery

If deployment fails:
1. Check FTP credentials and protocol settings
2. Use individual file upload for critical files
3. Check server logs via hosting panel
4. Verify PHP version compatibility (8.2+)

---
**Important Rule (for AIs / future ops)**: Use single-file uploads by default. Do not ship ZIPs unless explicitly requested for a large rollout.

**Last Updated**: October 9, 2025
**Deployment Status**: ✅ OPERATIONAL
**Next AI**: Follow this guide for consistent deployments!
