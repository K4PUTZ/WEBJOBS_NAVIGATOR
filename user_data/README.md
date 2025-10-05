# User Data Directory

This directory stores user-specific data in JSON format.

## File Format:
- `user_[hash].json` - Individual user data files

## Security:
- User ID is MD5 hash of email address
- No sensitive data stored in files
- Files are created with 755 permissions

## Structure:
```json
{
  "favorites": [...],
  "recent_skus": [...],
  "settings": {...},
  "last_updated": "2025-10-04 12:00:00"
}
```