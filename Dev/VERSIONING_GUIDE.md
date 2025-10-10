# WEBJOBS_NAVIGATOR_PHP Versioning System

## Current Version: 2.0.33

### Versioning Guidelines for AI Assistants

**Format:** `v X.Y.Z`
- **X (Major)**: Significant feature additions, major UI changes, breaking changes
- **Y (Minor)**: New features, enhancements, non-breaking changes  
- **Z (Patch)**: Bug fixes, small tweaks, minor improvements

### Version History:
- **v2.0.19** - Settings modal: bottom Cancel closes without saving; Esc/overlay/X show save confirmation and keep editing on Cancel
- **v2.0.21** - Working bar font smaller; working/status rows inverted (status at bottom); Settings: moved Working Folder row below warning with separator
- **v2.0.22** - Settings: added two empty spacer lines below Working Folder row; Status bar font reduced to match Working bar
- **v2.0.23** - Unified status bars into a single container with two rows (Working Folder row + Status row) without changing behavior
- **v2.0.24** - Working Folder label/path enlarged to 14px; status row remains 12px
- **v2.0.25** - Rebuilt Welcome Window as a 7-step wizard with images, text, options bound to Settings, pager dots, Prev/Next/Finish, and cancel confirmation
- **v2.0.26** - Wizard page 7 adds “Show Welcome on Startup”; persists to settings and auto-opens on load by default
- **v2.0.27** - Fixed inconsistency: saving from Settings now persists Show Welcome/Open Root and doesn’t overwrite wizard preferences; both UIs stay in sync
- **v2.0.28** - Wizard page 7 now suggests Show Welcome unchecked by default; it only updates settings when Finish is pressed. Defaults for new users remain ON via Settings.
- **v2.0.29** - Wizard nav row fixed to bottom across pages; added breathing space below separator
- **v2.0.30** - Wizard warnings: page 1→2 confirms if not connected; page 6→7 warns if no Working Folder (proceeds after OK)
- **v2.0.31** - Redesigned About window (logo, version, separator, Sofa.png) and moved Settings to main toolbar with icons; toolbar buttons/icons added (Welcome, About, Check Clipboard, Connect/Sign out, Create SKU Folder)
- **v2.0.32** - Removed Settings button from Favorites panel; toolbar Settings label now reads “Settings (Home)”
- **v2.0.33** - Layout: main grid stretches to bottom; status bar pinned; Recent SKUs and Console extend to fill available height
- **v2.0.18** - Settings modal: overlay/Escape/X now prompt to save if changed; removed outside-click lock; added dirty tracking
- **v2.0.17** - Re-render favorites when Current SKU changes to enable buttons correctly
- **v2.0.16** - Recents click resets context + copies SKU; favorites use full SKU, not truncated; bumped cache-busters
- **v2.0.15** - Drive query escaping fix; consolidated renderFavorites; incremental upload workflow docs
- **v2.0.14** - UI polish, status bar email, modal UX, cache-buster
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
