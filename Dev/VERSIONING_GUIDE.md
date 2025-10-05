# WEBJOBS_NAVIGATOR_PHP Versioning System

## Current Version: 2.0.1

### Versioning Guidelines for AI Assistants

**Format:** `v X.Y.Z`
- **X (Major)**: Significant feature additions, major UI changes, breaking changes
- **Y (Minor)**: New features, enhancements, non-breaking changes  
- **Z (Patch)**: Bug fixes, small tweaks, minor improvements

### Version History:
- **v2.0.1** - Added user settings system, server JSON storage, versioning system
- **v2.0.0** - Initial web conversion release
- **v1.4.1** - Original desktop version

### When to Update Version:

**Patch Version (Z+1):**
- Bug fixes
- CSS/styling tweaks
- Small UI improvements
- Performance optimizations

**Minor Version (Y+1, Z=0):**
- New features
- Settings additions
- API enhancements
- Major UI improvements

**Major Version (X+1, Y=0, Z=0):**
- Complete rewrites
- Breaking changes
- Architectural changes
- New platforms

### How to Update:

1. **Increment version** in `index.php` status bar
2. **Update this file** with change description
3. **Document changes** in commit message
4. **Upload files** with version change

### Location of Version Display:
- **File**: `index.php`
- **Location**: Status bar (footer)
- **Format**: `<span class="version">v 2.0.1</span>`

### Example Updates:
```php
// Increment patch version for bug fixes
<span class="version">v 2.0.2</span>

// Increment minor version for new features  
<span class="version">v 2.1.0</span>
```

**Important**: Always update version when making user-visible changes!