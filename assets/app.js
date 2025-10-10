(() => {
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const consoleEl = $('#console');
  const currentSkuEl = $('#currentSku');
  const recentsEl = $('#recents');
  const statusEl = $('#status');
  const favoritesEl = $('#favorites');

  const workingDisplay = document.getElementById('workingDisplay');
  const skuSuffixInput = document.getElementById('skuSuffixInput');
  const btnCreateSkuFolder = document.getElementById('btnCreateSkuFolder');
  const workingFolderInput = document.getElementById('workingFolderInput');
  const chooseWorkingFolderBtn = document.getElementById('chooseWorkingFolder');

  // Working folder state
  let WJN_WORKDIR_HANDLE = null; // FileSystemDirectoryHandle when available
  let WJN_WORKDIR_LABEL = '';

  // IndexedDB helpers for storing directory handle
  let _wjnDB = null;
  async function idbOpen() {
    if (_wjnDB) return _wjnDB;
    return await new Promise((resolve, reject) => {
      const req = indexedDB.open('wjn', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles');
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = () => { _wjnDB = req.result; resolve(_wjnDB); };
      req.onerror = () => reject(req.error);
    });
  }
  async function idbPut(store, key, value) {
    const db = await idbOpen();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.objectStore(store).put(value, key);
    });
  }
  async function idbGet(store, key) {
    const db = await idbOpen();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      tx.onerror = () => reject(tx.error);
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function getSuffix() {
    try {
      if (window.USER_SETTINGS && typeof window.USER_SETTINGS.sku_suffix === 'string') return window.USER_SETTINGS.sku_suffix;
      const raw = localStorage.getItem('wjn_sku_suffix');
      return raw || '';
    } catch (_) { return ''; }
  }
  async function saveSuffix(s) {
    try { localStorage.setItem('wjn_sku_suffix', s); } catch(_) {}
    try {
      const cur = window.USER_SETTINGS || {};
      cur.sku_suffix = s;
      await saveSettings(cur);
    } catch(_) {}
  }

  function getCurrentSkuFull() {
    if (!currentSkuEl) return '';
    const ds = (currentSkuEl.dataset && currentSkuEl.dataset.fullSku) ? currentSkuEl.dataset.fullSku : '';
    return ds || currentSkuEl.title || ((currentSkuEl.value && currentSkuEl.value !== '(none)') ? currentSkuEl.value : '');
  }

  function updateCreateButtonState() {
    if (!btnCreateSkuFolder) return;
    const hasHandle = !!WJN_WORKDIR_HANDLE;
    const hasSku = !!getCurrentSkuFull();
    btnCreateSkuFolder.disabled = !(hasHandle && hasSku);
  }

  async function ensureWorkdirPermission() {
    if (!WJN_WORKDIR_HANDLE) return false;
    try {
      if (WJN_WORKDIR_HANDLE.requestPermission) {
        const perm = await WJN_WORKDIR_HANDLE.requestPermission({ mode: 'readwrite' });
        return perm === 'granted';
      }
      if (WJN_WORKDIR_HANDLE.queryPermission) {
        const perm2 = await WJN_WORKDIR_HANDLE.queryPermission({ mode: 'readwrite' });
        return perm2 === 'granted';
      }
    } catch(_) {}
    return true; // Best effort
  }

  function workingPathPreviewParts() {
    const base = WJN_WORKDIR_LABEL || '';
    const sku = getCurrentSkuFull();
    const suffix = (skuSuffixInput && skuSuffixInput.value) ? skuSuffixInput.value : getSuffix();
    const append = sku ? `${sku}${suffix ? ' ' + suffix : ''}` : '';
    return { base, append };
  }

  function renderWorkingDisplay() {
    if (!workingDisplay) return;
    if (!WJN_WORKDIR_LABEL) {
      workingDisplay.textContent = "Not set, press 'Home' to open settings";
      updateCreateButtonState();
      return;
    }
    const { base, append } = workingPathPreviewParts();
    const baseHtml = `<span class="wbase">${escapeHtml(base)}</span>`;
    const appendHtml = append ? `/`+`<span class="wnew">${escapeHtml(append)}</span>` : '';
    workingDisplay.innerHTML = baseHtml + appendHtml;
    updateCreateButtonState();
  }

  async function chooseWorkingFolder() {
    try {
      if (!window.showDirectoryPicker) {
        alert('This browser does not support choosing a local folder. Try Chrome/Edge.');
        return;
      }
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      WJN_WORKDIR_HANDLE = handle;
      WJN_WORKDIR_LABEL = handle.name || 'Selected folder';
      try { await idbPut('handles', 'working', handle); } catch(_) {}
      if (workingFolderInput) workingFolderInput.value = WJN_WORKDIR_LABEL;
      renderWorkingDisplay();
      log('Working folder selected: ' + WJN_WORKDIR_LABEL, 'success');
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      log('Failed to choose folder: ' + (e?.message || e), 'error');
    }
  }

  async function restoreWorkingFolder() {
    try {
      const handle = await idbGet('handles', 'working');
      if (handle) {
        WJN_WORKDIR_HANDLE = handle;
        WJN_WORKDIR_LABEL = handle.name || 'Selected folder';
        if (workingFolderInput) workingFolderInput.value = WJN_WORKDIR_LABEL;
      }
    } catch(_) {}
    renderWorkingDisplay();
  }

  async function createSkuFolder() {
    const sku = getCurrentSkuFull();
    if (!sku) { log('No current SKU to create folder for.', 'warning'); return; }
    if (!WJN_WORKDIR_HANDLE && !navigator.storage?.getDirectory) {
      log('No working folder set and no fallback available.', 'error');
      return;
    }
    const suffix = skuSuffixInput && skuSuffixInput.value ? skuSuffixInput.value : getSuffix();
    const folderName = sku + (suffix ? ' ' + suffix : '');
    try {
      if (WJN_WORKDIR_HANDLE) {
        const ok = await ensureWorkdirPermission();
        if (!ok) { log('Permission denied to write in the selected folder.', 'error'); return; }
        await WJN_WORKDIR_HANDLE.getDirectoryHandle(folderName, { create: true });
        log('Created folder: ' + WJN_WORKDIR_LABEL + '/' + folderName, 'success');
      } else {
        const root = await navigator.storage.getDirectory();
        const base = await root.getDirectoryHandle('WJN_WORKING', { create: true });
        await base.getDirectoryHandle(folderName, { create: true });
        log('Created folder in app storage: WJN_WORKING/' + folderName, 'success');
      }
    } catch (e) {
      log('Failed to create folder: ' + (e?.message || e), 'error');
    }
  }


  // Helpers to keep UI responsive and consistent
  function isTextInputFocused() {
    const ae = document.activeElement;
    if (!ae) return false;
    const tag = ae.tagName;
    const editable = ae.getAttribute && ae.getAttribute('contenteditable');
    return tag === 'INPUT' || tag === 'TEXTAREA' || editable === 'true';
  }

  // Override renderFavorites with SKU-aware, slot-aware behavior
  function renderFavorites() {
    favoritesEl.innerHTML = '';
    const raw = (window.USER_FAVORITES && Array.isArray(window.USER_FAVORITES) && window.USER_FAVORITES.length)
      ? window.USER_FAVORITES
      : getFavorites();
    const favs = (function(f){ const out = Array.isArray(f) ? f.slice(0,8) : []; while(out.length<8) out.push({label:'',path:''}); out[0]={label:'Root Folder',path:''}; return out; })(raw);
    const hasSku = !!(currentSkuEl && currentSkuEl.value && currentSkuEl.value !== '(none)');
    favs.forEach((fav, idx) => {
      const row = document.createElement('div');
      row.className = 'fav';
      const key = document.createElement('div'); key.className = 'key'; key.textContent = (idx+1).toString();
      const btn = document.createElement('button');
      btn.className = 'btn';
      const labelText = idx === 0 ? 'Root Folder' : ((fav.label && fav.path) ? fav.label : '(empty)');
      btn.innerHTML = `<span class=\"label\">${labelText}</span>`;
      const slotEmpty = idx !== 0 && (!(fav.label && fav.label.trim()) || !(fav.path && fav.path.trim()));
      btn.disabled = !hasSku || slotEmpty;
      btn.addEventListener('click', () => openFavorite(idx));
      row.appendChild(key); row.appendChild(btn);
      favoritesEl.appendChild(row);
    });
  }

  // Ensure status text and classes reflect the actual connection state
  function updateStatusFromWindow() {
    if (!statusEl) return;
    const connected = !!window.WJN_CONNECTED;
    statusEl.classList.toggle('online', connected);
    statusEl.classList.toggle('offline', !connected);
    if (connected) {
      const email = (window.WJN_EMAIL && typeof window.WJN_EMAIL === 'string') ? window.WJN_EMAIL : '';
      statusEl.textContent = email ? `Online • ${email}` : 'Online';
    } else {
      statusEl.textContent = 'Offline';
    }
  }

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

  function escapeHtml(s){
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/\"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function highlightSkus(text){
    let out = escapeHtml(text);
    SKU_PATTERNS.forEach(re => {
      const rx = new RegExp(re.source, 'g');
      out = out.replace(rx, m => `<span class=\"sku-inline\">${escapeHtml(m)}</span>`);
    });
    return out;
  }

  // Simple sound system
  let _audioCtx = null;
  function getAudioCtx(){
    if (!_audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) _audioCtx = new Ctx();
    }
    return _audioCtx;
  }
  function playTone(freq=880, ms=120){
    const ctx = getAudioCtx();
    if (!ctx) return;
    try { ctx.resume && ctx.resume(); } catch(_) {}
    const o=ctx.createOscillator(); const g=ctx.createGain();
    o.type='sine'; o.frequency.value=freq; g.gain.value=0.05;
    o.connect(g); g.connect(ctx.destination);
    const now=ctx.currentTime; const end=now+ms/1000;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.05, now+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    o.start(now); o.stop(end+0.01);
  }
  function playSuccessChime(){
    // Two soft triangle notes for a more elegant chime
    const ctx = getAudioCtx(); if (!ctx) return;
    try { ctx.resume && ctx.resume(); } catch(_) {}
    const tone = (f, d, g=0.04) => {
      const o=ctx.createOscillator(), ga=ctx.createGain();
      o.type='triangle'; o.frequency.value=f; o.connect(ga); ga.connect(ctx.destination);
      const now=ctx.currentTime; const end=now+d/1000; ga.gain.setValueAtTime(0, now);
      ga.gain.linearRampToValueAtTime(g, now+0.02); ga.gain.exponentialRampToValueAtTime(0.0001, end);
      o.start(now); o.stop(end+0.01);
    };
    tone(660, 120, 0.035);
    setTimeout(() => tone(880, 120, 0.03), 90);
  }
    function getSettings(){
      try {
        if (window.USER_SETTINGS) return window.USER_SETTINGS;
        const raw = localStorage.getItem('wjn_settings');
        if (raw) return JSON.parse(raw);
      } catch {}
      return { sounds:true, auto_connect:false, auto_detect:true, auto_load_multiple:false, show_welcome_on_startup:true };
    }
  function play(kind){
    const s = getSettings();
    if (!s || s.sounds === false) return;
    if (kind==='success' || kind==='sku') return playSuccessChime();
    if (kind==='error') return playTone(220,200);
    if (kind==='warning') return playTone(500,140);
    if (kind==='hint') return playTone(760,120);
  }

  function log(line, cls) {
    const span = document.createElement('div');
    if (cls) span.className = 'line-' + cls;
    const timestamp = new Date().toLocaleTimeString();
    span.innerHTML = `[${timestamp}] ${highlightSkus(line)}`;
    consoleEl.appendChild(span);
    consoleEl.scrollTop = consoleEl.scrollHeight;
    // Play sounds based on class
    if (cls) {
      if (cls === 'success') play('success');
      else if (cls === 'error') play('error');
      else if (cls === 'warning') play('warning');
      else if (cls === 'hint') play('hint');
      else if (cls === 'sku') play('sku');
    }
    
    // Limit console to 100 lines
    while (consoleEl.children.length > 100) {
      consoleEl.removeChild(consoleEl.firstChild);
    }
  }

  function truncateSku(s, max=30) {
    if (!s) return s;
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

function setCurrentSku(sku) {
    const v = sku ? truncateSku(sku, 30) : '(none)';
    currentSkuEl.value = v;
    currentSkuEl.title = sku || '';
    try { currentSkuEl.dataset.fullSku = sku || ''; } catch (_) {}
    // Reflect current state into favorites enable/disable
    try { renderFavorites(); } catch (_) {}
    try { renderWorkingDisplay(); } catch(_) {}
  }

  function getCurrentSkuFull() {
    if (!currentSkuEl) return '';
    // Prefer stored full SKU over truncated value
    const ds = (currentSkuEl.dataset && currentSkuEl.dataset.fullSku) ? currentSkuEl.dataset.fullSku : '';
    return ds || currentSkuEl.title || ((currentSkuEl.value && currentSkuEl.value !== '(none)') ? currentSkuEl.value : '');
  }

  async function copyToClipboard(text) {
    if (!text) return false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}
    // Fallback method
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    } catch (_) { return false; }
  }

  function resetSkuContext() {
    // Clear any cached resolution/context to ensure a fresh environment for favorites
    try { window.WJN_LAST_RESOLVE = null; } catch (_) {}
    try { window.WJN_LAST_PATH = null; } catch (_) {}
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
      a.textContent = truncateSku(sku, 30);
      a.title = sku;
      a.className = 'link';
      a.addEventListener('click', async (e) => { e.preventDefault(); resetSkuContext(); setCurrentSku(sku); const copied = await copyToClipboard(sku); log((copied ? 'SKU selected and copied: ' : 'SKU selected (copy failed): ') + sku, 'sku'); });
      li.appendChild(a);
      recentsEl.appendChild(li);
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
    const sku = getCurrentSkuFull();
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
      
      // If multiple SKUs found, ask to add the rest to Recents (max 20)
      if (Array.isArray(result.matches) && result.matches.length > 1) {
        const additional = result.matches.slice(1);
        const n = Math.min(20, additional.length);
        const settings = getSettings();
        let proceed = false;
        if (settings.auto_load_multiple) {
          proceed = true;
        } else {
          proceed = confirm(`Found ${result.matches.length} SKUs. Add ${n} additional SKU(s) to Recents (max 20)?`);
        }
        if (proceed) {
          additional.slice(0, 20).forEach(m => addRecent(m.sku));
          try { await syncRecentsToServer(); } catch (_) {}
          log(`Added ${n} more SKU(s) to Recents.`, 'success');
        } else {
          log('Keeping only the first detected SKU.', 'info');
        }
      }

      // If configured, open root folder immediately on detect
      try {
        const s = getSettings();
        if (s.open_root_on_detect && window.WJN_CONNECTED) {
          await openFavorite(0);
        }
      } catch (_) {}
    } catch (error) {
      log('Error during clipboard scan: ' + error.message, 'error');
    }
  }

  function initKeys() {
    document.addEventListener('keydown', (e) => {
      // F1 opens Welcome
      if (e.key === 'F1') { e.preventDefault(); const w = document.getElementById('btnWelcome'); if (w) w.click(); return; }
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
      // Home key to open settings
      if (e.key === 'Home') { e.preventDefault(); openSettings(); return; }
      
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
        if (data.settings) {
          window.USER_SETTINGS = Object.assign({ sounds:true, auto_connect:false, auto_detect:true, auto_load_multiple:false, open_root_on_detect:false, show_welcome_on_startup:true, sku_suffix:'' }, data.settings);
          try { localStorage.setItem('wjn_settings', JSON.stringify(window.USER_SETTINGS)); } catch(_) {}
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

  async function syncRecentsToServer() {
    if (!window.WJN_CONNECTED) return;
    try {
      await fetch('user_api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'action=clear_recent_skus'
      });
      const arr = getRecents();
      // Add from oldest to newest so newest ends first after unshift
      for (let i = arr.length - 1; i >= 0; i--) {
        const sku = arr[i];
        await fetch('user_api.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `action=add_recent_sku&sku=${encodeURIComponent(sku)}`
        });
      }
    } catch (e) {
      console.log('Failed to sync recents to server:', e);
    }
  }

    function openSettings() {
    
    const modal = $('#settingsModal');
    const editor = $('#favoritesEditor');
    const optsBox = $('#settingsOptions');
    if (modal) {
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
    }
    if (editor) {
      editor.classList.add('favorites-editor');
    }
    
      // Populate options UI (static container)
      const settings = getSettings();
      if (optsBox) {
        const map = {
          opt_sounds: 'sounds',
          opt_auto_connect: 'auto_connect',
          opt_auto_detect: 'auto_detect',
          opt_auto_load_multiple: 'auto_load_multiple',
          opt_open_root_on_detect: 'open_root_on_detect',
          opt_show_welcome: 'show_welcome_on_startup'
        };
        Object.keys(map).forEach(id => {
          const el = document.getElementById(id);
          if (el) el.checked = !!settings[map[id]];
        });
      }

    // Populate favorites editor
    const normalize = (favs) => {
      const out = Array.isArray(favs) ? favs.slice(0,8) : [];
      while (out.length < 8) out.push({ label: '', path: '' });
      out[0] = { label: 'Root Folder', path: '' };
      return out;
    }
    const favorites = normalize(window.USER_FAVORITES || getFavorites());
    editor.innerHTML = '';

    // Header row
    const header = document.createElement('div');
    header.className = 'favorite-header';
    header.innerHTML = `<div></div><div>Label</div><div>Path relative to the SKU</div>`;
    editor.appendChild(header);

    favorites.forEach((fav, idx) => {
      const item = document.createElement('div');
      item.className = 'favorite-item' + (idx === 0 ? ' slot-first' : '');
      const isFirst = idx === 0;
      const labelVal = isFirst ? 'Root Folder' : (fav.label || '');
      const pathVal = isFirst ? 'Favorite 1 always points to the root folder.' : (fav.path || '');
      const labelDisabled = isFirst ? 'disabled' : '';
      const pathDisabled = isFirst ? 'disabled' : '';
      item.innerHTML = `
        <div class=\"key\">${idx + 1}</div>
        <input type=\"text\" placeholder=\"Label\" value=\"${labelVal}\" data-field=\"label\" data-index=\"${idx}\" ${labelDisabled}>
        <input type=\"text\" placeholder=\"Path\" value=\"${pathVal}\" data-field=\"path\" data-index=\"${idx}\" ${pathDisabled}>
      `;
      editor.appendChild(item);
    });
    
      // Show overlay and prevent background scroll/interactions
      modal.style.display = 'flex';
      document.body.classList.add('modal-open');

      // Initialize dirty tracking for Settings modal
      try { window._WJN_SETTINGS_DIRTY = false; } catch(_) {}
      const markDirty = () => { try { window._WJN_SETTINGS_DIRTY = true; } catch(_) {} };
      if (editor) {
        editor.addEventListener('input', markDirty);
        editor.addEventListener('change', markDirty);
      }
      // Track settings toggle changes
      ['opt_sounds','opt_auto_connect','opt_auto_detect','opt_auto_load_multiple'].forEach(id => {
        const el = document.getElementById(id); if (el) el.addEventListener('change', markDirty);
      });

    // Focus first input for quick editing
    const firstInput = editor.querySelector('input');
    if (firstInput) firstInput.focus();

    // Close on ESC
      const onEsc = (e) => { if (e.key === 'Escape') { e.preventDefault(); attemptCloseSettings(); } };
      document.addEventListener('keydown', onEsc);
      window._WJN_ESC_HANDLER = onEsc;
    }

    window.closeSettings = function() {
      const modal = $('#settingsModal');
      if (modal) {
        modal.style.display = 'none';
      }
      document.body.classList.remove('modal-open');
      if (window._WJN_ESC_HANDLER) {
        document.removeEventListener('keydown', window._WJN_ESC_HANDLER);
        window._WJN_ESC_HANDLER = null;
      }
    }

    // Attempt to close Settings, prompting to save if there are changes
    function attemptCloseSettings() {
      try {
        if (!window._WJN_SETTINGS_DIRTY) { closeSettings(); return; }
      } catch(_) { closeSettings(); return; }
      const save = confirm('Save settings changes before closing?');
      if (save) {
        try { saveFavorites(); } catch (e) { try { log('Error saving settings: ' + (e?.message||e), 'error'); } catch(_) {} }
      } else {
        // Keep editing; do nothing
      }
    }
    window.attemptCloseSettings = attemptCloseSettings;

  window.removeFavorite = function(idx) {
    const editor = $('#favoritesEditor');
    const items = editor.children;
    if (items[idx]) {
      items[idx].remove();
    }
  }

  async function saveFavorites() {
    const inputs = $$('#favoritesEditor input');
    // Gather settings toggles
      const settings = {
        sounds: !!$('#opt_sounds')?.checked,
        auto_connect: !!$('#opt_auto_connect')?.checked,
        auto_detect: !!$('#opt_auto_detect')?.checked,
        auto_load_multiple: !!$('#opt_auto_load_multiple')?.checked,
        open_root_on_detect: !!$('#opt_open_root_on_detect')?.checked,
        show_welcome_on_startup: !!$('#opt_show_welcome')?.checked,
      };
    await saveSettings(settings);
    const byIndex = {};
    inputs.forEach(input => {
      const index = parseInt(input.dataset.index);
      const field = input.dataset.field;
      if (!byIndex[index]) byIndex[index] = {};
      if (index === 0) {
        byIndex[index] = { label: 'Root Folder', path: '' };
      } else {
        byIndex[index][field] = (input.value || '').trim();
      }
    });

    // Validate and normalize to 8
    const favorites = [];
    for (let i = 0; i < 8; i++) {
      const fav = byIndex[i] || { label: '', path: '' };
      if (i === 0) { favorites.push({ label: 'Root Folder', path: '' }); continue; }
      const hasLabel = !!fav.label;
      const hasPath = !!fav.path;
      if ((hasLabel && !hasPath) || (!hasLabel && hasPath)) {
        alert(`Slot ${i+1}: both Label and Path must be provided, or both left empty.`);
        return;
      }
      favorites.push({ label: hasLabel ? fav.label : '', path: hasPath ? fav.path : '' });
    }
    
    try {
      const response = await fetch('user_api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `action=save_favorites&favorites=${encodeURIComponent(JSON.stringify(favorites))}`
      });
      
      const data = await response.json();
        if (data.success) {
          window.USER_FAVORITES = favorites;
          try { saveFavoritesToLocal(favorites); } catch (_) {}
          renderFavorites();
          try { window._WJN_SETTINGS_DIRTY = false; } catch (_) {}
          closeSettings();
          log('Favorites saved successfully.', 'success');
        } else {
        log('Failed to save favorites.', 'error');
      }
    } catch (error) {
      log('Error saving favorites: ' + error.message, 'error');
    }
  }

    async function saveSettings(settings){
      try {
        const current = (window.USER_SETTINGS) ? window.USER_SETTINGS : (function(){ try { return JSON.parse(localStorage.getItem('wjn_settings')||'{}'); } catch(_) { return {}; } })();
        const defaults = { sounds:true, auto_connect:false, auto_detect:true, auto_load_multiple:false, open_root_on_detect:false, show_welcome_on_startup:true, sku_suffix:'' };
        window.USER_SETTINGS = Object.assign({}, defaults, current || {}, settings || {});
        localStorage.setItem('wjn_settings', JSON.stringify(window.USER_SETTINGS));
        if (window.WJN_CONNECTED) {
          await fetch('user_api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `action=save_settings&settings=${encodeURIComponent(JSON.stringify(window.USER_SETTINGS))}`
          });
        }
      } catch (e) { console.log('Failed to save settings:', e); }
    }

  function resetToDefaults() {
    // Reset option toggles to defaults (sounds on, auto-detect on)
    const defaults = { sounds:true, auto_connect:false, auto_detect:true, auto_load_multiple:false };
    const map = {
      opt_sounds: 'sounds',
      opt_auto_connect: 'auto_connect',
      opt_auto_detect: 'auto_detect',
      opt_auto_load_multiple: 'auto_load_multiple'
    };
    Object.keys(map).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = !!defaults[map[id]];
    });

    // Reset favorites inputs (slot 1 fixed, others from DEFAULT_FAVORITES)
    const favs = DEFAULT_FAVORITES.slice(0,8);
    while (favs.length < 8) favs.push({label:'', path:''});
    for (let i=0;i<8;i++) {
      const labelInput = document.querySelector(`#favoritesEditor input[data-field="label"][data-index="${i}"]`);
      const pathInput  = document.querySelector(`#favoritesEditor input[data-field="path"][data-index="${i}"]`);
      if (!labelInput || !pathInput) continue;
      if (i === 0) {
        labelInput.value = 'Root Folder';
        pathInput.value = 'Number 1 always points to the root folder.';
      } else {
        labelInput.value = favs[i].label || '';
        pathInput.value  = favs[i].path || '';
      }
    }
  }

  function init() {
    renderFavorites();
    renderRecents();
    $('#btnClear').addEventListener('click', () => { consoleEl.innerHTML = ''; });
    $('#btnClipboard').addEventListener('click', handleClipboardScan);
    const btnSearchTop = $('#btnSearch'); if (btnSearchTop) btnSearchTop.addEventListener('click', handleClipboardScan);
    const btnSearchSku = $('#btnSearchSku'); if (btnSearchSku) btnSearchSku.addEventListener('click', handleClipboardScan);
    const settingsBtn = $('#btnSettings');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        console.log('Settings button clicked');
        openSettings();
      });
    } else {
      console.error('Settings button not found');
    }
    const settingsInlineBtn = $('#btnSettingsInline'); if (settingsInlineBtn) settingsInlineBtn.addEventListener('click', openSettings);
    const btnWelcome = $('#btnWelcome'); if (btnWelcome) btnWelcome.addEventListener('click', openWelcome);
    const btnAbout = $('#btnAbout'); if (btnAbout) btnAbout.addEventListener('click', openAbout);
      $('#btnClearRecents').addEventListener('click', clearRecents);
      $('#closeSettings').addEventListener('click', attemptCloseSettings);
      const cancelBtn = $('#cancelSettings'); if (cancelBtn) cancelBtn.addEventListener('click', closeSettings);
    $('#saveFavorites').addEventListener('click', saveFavorites);
    
      // Close modal when clicking outside (overlay)
      const overlay = $('#settingsModal');
      if (overlay) {
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            attemptCloseSettings();
          }
        });
      }
    const welcomeOverlay = $('#welcomeModal');
    if (welcomeOverlay) {
      welcomeOverlay.addEventListener('click', (e) => {});
    }
    const aboutOverlay = $('#aboutModal');
    if (aboutOverlay) {
      aboutOverlay.addEventListener('click', (e) => {});
    }
    
    // Update status based on connection state
    if (window.WJN_CONNECTED) {
      statusEl.classList.remove('offline');
      statusEl.classList.add('online');
      // Load user data when connected
      loadUserData();
      log('Connected to API.', 'success');
    } else {
      statusEl.classList.remove('online');
      statusEl.classList.add('offline');
      log('Not connected to API.', 'error');
    }
    
    initKeys();
    
    // Bind reset-to-defaults
    const btnReset = $('#resetFavorites'); if (btnReset) btnReset.addEventListener('click', resetToDefaults);

    // Adjust console height after DOM is fully loaded
    setTimeout(adjustConsoleHeight, 100);
    
    // Re-adjust on window resize
    window.addEventListener('resize', adjustConsoleHeight);
    
    log('Copy a SKU (Vendor-ID) to the clipboard and click Search or press F9.', 'hint');

      // Restore working folder and suffix, and wire events
      restoreWorkingFolder();
      if (skuSuffixInput) {
        try { skuSuffixInput.value = getSuffix(); } catch(_) {}
        skuSuffixInput.addEventListener('input', () => { renderWorkingDisplay(); });
        skuSuffixInput.addEventListener('blur', () => { saveSuffix(skuSuffixInput.value || ''); });
      }
      if (chooseWorkingFolderBtn) chooseWorkingFolderBtn.addEventListener('click', chooseWorkingFolder);
      if (btnCreateSkuFolder) btnCreateSkuFolder.addEventListener('click', createSkuFolder);

    // Auto actions based on settings
    const settings = getSettings();
    if (!window.WJN_CONNECTED && settings.auto_connect) {
      setTimeout(() => { window.location.href = 'auth.php'; }, 300);
      return; // page will navigate
    }
    if (settings.auto_detect) {
      setTimeout(() => { handleClipboardScan(); }, 600);
    }
  }

  // Allow plain number keys 1..8 to open favorites when not typing
  document.addEventListener('keydown', (e) => {
    if (!isTextInputFocused() && !e.ctrlKey && !e.metaKey && !e.altKey && /^[1-8]$/.test(e.key)) {
      e.preventDefault();
      try { openFavorite(parseInt(e.key, 10) - 1); } catch (_) {}
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    try { updateStatusFromWindow(); } catch (_) {}
    init();
    // Auto show Welcome if configured
    try { const s = getSettings(); if (s.show_welcome_on_startup) openWelcome(); } catch(_) {}
  });

  // ----------------- Welcome / About -----------------
  let WELCOME_STATE = { idx: 0, total: 0, loaded: false };

  function buildWelcomeSlides() {
    const container = document.getElementById('welcomeSlides');
    if (!container) return;
    container.innerHTML = '';
    const imgs = [];
    // Try welcome1..welcome10
    const tryCount = 10;
    let toLoad = 0; let loaded = 0;
    for (let i = 1; i <= tryCount; i++) {
      const img = new Image();
      img.alt = `Welcome ${i}`;
      img.className = '';
      img.onload = () => {
        container.appendChild(img);
        imgs.push(img);
        loaded++;
        if (loaded === toLoad) finish();
      };
      img.onerror = () => { /* skip missing */ };
      img.src = `welcome/welcome${i}.png`;
      toLoad++;
    }
    function finish() {
      WELCOME_STATE.total = imgs.length;
      WELCOME_STATE.idx = 0;
      imgs.forEach((im, idx) => { if (idx === 0) im.classList.add('active'); });
      updateWelcomePager();
      updateWelcomeTextAndInline();
      WELCOME_STATE.loaded = true;
    }
  }

  function updateWelcomePager() {
    const pager = document.getElementById('welcomePager');
    if (!pager) return;
    const t = WELCOME_STATE.total || 1;
    pager.textContent = `${Math.min(WELCOME_STATE.idx + 1, t)} / ${t}`;
  }

  const WELCOME_TEXT = [
    {
      title: 'Welcome to Sofa Jobs Navigator — Web',
      body: 'Copy any Vendor-ID or SKU and press F9 (Search). The app scans your clipboard and detects SKUs. The browser-based flow avoids sync conflicts and is fast and reliable.' ,
      inline: function() {
        const s = getSettings();
        return `
          <div class=\"settings-options\">
            <label><input type=\"checkbox\" id=\"w1_connect_on_startup\" ${s.auto_connect?'checked':''}> Connect on Startup</label>
            <button id=\"w1_connect\" class=\"btn btn-primary\">Connect</button>
          </div>`;
      }
    },
    {
      title: 'Copy once, detect many',
      body: 'Copy large texts from anywhere — file names, emails, web pages — and press F9. All SKUs are detected; the first valid becomes your CURRENT SKU so you can act immediately.',
      inline: function(){ const s=getSettings(); return `<label><input type=\"checkbox\" id=\"w2_auto_detect\" ${s.auto_detect?'checked':''}> Auto-search clipboard after connect</label>`; }
    },
    {
      title: 'Open the right remote folder instantly',
      body: 'With a CURRENT SKU set, a click or hotkey jumps straight to its Google Drive folder or a mapped subfolder. Use F1–F8 or the sidebar favorites.',
      inline: function(){ const s=getSettings(); return `<label><input type=\"checkbox\" id=\"w3_open_root\" ${s.open_root_on_detect?'checked':''}> Open root folder on SKU found</label>`; }
    },
    {
      title: 'Per-SKU Favorites',
      body: 'Configure per-SKU favorites (F1–F8) for your most used remote folders. Standardize structure and eliminate repetitive navigation.',
      inline: function(){ return `<button id=\"w4_set_favorites\" class=\"btn\">Set Favorites</button>`; }
    },
    {
      title: 'Recent SKUs one tap away',
      body: 'The side panel keeps your latest SKUs. Click to reuse them; tooltips show full values. You can load multiple SKUs at once to Recents and cycle quickly.',
      inline: function(){ const s=getSettings(); return `<label><input type=\"checkbox\" id=\"w5_auto_multi\" ${s.auto_load_multiple?'checked':''}> Auto-load multiple SKUs (no prompt)</label>`; }
    },
    {
      title: 'All done',
      body: 'Good to go! You can change preferences later in Settings (Home key).',
      inline: function(){ const s=getSettings(); return `
        <div class=\"settings-options\">
          <label><input type=\"checkbox\" id=\"w6_sounds\" ${s.sounds?'checked':''}> Sounds On</label>
          <label><input type=\"checkbox\" id=\"w6_show\" ${s.show_welcome_on_startup?'checked':''}> Show Welcome Window on Startup</label>
        </div>`; }
    }
  ];

  function updateWelcomeTextAndInline() {
    const text = document.getElementById('welcomeText');
    const inline = document.getElementById('welcomeInlineOptions');
    const nextBtn = document.getElementById('welcomeNext');
    const prevBtn = document.getElementById('welcomePrev');
    if (!text || !inline) return;
    const data = WELCOME_TEXT[Math.min(WELCOME_STATE.idx, WELCOME_TEXT.length-1)] || WELCOME_TEXT[0];
    text.innerHTML = `<h4>${data.title}</h4><p>${data.body}</p>`;
    inline.innerHTML = data.inline ? data.inline() : '';
    if (WELCOME_STATE.idx === 0 && !window.WJN_CONNECTED) {
      const b = document.getElementById('w1_connect'); if (b) b.onclick = () => { window.location.href = 'auth.php'; };
    }
    const favBtn = document.getElementById('w4_set_favorites'); if (favBtn) favBtn.onclick = openSettings;
    if (nextBtn) nextBtn.textContent = (WELCOME_STATE.idx >= WELCOME_TEXT.length-1) ? 'Finish ▶' : 'Next ▶';
    if (prevBtn) prevBtn.disabled = (WELCOME_STATE.idx <= 0);
  }

  function handleWelcomeNext(){
    // Apply inline state for the current slide
    const i = WELCOME_STATE.idx;
    const s = getSettings();
    const patch = {};
    if (i === 0) patch.auto_connect = !!document.getElementById('w1_connect_on_startup')?.checked;
    if (i === 1) patch.auto_detect = !!document.getElementById('w2_auto_detect')?.checked;
    if (i === 2) patch.open_root_on_detect = !!document.getElementById('w3_open_root')?.checked;
    if (i === 4) patch.auto_load_multiple = !!document.getElementById('w5_auto_multi')?.checked;
    if (i === 5) {
      patch.sounds = !!document.getElementById('w6_sounds')?.checked;
      patch.show_welcome_on_startup = !!document.getElementById('w6_show')?.checked;
    }
    if (Object.keys(patch).length) saveSettings(Object.assign({}, s, patch));
    if (WELCOME_STATE.idx >= WELCOME_TEXT.length-1) { closeWelcome(); return; }
    nextWelcome();
  }

  function setWelcomeSlide(n) {
    const container = document.getElementById('welcomeSlides');
    if (!container) return;
    const imgs = Array.from(container.querySelectorAll('img'));
    if (!imgs.length) return;
    const total = imgs.length;
    WELCOME_STATE.idx = (n + total) % total;
    imgs.forEach((im, i) => { im.classList.toggle('active', i === WELCOME_STATE.idx); });
    updateWelcomePager();
    updateWelcomeTextAndInline();
  }

  function nextWelcome() { setWelcomeSlide(WELCOME_STATE.idx + 1); }
  function prevWelcome() { setWelcomeSlide(WELCOME_STATE.idx - 1); }

  function syncWelcomeOptionsFromSettings() {
    const s = getSettings();
    const map = [
      ['w_opt_sounds', 'sounds'],
      ['w_opt_auto_connect', 'auto_connect'],
      ['w_opt_auto_detect', 'auto_detect'],
      ['w_opt_auto_load_multiple', 'auto_load_multiple'],
    ];
    map.forEach(([id, key]) => { const el = document.getElementById(id); if (el) el.checked = !!s[key]; });
  }

  function applyWelcomeOptions() {
    const settings = {
      sounds: !!document.getElementById('w_opt_sounds')?.checked,
      auto_connect: !!document.getElementById('w_opt_auto_connect')?.checked,
      auto_detect: !!document.getElementById('w_opt_auto_detect')?.checked,
      auto_load_multiple: !!document.getElementById('w_opt_auto_load_multiple')?.checked,
    };
    saveSettings(settings);
    // Also reflect into Settings modal if present
    const pairs = [
      ['opt_sounds','w_opt_sounds'],
      ['opt_auto_connect','w_opt_auto_connect'],
      ['opt_auto_detect','w_opt_auto_detect'],
      ['opt_auto_load_multiple','w_opt_auto_load_multiple'],
    ];
    pairs.forEach(([a,b]) => { const t=document.getElementById(a), s=document.getElementById(b); if (t && s) t.checked = s.checked; });
  }

    // New Welcome Wizard implementation
    const WZ_CONFIG = (() => {
      const footerVer = (document.querySelector('.version')?.textContent || '').trim();
      const ver = footerVer.replace(/^v\s*/i, '').trim() || '';
      const texts = [
        `Welcome to Sofa Jobs Navigator® – ${ver}.\n\nCopy any Vendor-ID (SKU), press F9, and jump straight to the correct Google Drive folder. Work directly in your browser and avoid sync conflicts, forced app updates, cache corruption, disk space issues, and crashes. The browser is reliable, consistent, and instant.`,
        `Copy once, detect many.\n\nCopy large texts from anywhere — file names, folder names, emails, web pages, chats — and press F9. The app scans your clipboard and detects all SKUs. The first valid one becomes your 'CURRENT SKU' so you can act immediately, without pasting or retyping.`,
        `Open the right remote folder instantly.\n\nWith a 'CURRENT SKU' set, a click (or hotkey) jumps straight to its Google Drive folder or a mapped subfolder. Press 1-8 on your keyboard, or click sidebar buttons for fast, repeatable navigation—going from Vendor-ID to working context in seconds.`,
        `Save time with Favorites.\n\nConfigure per-SKU favorites (1–8) pointing at your most-used remote folders. Standardize structure and eliminate repetitive wandering through deep paths.`,
        `Recent SKUs one tap away.\n\nThe side panel keeps the last SKUs you touched. Click to copy or reuse them—tooltips show full values. You can detect and load up to 20 SKUs at once to the recents panel, and cycle through multiple SKUs quickly while tracking parallel work.`,
        `Create a local folder named “SKU + suffix.”\n\nGenerate a consistently named local folder in one step. Clean, predictable naming helps keep local workspaces tidy.`,
        `Good to go!\n\nIf you wish to change your preferences later, just press "Home".\nClick Finish to save your choices and begin working.`,
      ];
      return [
        { img: 'welcome/welcome1.png', text: texts[0], key: 'auto_connect', build: (c) => {
            const rowTop = document.createElement('div'); rowTop.className='row';
            const p = document.createElement('div'); p.textContent = 'To begin, we must connect to Google Drive.'; p.style.textAlign='center'; p.style.marginBottom='8px'; p.style.color='var(--text)';
            const btn = document.createElement('button'); btn.className='btn btn-primary'; btn.textContent='Connect'; btn.onclick = ()=>{ window.location.href='auth.php'; };
            rowTop.appendChild(btn);
            const rowChk = document.createElement('div'); rowChk.className='row';
            const lb = document.createElement('label');
            const cb = document.createElement('input'); cb.type='checkbox'; cb.id='wz_auto_connect'; cb.checked=!!getSettings().auto_connect; lb.appendChild(cb); lb.appendChild(document.createTextNode('Connect on startup'));
            rowChk.appendChild(lb);
            c.appendChild(p); c.appendChild(rowTop); c.appendChild(rowChk);
          } },
        { img: 'welcome/welcome2.png', text: texts[1], key: 'auto_detect', build: (c)=>{
            const lb=document.createElement('label'); const cb=document.createElement('input'); cb.type='checkbox'; cb.id='wz_auto_detect'; cb.checked=!!getSettings().auto_detect; lb.appendChild(cb); lb.appendChild(document.createTextNode('Auto-search clipboard after connect')); c.appendChild(lb);
          } },
        { img: 'welcome/welcome3.png', text: texts[2], key: 'open_root_on_detect', build: (c)=>{
            const lb=document.createElement('label'); const cb=document.createElement('input'); cb.type='checkbox'; cb.id='wz_open_root'; cb.checked=!!getSettings().open_root_on_detect; lb.appendChild(cb); lb.appendChild(document.createTextNode('Open root folder on SKU found')); c.appendChild(lb);
          } },
        { img: 'welcome/welcome4.png', text: texts[3], key: null, build: (c)=>{
            const p=document.createElement('div'); p.style.textAlign='center'; p.style.color='var(--muted)'; p.textContent="You can set your favorite shortcuts by clicking 'Settings' or pressing 'Home'."; c.appendChild(p);
          } },
        { img: 'welcome/welcome5.png', text: texts[4], key: 'auto_load_multiple', build: (c)=>{
            const lb=document.createElement('label'); const cb=document.createElement('input'); cb.type='checkbox'; cb.id='wz_auto_multi'; cb.checked=!!getSettings().auto_load_multiple; lb.appendChild(cb); lb.appendChild(document.createTextNode('Auto-load multiple SKUs (no prompt)')); c.appendChild(lb);
          } },
        { img: 'welcome/welcome6.png', text: texts[5], key: null, build: (c)=>{
            const row=document.createElement('div'); row.className='row';
            const inp=document.createElement('input'); inp.type='text'; inp.id='wz_working_input'; inp.readOnly=true; inp.placeholder='Choose your working folder'; inp.value = (typeof WJN_WORKDIR_LABEL==='string' && WJN_WORKDIR_LABEL) ? WJN_WORKDIR_LABEL : '';
            const btn=document.createElement('button'); btn.className='btn'; btn.id='wz_choose_working'; btn.textContent='Choose'; btn.onclick = async()=>{ await chooseWorkingFolder(); const t=document.getElementById('wz_working_input'); if (t) t.value=WJN_WORKDIR_LABEL||''; };
            row.appendChild(inp); row.appendChild(btn); c.appendChild(row);
          } },
        { img: 'welcome/welcome7.png', text: texts[6], key: 'sounds', build: (c)=>{
            const lb=document.createElement('label'); const cb=document.createElement('input'); cb.type='checkbox'; cb.id='wz_sounds'; cb.checked=(getSettings().sounds!==false); lb.appendChild(cb); lb.appendChild(document.createTextNode('Sounds On'));
            const lb2=document.createElement('label'); const cb2=document.createElement('input'); cb2.type='checkbox'; cb2.id='wz_show_welcome';
            // Suggestion: unchecked by default on page 7, regardless of current settings
            cb2.checked = false;
            lb2.appendChild(cb2); lb2.appendChild(document.createTextNode('Show Welcome on Startup'));
            const tip=document.createElement('div'); tip.className='wz-tip'; tip.innerHTML='💡 Tip: press F1 anytime to reopen this wizard.';
            c.appendChild(lb); c.appendChild(lb2); c.appendChild(tip);
          } },
      ];
    })();

    let WZ_STATE = { idx: 0 };

    function wzApplyCurrentPage() {
      const idx = WZ_STATE.idx;
      const conf = WZ_CONFIG[idx];
      const patch = {};
      if (idx === 0) { patch.auto_connect = !!document.getElementById('wz_auto_connect')?.checked; }
      if (idx === 1) { patch.auto_detect = !!document.getElementById('wz_auto_detect')?.checked; }
      if (idx === 2) { patch.open_root_on_detect = !!document.getElementById('wz_open_root')?.checked; }
      if (idx === 4) { patch.auto_load_multiple = !!document.getElementById('wz_auto_multi')?.checked; }
      if (idx === 6) {
        patch.sounds = !!document.getElementById('wz_sounds')?.checked;
        patch.show_welcome_on_startup = !!document.getElementById('wz_show_welcome')?.checked;
      }
      if (Object.keys(patch).length) {
        saveSettings(Object.assign({}, getSettings(), patch));
        // Reflect into Settings modal if open
        try {
          if ('auto_connect' in patch) { const el=document.getElementById('opt_auto_connect'); if (el) el.checked=!!patch.auto_connect; }
          if ('auto_detect' in patch) { const el=document.getElementById('opt_auto_detect'); if (el) el.checked=!!patch.auto_detect; }
          if ('open_root_on_detect' in patch) { const el=document.getElementById('opt_open_root_on_detect'); if (el) el.checked=!!patch.open_root_on_detect; }
          if ('auto_load_multiple' in patch) { const el=document.getElementById('opt_auto_load_multiple'); if (el) el.checked=!!patch.auto_load_multiple; }
          if ('sounds' in patch) { const el=document.getElementById('opt_sounds'); if (el) el.checked=!!patch.sounds; }
          if ('show_welcome_on_startup' in patch) { const el=document.getElementById('opt_show_welcome'); if (el) el.checked=!!patch.show_welcome_on_startup; }
        } catch(_) {}
      }
    }

    function wzRender() {
      const idx = WZ_STATE.idx;
      const conf = WZ_CONFIG[idx];
      const imgBox = document.getElementById('wzImage');
      const txtBox = document.getElementById('wzText');
      const ctr = document.getElementById('wzControls');
      const prevBtn = document.getElementById('wzPrev');
      const nextBtn = document.getElementById('wzNext');
      if (!imgBox || !txtBox || !ctr || !prevBtn || !nextBtn) return;
      // content
      imgBox.innerHTML = `<img alt="Welcome ${idx+1}" src="${conf.img}" />`;
      txtBox.textContent = conf.text;
      ctr.innerHTML=''; conf.build(ctr);
      // dots
      const dots = document.getElementById('wzDots');
      if (dots) {
        dots.innerHTML = '';
        for (let i=0;i<WZ_CONFIG.length;i++) {
          const d=document.createElement('div'); d.className='wz-dot'+(i===idx?' active':''); dots.appendChild(d);
        }
      }
      prevBtn.disabled = (idx === 0);
      nextBtn.textContent = (idx === WZ_CONFIG.length - 1) ? 'Finish' : 'Next';
    }

    async function wzCanProceed() {
      // Page 1 -> 2: require connection (or confirm skip)
      if (WZ_STATE.idx === 0) {
        if (!window.WJN_CONNECTED) {
          const msg = "You are not connected to Google Drive. You won't be able to search remote folders until you connect.\n\nProceed without connecting now? You can press Home later to open Settings and connect.";
          const proceed = confirm(msg);
          if (!proceed) return false;
        }
      }
      // Page 6 -> 7: warn if no working folder, then proceed
      if (WZ_STATE.idx === 5) {
        if (!WJN_WORKDIR_HANDLE) {
          alert("Without a Working Folder you won't be able to create SKU folders in one click.\n\nYou can press Home later to open Settings and configure it.");
        }
      }
      return true;
    }

    function openWelcome() {
      const modal = document.getElementById('welcomeModal');
      if (!modal) return;
      modal.style.display = 'flex';
      document.body.classList.add('modal-open');
      WZ_STATE.idx = 0;
      // wire actions
      const prevBtn = document.getElementById('wzPrev');
      const nextBtn = document.getElementById('wzNext');
      const closeBtn = document.getElementById('closeWelcome');
      if (prevBtn) prevBtn.onclick = ()=>{ WZ_STATE.idx=Math.max(0, WZ_STATE.idx-1); wzRender(); };
      if (nextBtn) nextBtn.onclick = async ()=>{
        const ok = await wzCanProceed();
        if (!ok) return; // stay on current page
        wzApplyCurrentPage();
        if (WZ_STATE.idx < WZ_CONFIG.length-1) { WZ_STATE.idx++; wzRender(); } else { closeWelcome(); }
      };
      if (closeBtn) closeBtn.onclick = attemptCloseWelcome;
      // overlay dismiss
      modal.addEventListener('click', (e)=>{ if (e.target===modal) attemptCloseWelcome(); });
      // esc to close
      const onEsc = (e)=>{ if (e.key==='Escape') { e.preventDefault(); attemptCloseWelcome(); } };
      document.addEventListener('keydown', onEsc);
      window._WJN_WZ_ESC = onEsc;
      wzRender();
    }
    function closeWelcome() {
      const modal = document.getElementById('welcomeModal');
      if (!modal) return;
      modal.style.display = 'none';
      document.body.classList.remove('modal-open');
      if (window._WJN_WZ_ESC) { document.removeEventListener('keydown', window._WJN_WZ_ESC); window._WJN_WZ_ESC=null; }
    }
    function attemptCloseWelcome() {
      if (confirm('Do you want to cancel the setup? You can click \"Settings\" later, or press \"F1\" to open this wizard.')) {
        closeWelcome();
      }
    }

    function openAbout() {
      const modal = document.getElementById('aboutModal');
      if (!modal) return;
      const verEl = document.getElementById('aboutVer');
      try { if (verEl) verEl.textContent = (document.querySelector('.statusbar .version')?.textContent || '').trim(); } catch(_) {}
      modal.style.display = 'flex';
      document.body.classList.add('modal-open');
      const close = document.getElementById('closeAbout'); if (close) close.onclick = closeAbout;
      const close2 = document.getElementById('aboutCloseBtn'); if (close2) close2.onclick = closeAbout;
    }
  function closeAbout() {
    const modal = document.getElementById('aboutModal');
    if (!modal) return;
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
  }
})();
