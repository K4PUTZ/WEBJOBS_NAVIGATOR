# WEBJOBS_NAVIGATOR_PHP - AI Assistant Guide

## 🚀 Quick Deployment Guide

### Deployment System Overview
This project uses **ZIP-based FTP deployment** for fast and reliable uploads to the web server.

### ⚠️ CRITICAL DEPLOYMENT LESSONS LEARNED

#### 1. FTP Protocol Issues
- **SERVER ONLY SUPPORTS PLAIN FTP** (not FTPS/SFTP)
- Always use `set ftp:ssl-allow false` in lftp
- Authentication format: `u343523827,3s>C]t32ZdSJ!a.` (note: no closing `}`)

#### 2. Deployment Methods (in order of preference)
1. **ZIP Method** (RECOMMENDED - seconds vs hours):
   ```bash
   # Create zip
   zip -r deploy_manual.zip . -x "test_*.php" "deploy*.sh" "deploy*.ps1" "*.zip"
   
   # Upload via lftp
   lftp -p 21 -u 'u343523827,3s>C]t32ZdSJ!a.' 195.179.238.91 <<EOF
   set ftp:ssl-allow false
   set ftp:passive-mode on
   cd jobs_navigator
   put deploy_manual.zip
   put extract.php
   bye
   EOF
   
   # Extract remotely
   curl -s "https://www.mateusribeiro.com/jobs_navigator/extract.php"
   ```

2. **File-by-file** (SLOW - use only for small updates):
   ```bash
   bash deploy.sh  # Has fallback paths built-in
   ```

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
3. **Deploy using ZIP method** (recommended)
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
- [ ] Create zip: `zip -r deploy_manual.zip . -x "test_*.php" "deploy*.sh" "*.zip"`
- [ ] Upload zip via lftp with plain FTP
- [ ] Create/upload extract.php script
- [ ] Execute extraction remotely
- [ ] Test live application
- [ ] Clean up extraction script

### 🚨 Emergency Recovery

If deployment fails:
1. Check FTP credentials and protocol settings
2. Use individual file upload for critical files
3. Check server logs via hosting panel
4. Verify PHP version compatibility (8.2+)

---
**Last Updated**: October 2, 2025
**Deployment Status**: ✅ OPERATIONAL
**Next AI**: Follow this guide for consistent deployments!