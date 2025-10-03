<?php declare(strict_types=1); require __DIR__.'/config.php'; ?>
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Jobs Navigator (Web)</title>
    <link rel="stylesheet" href="assets/style.css?v=1" />
  </head>
  <body>
    <div class="app">
      <header class="topbar">
        <div class="brand">
          <span class="dots">
            <i style="background:#ffd400"></i><i style="background:#00e5ff"></i><i style="background:#39ff14"></i><i style="background:#ff00ff"></i><i style="background:#ff3b30"></i><i style="background:#007aff"></i>
          </span>
          <span class="title">Sofa Jobs Navigator® — Web</span>
        </div>
        <nav class="toolbar">
          <button id="btnWelcome" class="tool">Welcome</button>
          <button id="btnClipboard" class="tool" title="F9">Check Clipboard</button>
          <button id="btnAbout" class="tool">About</button>
          <?php if (is_connected()): ?>
            <a class="tool" href="auth.php?refresh=1">Refresh</a>
            <a class="tool" href="logout.php">Sign out</a>
          <?php else: ?>
            <a class="tool" href="auth.php">Connect</a>
          <?php endif; ?>
          <button id="btnSearch" class="tool" title="F12 / Alt+S">Search SKU</button>
        </nav>
      </header>

      <main class="grid">
        <section class="console card">
          <h3>Console</h3>
          <pre id="console" class="console-text"></pre>
          <div class="row-right">
            <button id="btnClear" class="btn">Clear Console</button>
          </div>
        </section>

        <aside class="sidebar">
          <div class="card">
            <h4>Current SKU</h4>
            <input id="currentSku" class="sku-field" type="text" readonly value="(none)" />
          </div>

          <div class="card">
            <h4>Favorites</h4>
            <div id="favorites" class="fav-list"></div>
            <p class="hint">Hotkeys: Try Alt+1..8 (F1..F8 may be reserved by the browser)</p>
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
        <div>Working Folder: <span class="muted">(web uses browser tabs)</span></div>
        <div>Server time: <code><?php echo date('Y-m-d H:i:s'); ?></code></div>
      </footer>
    </div>

    <script>
      window.WJN_CONNECTED = <?php echo is_connected() ? 'true' : 'false' ?>;
      window.WJN_EMAIL = <?php echo json_encode(get_account_email()); ?>;
    </script>
    <script src="assets/app.js?v=1"></script>
  </body>
</html>
