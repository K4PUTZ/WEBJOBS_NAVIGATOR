<?php 
declare(strict_types=1); 
require __DIR__.'/config.php'; 
require __DIR__.'/user_data.php';
?>
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sofa Jobs Navigator® — Web</title>
    <link rel="stylesheet" href="assets/style.css?v=17" />
    <link rel="icon" href="sofa_icon.ico" sizes="any">
    <link rel="icon" type="image/png" href="sofa_icon_128.png" sizes="128x128">
    <link rel="apple-touch-icon" href="sofa_icon.png">
  </head>
  <body>
    <div class="app">
      <header class="topbar">
        <div class="brand">
          <img src="logo.png" alt="Logo" class="logo" />
          <span class="title">Sofa Jobs Navigator® 2.0</span>
        </div>
        <nav class="toolbar">
          <button id="btnWelcome" class="tool">Welcome (F1)</button>
          <button id="btnClipboard" class="tool" title="F9">Check Clipboard</button>
          <button id="btnAbout" class="tool">About</button>
          <?php if (is_connected()): ?>
            <a class="tool" href="logout.php">Sign out</a>
          <?php else: ?>
            <a class="tool" href="auth.php">Connect</a>
          <?php endif; ?>
          
        </nav>
      </header>

      <main class="grid">
        <section class="console card" id="consoleCard">
          <div class="console-header">
            <h3>Console</h3>
          </div>
          <pre id="console" class="console-text"></pre>
          <div class="console-footer">
            <button id="btnClear" class="btn btn-xs">Clear Console</button>
          </div>
        </section>

        <aside class="sidebar">
          <div class="card">
            <h4>Current SKU <button id="btnSearchSku" class="btn btn-primary btn-search-glow" title="F9"><span class="icon">🔍</span> Search SKU (F9)</button></h4>
            <input id="currentSku" class="sku-field" type="text" readonly value="(none)" />
          </div>

          <div class="card">
            <h4>Favorites <button id="btnSettingsInline" class="btn" title="Home"><span class="icon">⚙️</span> Settings (Home)</button></h4>
            <div id="favorites" class="fav-list"></div>

          </div>

          <div class="card">
            <h4>Recent SKUs <button id="btnClearRecents" class="btn btn-xs">Clear</button></h4>
            <ol id="recents" class="recents"></ol>
          </div>
        </aside>
      </main>

      <footer class="statusbar">
        <div>Status: <span id="status" class="status <?php echo is_connected() ? 'online' : 'offline' ?>">
          <?php echo is_connected() ? 'Online • '.htmlspecialchars(get_account_email() ?? '') : 'Offline' ?>
        </span></div>
        <div>Server time: <code><?php echo date('Y-m-d H:i:s'); ?></code></div>
        <div class="version">v 2.0.14</div>
      </footer>
    </div>

    <script>
      window.WJN_CONNECTED = <?php echo is_connected() ? 'true' : 'false' ?>;
      window.WJN_EMAIL = <?php echo json_encode(get_account_email()); ?>;
      window.WJN_USER = <?php echo json_encode(get_user_info()); ?>;
    </script>
    
    <!-- Settings Modal -->
    <div id="settingsModal" class="modal" style="display: none;">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Settings</h3>
          <button id="closeSettings" class="btn-close">&times;</button>
        </div>
        <div class="modal-body">
          <h4>Customize Favorites</h4>
          <div id="settingsOptions" class="settings-options">
            <label><input type="checkbox" id="opt_sounds"> Sounds on/off</label>
            <label><input type="checkbox" id="opt_auto_connect"> Auto-connect on/off</label>
            <label><input type="checkbox" id="opt_auto_detect"> Auto-detect SKU on/off</label>
            <label><input type="checkbox" id="opt_auto_load_multiple"> Auto load multiple recents (no prompt)</label>
            <label><input type="checkbox" id="opt_open_root_on_detect"> Open root folder on SKU found</label>
            <label><input type="checkbox" id="opt_show_welcome"> Show Welcome Window on Startup</label>
          </div>
          <div id="favoritesEditor"></div>
          <div class="settings-note">
            <img src="path_warning.png" alt="Path format guidance" />
            <p class="hint">Warning: make sure the path has the exact same pattern of the remote folders.</p>
          </div>
          <div class="modal-actions">
            <button id="resetFavorites" class="btn">Reset to Default</button>
            <button id="cancelSettings" class="btn">Cancel</button>
            <button id="saveFavorites" class="btn btn-primary">Save Changes</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Welcome Modal -->
    <div id="welcomeModal" class="modal" style="display:none;">
      <div class="modal-content welcome-content">
        <div class="modal-header">
          <h3>Welcome</h3>
          <button id="closeWelcome" class="btn-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="welcome-grid">
            <div class="welcome-slides">
              <div id="welcomeSlides" class="slides"></div>
              <div id="welcomeText" class="welcome-text"></div>
              <div id="welcomeInlineOptions" class="welcome-inline-options"></div>
              <div class="welcome-nav">
                <button id="welcomePrev" class="btn">◀ Prev</button>
                <div id="welcomePager" class="pager">1 / 1</div>
                <button id="welcomeNext" class="btn btn-primary">Next ▶</button>
              </div>
            </div>
            <div class="welcome-options">
              <h4>Quick Options</h4>
              <div class="settings-options">
                <label><input type="checkbox" id="w_opt_sounds"> Sounds on/off</label>
                <label><input type="checkbox" id="w_opt_auto_connect"> Auto-connect on/off</label>
                <label><input type="checkbox" id="w_opt_auto_detect"> Auto-detect SKU on/off</label>
                <label><input type="checkbox" id="w_opt_auto_load_multiple"> Auto load multiple recents (no prompt)</label>
              </div>
              <div class="row-right">
                <button id="welcomeApply" class="btn btn-primary">Apply</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- About Modal -->
    <div id="aboutModal" class="modal" style="display:none;">
      <div class="modal-content about-content">
        <div class="modal-header">
          <h3>About</h3>
          <button id="closeAbout" class="btn-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="about-body">
            <img class="about-logo" src="welcome/Sofa.png" alt="Sofa" />
            <div class="about-text">
              <p>Sofa Jobs Navigator® — Web Edition</p>
              <p>Tools to detect SKUs and jump to Google Drive folders quickly.</p>
              <p>Use F1 for Welcome, F9 to Search, and Home for Settings.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <script src="assets/app.js?v=17"></script>
  </body>
</html>
