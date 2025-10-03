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

  function saveFavorites(favs) {
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
    if (arr.length > 10) arr = arr.slice(0, 10);
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
    const sku = currentSkuEl.value && currentSkuEl.value !== '(none)' ? currentSkuEl.value : '';
    if (!sku) { log('No current SKU. Press F9 to detect from clipboard.', 'warning'); return; }
    
    const fav = getFavorites()[idx];
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
    const text = await readClipboard();
    if (!text) return;
    log('Clipboard read. Detecting SKUs…');
    
    // Use server-side detection for accuracy
    const result = await detectSkusFromText(text);
    
    if (!result.first) { 
      log('No SKU found in clipboard.', 'warning'); 
      return; 
    }
    
    const sku = result.first.sku;
    setCurrentSku(sku);
    addRecent(sku);
    log('SKU detected: ' + sku, 'sku');
    
    // Log additional SKUs if found
    if (result.matches.length > 1) {
      log(`Found ${result.matches.length} SKUs total. Additional: ${result.matches.slice(1).map(m => m.sku).join(', ')}`, 'info');
      // Add multiple SKUs to recents
      result.matches.slice(1, 8).forEach(match => addRecent(match.sku));
    }
  }

  function initKeys() {
    document.addEventListener('keydown', (e) => {
      // F9 to check clipboard
      if (e.key === 'F9') { e.preventDefault(); handleClipboardScan(); return; }
      // Try F1..F8 (may be blocked). Also support Alt+1..8 as reliable fallback.
      const favIndexByFunction = ({F1:0,F2:1,F3:2,F4:3,F5:4,F6:5,F7:6,F8:7})[e.key];
      if (favIndexByFunction !== undefined) { e.preventDefault(); openFavorite(favIndexByFunction); return; }
      if (e.altKey && /^[1-8]$/.test(e.key)) { e.preventDefault(); openFavorite(parseInt(e.key,10)-1); return; }
    });
  }

  function init() {
    renderFavorites();
    renderRecents();
    $('#btnClear').addEventListener('click', () => { consoleEl.innerHTML = ''; });
    $('#btnClipboard').addEventListener('click', handleClipboardScan);
    $('#btnClearRecents').addEventListener('click', clearRecents);
    statusEl.textContent = 'Offline'; statusEl.classList.add('offline');
    initKeys();
    log('Copy a SKU (Vendor-ID) to the clipboard and click Search or press F9.');
  }

  document.addEventListener('DOMContentLoaded', init);
})();

