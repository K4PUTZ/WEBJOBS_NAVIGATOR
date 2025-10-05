(() => {
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const consoleEl = $('#console');
  const currentSkuEl = $('#currentSku');
  const recentsEl = $('#recents');
  const statusEl = $('#status');
  const favoritesEl = $('#favorites');

  const SKU_PATTERNS = [
    /[A-Z0-9_]+_SOFA_\d{8}_\d{4}/g,
    /[A-Z0-9]+_\d{4}_TT\d{7,8}_M/g,
    /[A-Z0-9_]+_\d{4}_TT\d{7,8}_S\d{3}_E\d{3}/g,
  ];

  const DEFAULT_FAVORITES = [
    { label: 'Root Folder', path: '' },
    { label: 'Trailer / Video IN', path: '02-TRAILER/VIDEO IN' },
    { label: 'Artes', path: 'EXPORT/03- ARTES' },
    { label: 'Marketing / Social', path: 'EXPORT/03- ARTES/06- MARKETING/SOCIAL' },
    { label: 'Envio Direto', path: 'EXPORT/03- ARTES/03- ENVIO DIRETO PLATAFORMA' },
    { label: 'Legendas', path: 'EXPORT/02- LEGENDAS' },
    { label: 'Temp', path: 'TEMP' },
    { label: 'Entrega', path: 'EXPORT/04- ENTREGAS' },
  ];

  function log(line, cls) {
    const span = document.createElement('div');
    if (cls) span.className = 'line-' + cls;
    const timestamp = new Date().toLocaleTimeString();
    span.textContent = `[${timestamp}] ${line}`;
    consoleEl.appendChild(span);
    consoleEl.scrollTop = consoleEl.scrollHeight;
    
    // Limit console to 100 lines
    while (consoleEl.children.length > 100) {
      consoleEl.removeChild(consoleEl.firstChild);
    }
  }

  function setCurrentSku(sku) {
    currentSkuEl.value = sku || '(none)';
  }

  function getFavorites() {
    try {
      const raw = localStorage.getItem('wjn_favorites');
      if (!raw) return DEFAULT_FAVORITES.slice();
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || arr.length !== 8) throw new Error('bad');
      return arr;
    } catch { return DEFAULT_FAVORITES.slice(); }
  }

  function saveFavoritesToLocal(favs) {
    localStorage.setItem('wjn_favorites', JSON.stringify(favs));
  }

  function getRecents() {
    try {
      const raw = localStorage.getItem('wjn_recents');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  function addRecent(sku) {
    let arr = getRecents();
    arr = arr.filter(s => s !== sku);
    arr.unshift(sku);
    if (arr.length > 20) arr = arr.slice(0, 20);
    localStorage.setItem('wjn_recents', JSON.stringify(arr));
    renderRecents();
  }

  function clearRecents() {
    localStorage.removeItem('wjn_recents');
    renderRecents();
  }

  function renderRecents() {
    recentsEl.innerHTML = '';
    const arr = getRecents();
    if (!arr.length) {
      const li = document.createElement('li');
      li.textContent = '(empty)';
      recentsEl.appendChild(li);
      return;
    }
    arr.forEach((sku, i) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = sku;
      a.className = 'link';
      a.addEventListener('click', (e) => { e.preventDefault(); setCurrentSku(sku); log('SKU selected: ' + sku, 'sku'); });
      li.appendChild(a);
      recentsEl.appendChild(li);
    });
  }

  function renderFavorites() {
    favoritesEl.innerHTML = '';
    const favs = getFavorites();
    favs.forEach((fav, idx) => {
      const row = document.createElement('div');
      row.className = 'fav';
      const key = document.createElement('div'); key.className = 'key'; key.textContent = (idx+1).toString();
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.innerHTML = `<span class="label">${fav.label || ('Favorite ' + (idx+1))}</span>`;
      btn.addEventListener('click', () => openFavorite(idx));
      row.appendChild(key); row.appendChild(btn);
      favoritesEl.appendChild(row);
    });
  }

  async function detectSkusFromText(text) {
    try {
      const response = await fetch('api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `action=detect_sku&text=${encodeURIComponent(text)}`
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'SKU detection failed');
      }
      
      return data;
    } catch (error) {
      log(`SKU detection error: ${error.message}`, 'error');
      return { matches: [], first: null };
    }
  }

  function detectFirst(text) {
    // Client-side fallback for immediate feedback
    for (const re of SKU_PATTERNS) {
      const m = text.match(re);
      if (m && m.length) return m[0];
    }
    return null;
  }

  async function readClipboard() {
    if (!navigator.clipboard) {
      log('Clipboard API not available. Paste into the page.', 'warning');
      return '';
    }
    try {
      const t = await navigator.clipboard.readText();
      return t || '';
    } catch (e) {
      log('Clipboard read blocked by the browser. Click the page and press Ctrl/Cmd+V to paste.', 'warning');
      return '';
    }
  }

  async function resolveSkuPath(sku, path) {
    if (!window.WJN_CONNECTED) {
      log('Not connected to Google Drive. Click Connect first.', 'warning');
      return null;
    }
    
    try {
      const response = await fetch('api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `action=resolve_path&sku=${encodeURIComponent(sku)}&path=${encodeURIComponent(path || '')}`
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'API request failed');
      }
      
      return data;
    } catch (error) {
      log(`Drive API error: ${error.message}`, 'error');
      return null;
    }
  }
  
  function googleSearchUrl(sku, path) {
    const q = encodeURIComponent((path ? path + ' ' : '') + sku);
    return `https://drive.google.com/drive/search?q=${q}`;
  }

  async function openFavorite(idx) {
    console.log('Opening favorite', idx);
    const sku = currentSkuEl.value && currentSkuEl.value !== '(none)' ? currentSkuEl.value : '';
    if (!sku) { log('No current SKU. Press F9 to detect from clipboard.', 'warning'); return; }
    
    const favorites = window.USER_FAVORITES || getFavorites();
    const fav = favorites[idx];
    if (!fav) { log(`Favorite ${idx + 1} not found.`, 'warning'); return; }
    const path = fav?.path || '';
    
    log(`Resolving: ${fav.label || 'Favorite'} → ${path || '/'} for ${sku}...`);
    
    // Try to resolve exact folder first if connected
    if (window.WJN_CONNECTED) {
      const result = await resolveSkuPath(sku, path);
      if (result && result.drive_url) {
        window.open(result.drive_url, '_blank');
        log(`Opened: ${fav.label || 'Favorite'} → ${result.drive_url}`, 'success');
        return;
      }
    }
    
    // Fallback to search
    const url = googleSearchUrl(sku, path);
    window.open(url, '_blank');
    log(`Search fallback: ${fav.label || 'Favorite'} → ${path || '/'} for ${sku}`, 'success');
  }

  async function handleClipboardScan() {
    log('Starting clipboard scan...', 'info');
    
    try {
      const text = await readClipboard();
      if (!text) {
        log('No text found in clipboard.', 'warning');
        return;
      }
      
      log('Clipboard read. Detecting SKUs…');
      
      // Use server-side detection for accuracy
      const result = await detectSkusFromText(text);
      
      if (!result.first) { 
        log('No SKU found in clipboard.', 'warning'); 
        return; 
      }
      
      const sku = result.first.sku;
      setCurrentSku(sku);
      saveUserRecent(sku);
      log('SKU detected: ' + sku, 'sku');
      
      // Log additional SKUs if found
      if (result.matches.length > 1) {
        log(`Found ${result.matches.length} SKUs total. Additional: ${result.matches.slice(1).map(m => m.sku).join(', ')}`, 'info');
        // Add multiple SKUs to recents
        result.matches.slice(1, 8).forEach(match => addRecent(match.sku));
      }
    } catch (error) {
      log('Error during clipboard scan: ' + error.message, 'error');
    }
  }

  function initKeys() {
    document.addEventListener('keydown', (e) => {
      // F9 to check clipboard
      if (e.key === 'F9') { 
        e.preventDefault(); 
        console.log('F9 pressed, triggering clipboard scan');
        handleClipboardScan(); 
        return; 
      }
      // Try F1..F8 (may be blocked). Also support 1..8 as reliable fallback.
      const favIndexByFunction = ({F1:0,F2:1,F3:2,F4:3,F5:4,F6:5,F7:6,F8:7})[e.key];
      if (favIndexByFunction !== undefined) { e.preventDefault(); openFavorite(favIndexByFunction); return; }
      // F10 to open settings
      if (e.key === 'F10') { e.preventDefault(); openSettings(); return; }
      
      // Use number keys 1-8 directly (no Alt needed) - but not when typing in inputs
      if (!e.ctrlKey && !e.altKey && !e.metaKey && /^[1-8]$/.test(e.key)) {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          return; // Don't interfere with typing
        }
        e.preventDefault(); 
        openFavorite(parseInt(e.key,10)-1); 
        return; 
      }
    });
  }

  function adjustConsoleHeight() {
    const consoleCard = $('#consoleCard');
    const consoleHeader = $('.console-header');
    const consoleFooter = $('.console-footer');
    const consoleEl = $('#console');
    
    if (!consoleCard || !consoleHeader || !consoleFooter || !consoleEl) return;
    
    // Get the total height of the console card
    const cardHeight = consoleCard.clientHeight;
    
    // Calculate the height used by header, footer, and padding
    const headerHeight = consoleHeader.offsetHeight;
    const footerHeight = consoleFooter.offsetHeight;
    const cardPadding = 20; // 10px top + 10px bottom padding from .card
    const margins = 20; // 10px margin-bottom on header + 10px margin-top on footer
    
    // Calculate available height for console
    const availableHeight = cardHeight - headerHeight - footerHeight - cardPadding - margins;
    
    // Set the console height
    consoleEl.style.height = Math.max(200, availableHeight) + 'px';
  }

  async function loadUserData() {
    if (!window.WJN_CONNECTED || !window.WJN_USER) return;
    
    try {
      const response = await fetch('user_api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'action=get_user_data'
      });
      
      const data = await response.json();
      if (data.favorites) {
        // Update favorites with user data
        window.USER_FAVORITES = data.favorites;
        renderFavorites();
      }
      if (data.recent_skus) {
        // Update recent SKUs with user data
        localStorage.setItem('wjn_recents', JSON.stringify(data.recent_skus));
        renderRecents();
      }
    } catch (error) {
      console.log('Failed to load user data:', error);
    }
  }

  async function saveUserRecent(sku) {
    if (!window.WJN_CONNECTED) {
      // Fallback to localStorage
      addRecent(sku);
      return;
    }
    
    try {
      const response = await fetch('user_api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `action=add_recent_sku&sku=${encodeURIComponent(sku)}`
      });
      
      const data = await response.json();
      if (data.success) {
        localStorage.setItem('wjn_recents', JSON.stringify(data.recent_skus));
        renderRecents();
      }
    } catch (error) {
      // Fallback to localStorage
      addRecent(sku);
    }
  }

  function openSettings() {
    if (!window.WJN_CONNECTED) {
      alert('Please connect to Google Drive to access settings.');
      return;
    }
    
    const modal = $('#settingsModal');
    const editor = $('#favoritesEditor');
    
    // Populate favorites editor
    const favorites = window.USER_FAVORITES || getFavorites();
    editor.innerHTML = '';
    
    favorites.forEach((fav, idx) => {
      const item = document.createElement('div');
      item.className = 'favorite-item';
      item.innerHTML = `
        <div class=\"key\">${idx + 1}</div>
        <input type=\"text\" placeholder=\"Label\" value=\"${fav.label || ''}\" data-field=\"label\" data-index=\"${idx}\">
        <input type=\"text\" placeholder=\"Path\" value=\"${fav.path || ''}\" data-field=\"path\" data-index=\"${idx}\">
        <button class=\"btn btn-xs\" onclick=\"removeFavorite(${idx})\">&times;</button>
      `;
      editor.appendChild(item);
    });
    
    modal.style.display = 'flex';
  }

  window.closeSettings = function() {
    const modal = $('#settingsModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  window.removeFavorite = function(idx) {
    const editor = $('#favoritesEditor');
    const items = editor.children;
    if (items[idx]) {
      items[idx].remove();
    }
  }

  async function saveFavorites() {
    const inputs = $$('#favoritesEditor input');
    const favorites = [];
    
    // Group inputs by index
    const byIndex = {};
    inputs.forEach(input => {
      const index = parseInt(input.dataset.index);
      const field = input.dataset.field;
      if (!byIndex[index]) byIndex[index] = {};
      byIndex[index][field] = input.value;
    });
    
    // Convert to array
    Object.keys(byIndex).forEach(index => {
      const fav = byIndex[index];
      if (fav.label || fav.path) {
        favorites.push({ label: fav.label || '', path: fav.path || '' });
      }
    });
    
    try {
      const response = await fetch('user_api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `action=save_favorites&favorites=${encodeURIComponent(JSON.stringify(favorites))}`
      });
      
      const data = await response.json();
      if (data.success) {
        window.USER_FAVORITES = favorites;
        renderFavorites();
        closeSettings();
        log('Favorites saved successfully.', 'success');
      } else {
        log('Failed to save favorites.', 'error');
      }
    } catch (error) {
      log('Error saving favorites: ' + error.message, 'error');
    }
  }

  function init() {
    renderFavorites();
    renderRecents();
    $('#btnClear').addEventListener('click', () => { consoleEl.innerHTML = ''; });
    $('#btnClipboard').addEventListener('click', handleClipboardScan);
    $('#btnSearch').addEventListener('click', handleClipboardScan);
    const settingsBtn = $('#btnSettings');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        console.log('Settings button clicked');
        openSettings();
      });
    } else {
      console.error('Settings button not found');
    }
    $('#btnClearRecents').addEventListener('click', clearRecents);
    $('#closeSettings').addEventListener('click', closeSettings);
    $('#saveFavorites').addEventListener('click', saveFavorites);
    
    // Close modal when clicking outside
    $('#settingsModal').addEventListener('click', (e) => {
      if (e.target.id === 'settingsModal') {
        closeSettings();
      }
    });
    
    // Update status based on connection state
    if (window.WJN_CONNECTED) {
      statusEl.classList.remove('offline');
      statusEl.classList.add('online');
      // Load user data when connected
      loadUserData();
    } else {
      statusEl.classList.remove('online');
      statusEl.classList.add('offline');
    }
    
    initKeys();
    
    // Adjust console height after DOM is fully loaded
    setTimeout(adjustConsoleHeight, 100);
    
    // Re-adjust on window resize
    window.addEventListener('resize', adjustConsoleHeight);
    
    log('Copy a SKU (Vendor-ID) to the clipboard and click Search or press F9.');
  }

  document.addEventListener('DOMContentLoaded', init);
})();

