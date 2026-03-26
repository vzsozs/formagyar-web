/* ============================================================
   script.js – Teljes fájlkezelő logika
   Javítások: törött zárójel (ctxBtnNewTab), letöltésszámláló,
              képlapozó, maximize gomb minden viewer ablakhoz
   ============================================================ */

// ============================================================
// DOM REFERENCIÁK
// ============================================================
const readyScreen   = document.getElementById('ready-screen');
const mainPanel     = document.getElementById('main-panel');
const btnYes        = document.getElementById('btn-yes');
const btnNo         = document.getElementById('btn-no');
const fileListWrap  = document.getElementById('file-list-wrap');
const breadcrumbBar = document.getElementById('breadcrumb-bar');
const statusCount   = document.getElementById('statusbar-count');
const panelTitle    = document.getElementById('panel-title');

// ============================================================
// ÁLLAPOT
// ============================================================
let currentPath   = '';
let selectedIndex = 0;
let currentItems  = [];

// ============================================================
// LETÖLTÉSSZÁMLÁLÓ – localStorage-ban tárolva
// Kulcs: "dlcount:<relatív/fájlútvonal>"
// ============================================================
function dlKey(filePath)       { return `dlcount:${filePath}`; }
function getDlCount(filePath)  { return parseInt(localStorage.getItem(dlKey(filePath)) || '0', 10); }
function incDlCount(filePath)  {
  const n = getDlCount(filePath) + 1;
  localStorage.setItem(dlKey(filePath), String(n));
  return n;
}

// ============================================================
// BOOT SZEKVENCIA
// ============================================================
const wait = ms => new Promise(r => setTimeout(r, ms));

async function typeWriter(el, text, speed = 55) {
  el.textContent = '';
  for (const ch of text) { el.textContent += ch; await wait(speed); }
}

function showLogLine(el) {
  el.style.opacity = '0';
  el.classList.add('log-fadein');
  el.style.opacity = '';
}

async function animateProgress(barEl, durationMs) {
  const steps = 40, stepMs = durationMs / steps, stepPct = 100 / steps;
  for (let i = 1; i <= steps; i++) { barEl.style.width = `${i * stepPct}%`; await wait(stepMs); }
}

async function runBootSequence() {
  const readyLabel   = document.getElementById('ready-label');
  const readyCursor  = document.getElementById('ready-cursor');
  const logBios      = document.getElementById('log-bios');
  const logLoading   = document.getElementById('log-loading');
  const progressWrap = document.getElementById('progress-wrap');
  const progressBar  = document.getElementById('progress-bar');
  const logOk        = document.getElementById('log-ok');
  const logAwait     = document.getElementById('log-await');
  const readyButtons = document.getElementById('ready-buttons');

  logBios.style.opacity = '0'; logLoading.style.opacity = '0';
  await wait(620);

  readyCursor.classList.remove('blinking');
  await typeWriter(readyLabel, 'Ready?', 60);
  readyCursor.classList.add('blinking');

  await wait(300);
  showLogLine(logBios);
  await wait(700);

  progressWrap.style.display = 'none';
  logOk.style.display = 'none';
  showLogLine(logLoading);
  await wait(400);

  progressWrap.style.display = 'inline-block';
  await animateProgress(progressBar, 1400);

  progressWrap.style.display = 'none';
  logOk.style.display = 'inline';
  await wait(350);

  showLogLine(logAwait);
  await wait(400);

  readyButtons.style.opacity = '1';
  readyButtons.style.pointerEvents = 'auto';
}

runBootSequence();

// ============================================================
// [Y] / [N] GOMBOK
// ============================================================
btnYes.addEventListener('click', () => {
  readyScreen.classList.add('crt-off');
  readyScreen.addEventListener('animationend', () => {
    readyScreen.classList.add('hidden');
    mainPanel.classList.remove('hidden');
    document.body.style.overflow = 'auto';
    loadDirectory('');
  }, { once: true });
});

btnNo.addEventListener('click', () => {
  const logAwait = document.getElementById('log-await');
  if (!logAwait) return;
  logAwait.style.color = 'var(--orange)';
  logAwait.style.textShadow = '0 0 8px var(--orange)';
  logAwait.textContent = '> HOZZÁFÉRÉS MEGTAGADVA. Újrapróbálkozás...';
  setTimeout(() => {
    logAwait.style.color = '';
    logAwait.style.textShadow = '';
    logAwait.textContent = 'AWAITING USER INPUT';
  }, 1500);
});

document.addEventListener('keydown', (e) => {
  if (!readyScreen.classList.contains('hidden')) {
    if (e.key === 'y' || e.key === 'Y') btnYes.click();
    if (e.key === 'n' || e.key === 'N') btnNo.click();
  }
});

// ============================================================
// FÁJLIKON
// ============================================================
function getIcon(type) {
  const icons = {
    dir:  { label: '[DIR]', cls: 'icon-dir'  },
    md:   { label: '[MD] ', cls: 'icon-md'   },
    img:  { label: '[IMG]', cls: 'icon-img'  },
    yt:   { label: '[YT] ', cls: 'icon-yt'   },
    txt:  { label: '[TXT]', cls: 'icon-txt'  },
    json: { label: '[JSN]', cls: 'icon-file' },
    js:   { label: '[JS] ', cls: 'icon-file' },
    css:  { label: '[CSS]', cls: 'icon-file' },
    html: { label: '[HTM]', cls: 'icon-file' },
    pdf:  { label: '[PDF]', cls: 'icon-file' },
  };
  return icons[type] || { label: '[---]', cls: 'icon-file' };
}

// ============================================================
// FÁJLLISTA BETÖLTÉSE
// ============================================================
async function loadDirectory(path) {
  const previousPath = currentPath;
  currentPath = path;
  if (typeof updateCliPrefix === 'function') updateCliPrefix();

  fileListWrap.innerHTML = '<div class="loading-row">&gt; Mappa olvasása</div>';
  statusCount.textContent = 'Betöltés...';
  renderBreadcrumb(path);

  let data;
  try {
    const res = await fetch(`/api/files?path=${encodeURIComponent(path || '.')}`);
    if (res.status === 401) {
      const body = await res.json();
      currentPath = previousPath;
      renderBreadcrumb(previousPath);
      showPasswordDialog(body.protectedRoot, () => loadDirectory(path));
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    fileListWrap.innerHTML = `<div class="error-state">> HIBA: ${err.message}</div>`;
    statusCount.textContent = 'Hiba.';
    return;
  }

  currentItems = data.items;
  selectedIndex = 0;
  renderFileList(data.items);
  renderBreadcrumb(data.path);
  updateStatusBar(data.items);
}

// ============================================================
// FÁJLLISTA RENDERELÉSE – letöltésszámláló oszloppal
// ============================================================
function renderFileList(items) {
  if (items.length === 0) {
    fileListWrap.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">□</span>
        A mappa üres.<br>
        <span style="font-size:7px;color:var(--dim)">Hozz létre fájlokat a public/data mappában.</span>
      </div>`;
    return;
  }

  fileListWrap.innerHTML = items.map((item, idx) => {
    const icon     = getIcon(item.type);
    const filePath = currentPath ? `${currentPath}/${item.name}` : item.name;
    const dlCount  = item.isDir ? '—' : getDlCount(filePath);

    return `
      <div
        class="file-row${idx === 0 ? ' selected' : ''}"
        data-index="${idx}"
        data-type="${item.type}"
        data-name="${escapeAttr(item.name)}"
        data-isdir="${item.isDir}"
        data-locked="${item.locked ? 'true' : 'false'}"
        role="listitem"
        tabindex="0"
        aria-label="${item.name}${item.locked ? ' (védett)' : ''}"
      >
        <span class="col-icon ${icon.cls}">${icon.label}</span>
        <span class="col-name">
          <span class="col-name-text" title="${escapeAttr(item.name)}">${escapeHtml(item.name)}</span>
        </span>
        <span class="col-size">${item.size ?? '—'}</span>
        <span class="col-dl" title="Letöltések száma">${dlCount}</span>
        <span class="col-date">${item.modified ?? ''}</span>
      </div>`;
  }).join('');

  fileListWrap.querySelectorAll('.file-row').forEach(row => {
    row.addEventListener('click',    () => selectRow(parseInt(row.dataset.index)));
    row.addEventListener('dblclick', () => openItem(parseInt(row.dataset.index)));
  });
}

// ============================================================
// BREADCRUMB
// ============================================================
function renderBreadcrumb(path) {
  const parts = path ? path.split('/').filter(Boolean) : [];

  let html = `<span class="breadcrumb-item${parts.length === 0 ? ' active' : ''}"
    data-path="" title="Gyökér mappa">~/data</span>`;

  parts.forEach((part, i) => {
    const subPath = parts.slice(0, i + 1).join('/');
    const isLast  = i === parts.length - 1;
    html += `<span class="breadcrumb-sep">/</span>`;
    html += `<span class="breadcrumb-item${isLast ? ' active' : ''}"
      data-path="${escapeAttr(subPath)}">${escapeHtml(part)}</span>`;
  });

  breadcrumbBar.innerHTML = html;
  breadcrumbBar.querySelectorAll('.breadcrumb-item:not(.active)').forEach(el => {
    el.addEventListener('click', () => loadDirectory(el.dataset.path));
  });
}

// ============================================================
// ÁLLAPOTSOR
// ============================================================
function updateStatusBar(items) {
  const dirs  = items.filter(i => i.isDir).length;
  const files = items.filter(i => !i.isDir).length;
  statusCount.textContent = `${dirs} mappa, ${files} fájl`;
}

// ============================================================
// SOR KIJELÖLÉSE
// ============================================================
function selectRow(index) {
  const prev = fileListWrap.querySelector('.file-row.selected');
  if (prev) prev.classList.remove('selected');

  selectedIndex = Math.max(0, Math.min(index, currentItems.length - 1));
  const next = fileListWrap.querySelector(`[data-index="${selectedIndex}"]`);
  if (next) { next.classList.add('selected'); next.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
}

// ============================================================
// ELEM MEGNYITÁSA
// ============================================================
function openItem(index) {
  const item = currentItems[index];
  if (!item) return;

  if (item.isDir) {
    loadDirectory(currentPath ? `${currentPath}/${item.name}` : item.name);
  } else if (item.type === 'md') {
    openMarkdown(item);
  } else if (item.type === 'yt') {
    openYouTube(item);
  } else if (item.type === 'img') {
    const imgItems = currentItems.filter(i => i.type === 'img');
    openImage(item, imgItems);
  } else if (['txt', 'json', 'js', 'css', 'html'].includes(item.type)) {
    openTextFile(item);
  } else if (item.type === 'pdf') {
    const rel = currentPath ? `${currentPath}/${item.name}` : item.name;
    window.open(`/data/${rel}`, '_blank', 'noopener,noreferrer');
  }
}

// ============================================================
// VIEWER MODAL – megnyitás, bezárás, maximize
// ============================================================
const viewerOverlay = document.getElementById('viewer-overlay');
const viewerBox     = document.getElementById('viewer-box');
const viewerTitle   = document.getElementById('viewer-title');
const viewerContent = document.getElementById('viewer-content');
const viewerClose   = document.getElementById('viewer-close');

// Maximize gomb dinamikusan létrehozva a viewer header-ben
let viewerMaxBtn = document.getElementById('viewer-maximize');
if (!viewerMaxBtn) {
  viewerMaxBtn = document.createElement('button');
  viewerMaxBtn.id        = 'viewer-maximize';
  viewerMaxBtn.className = 'viewer-maximize';
  viewerMaxBtn.title     = 'Teljes méret / visszaállítás';
  viewerMaxBtn.setAttribute('aria-label', 'Méretváltás');
  viewerMaxBtn.textContent = '[ ⛶ ]';
  viewerClose.parentNode.insertBefore(viewerMaxBtn, viewerClose);
}

let isViewerMaximized = false;

viewerMaxBtn.addEventListener('click', () => {
  isViewerMaximized = !isViewerMaximized;
  viewerBox.classList.toggle('viewer-maximized', isViewerMaximized);
  viewerMaxBtn.textContent = isViewerMaximized ? '[ ⊡ ]' : '[ ⛶ ]';
});

function openViewer(title, contentHtml, extraClass = '') {
  viewerTitle.textContent = title;
  viewerContent.innerHTML = contentHtml;

  // Reset maximize minden megnyitáskor
  isViewerMaximized = false;
  viewerMaxBtn.textContent = '[ ⛶ ]';
  viewerBox.className = 'viewer-box' + (extraClass ? ` ${extraClass}` : '');

  viewerOverlay.classList.remove('hidden');
  viewerClose.focus();
}

function closeViewer() {
  viewerOverlay.classList.add('hidden');
  viewerContent.innerHTML = '';
  isViewerMaximized = false;
  viewerBox.classList.remove('viewer-maximized');
  viewerMaxBtn.textContent = '[ ⛶ ]';
}

viewerClose.addEventListener('click', closeViewer);
viewerOverlay.addEventListener('click', (e) => { if (e.target === viewerOverlay) closeViewer(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !viewerOverlay.classList.contains('hidden')) closeViewer();
});

// ============================================================
// MARKDOWN MEGJELENÍTŐ
// ============================================================
async function openMarkdown(item) {
  openViewer(item.name, '<div class="viewer-loading">&gt; Markdown betöltése<span class="loading-dots"></span></div>');
  const filePath = currentPath ? `${currentPath}/${item.name}` : item.name;
  let raw;
  try {
    const res = await fetch(`/api/read?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.text();
  } catch (err) {
    openViewer(item.name, `<div class="viewer-error">&gt; HIBA: ${escapeHtml(err.message)}</div>`);
    return;
  }
  openViewer(item.name, `<div class="md-body">${marked.parse(raw, { breaks: true, gfm: true })}</div>`);
}

// ============================================================
// YOUTUBE LEJÁTSZÓ
// ============================================================
async function openYouTube(item) {
  openViewer(item.name, '<div class="viewer-loading">&gt; Videó betöltése<span class="loading-dots"></span></div>', 'viewer-yt');
  const filePath = currentPath ? `${currentPath}/${item.name}` : item.name;
  let raw;
  try {
    const res = await fetch(`/api/read?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.text();
  } catch (err) {
    openViewer(item.name, `<div class="viewer-error">&gt; HIBA: ${escapeHtml(err.message)}</div>`);
    return;
  }
  const url = raw.trim().split('\n')[0].trim();
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    openViewer(item.name, `<div class="viewer-error">&gt; Érvénytelen URL:<br><span style="font-size:8px;color:var(--dim)">${escapeHtml(url)}</span></div>`, 'viewer-yt');
    return;
  }
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
  openViewer(item.name, `
    <div class="yt-wrap">
      <div class="yt-scanline" aria-hidden="true"></div>
      <iframe class="yt-iframe" src="${embedUrl}" title="YouTube lejátszó"
        frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen></iframe>
    </div>
    <div class="yt-meta"><span class="yt-label">[YT]</span><span class="yt-url">${escapeHtml(url)}</span></div>`,
    'viewer-yt');
}

function extractYouTubeId(url) {
  const patterns = [/[?&]v=([a-zA-Z0-9_-]{11})/, /youtu\.be\/([a-zA-Z0-9_-]{11})/, /\/shorts\/([a-zA-Z0-9_-]{11})/, /\/embed\/([a-zA-Z0-9_-]{11})/];
  for (const re of patterns) { const m = url.match(re); if (m) return m[1]; }
  return null;
}

// ============================================================
// SZÖVEGES FÁJL NÉZEGETŐ
// ============================================================
async function openTextFile(item) {
  openViewer(item.name, '<div class="viewer-loading">&gt; Fájl betöltése<span class="loading-dots"></span></div>');
  const filePath = currentPath ? `${currentPath}/${item.name}` : item.name;
  let raw;
  try {
    const res = await fetch(`/api/read?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.text();
  } catch (err) {
    openViewer(item.name, `<div class="viewer-error">&gt; HIBA: ${escapeHtml(err.message)}</div>`);
    return;
  }
  const ext = item.name.split('.').pop().toUpperCase();
  openViewer(item.name, `
    <div class="code-header">
      <span class="code-lang">${escapeHtml(ext)}</span>
      <span class="code-lines">${raw.split('\n').length} sor</span>
    </div>
    <pre class="code-block"><code>${escapeHtml(raw)}</code></pre>`, 'viewer-code');
}

// ============================================================
// KÉPNÉZEGETŐ – lapozóval (← → billentyű és gomb)
// imgItems: az aktuális mappa összes képe
// ============================================================
function openImage(item, imgItems = []) {
  let imgIdx = imgItems.findIndex(i => i.name === item.name);
  if (imgIdx < 0) { imgItems = [item]; imgIdx = 0; }

  function render(idx) {
    const cur      = imgItems[idx];
    const filePath = currentPath ? `${currentPath}/${cur.name}` : cur.name;
    const src      = `/data/${filePath}`;
    const multi    = imgItems.length > 1;

    openViewer(cur.name, `
      <div class="img-wrap">
        <div class="img-loading" id="img-loading">&gt; Kép betöltése<span class="loading-dots"></span></div>
        <img class="img-viewer" id="img-viewer-el" src="${escapeAttr(src)}" alt="${escapeAttr(cur.name)}" draggable="false" />
        ${multi ? `
          <button class="img-nav img-prev" id="img-prev" aria-label="Előző" ${idx === 0 ? 'disabled' : ''}>&#9664;</button>
          <button class="img-nav img-next" id="img-next" aria-label="Következő" ${idx === imgItems.length - 1 ? 'disabled' : ''}>&#9654;</button>
        ` : ''}
      </div>
      <div class="img-meta">
        <span class="img-label">[IMG]</span>
        <span class="img-filename">${escapeHtml(cur.name)}</span>
        ${multi ? `<span class="img-counter">${idx + 1}&nbsp;/&nbsp;${imgItems.length}</span>` : ''}
        <span class="img-size">${cur.size ?? ''}</span>
      </div>`, 'viewer-img');

    imgIdx = idx;

    requestAnimationFrame(() => {
      const imgEl     = document.getElementById('img-viewer-el');
      const loadingEl = document.getElementById('img-loading');
      if (!imgEl) return;
      imgEl.addEventListener('load',  () => { if (loadingEl) loadingEl.style.display = 'none'; imgEl.classList.add('img-loaded'); });
      imgEl.addEventListener('error', () => { if (loadingEl) loadingEl.textContent = '> HIBA: A kép nem tölthető be.'; imgEl.style.display = 'none'; });
      const prevBtn = document.getElementById('img-prev');
      const nextBtn = document.getElementById('img-next');
      if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); render(idx - 1); });
      if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); render(idx + 1); });
    });
  }

  render(imgIdx);

  // ← → billentyű lapozás (a globális keydown kezeli, ld. lent)
}

// ============================================================
// BILLENTYŰZET NAVIGÁCIÓ
// ============================================================
function goUp() {
  if (!currentPath) return;
  loadDirectory(currentPath.split('/').filter(Boolean).slice(0, -1).join('/'));
}

document.addEventListener('keydown', (e) => {
  // Viewer nyitva: ← → lapoz képek között
  if (!viewerOverlay.classList.contains('hidden')) {
    const prevBtn = document.getElementById('img-prev');
    const nextBtn = document.getElementById('img-next');
    if (e.key === 'ArrowLeft'  && prevBtn && !prevBtn.disabled) { e.preventDefault(); prevBtn.click(); }
    if (e.key === 'ArrowRight' && nextBtn && !nextBtn.disabled) { e.preventDefault(); nextBtn.click(); }
    return;
  }

  if (mainPanel.classList.contains('hidden')) return;

  switch (e.key) {
    case 'ArrowDown':  e.preventDefault(); selectRow(selectedIndex + 1);           break;
    case 'ArrowUp':    e.preventDefault(); selectRow(selectedIndex - 1);           break;
    case 'Enter':      e.preventDefault(); openItem(selectedIndex);                break;
    case 'Backspace':  e.preventDefault(); goUp();                                 break;
    case 'Home':       e.preventDefault(); selectRow(0);                           break;
    case 'End':        e.preventDefault(); selectRow(currentItems.length - 1);    break;
  }
});

// ============================================================
// XSS-VÉDELEM
// ============================================================
function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escapeAttr(str) {
  return String(str).replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ============================================================
// CUSTOM KONTEXTUS MENÜ
// ============================================================
const ctxMenu       = document.getElementById('ctx-menu');
const ctxHeaderIcon = document.getElementById('ctx-header-icon');
const ctxHeaderName = document.getElementById('ctx-header-name');
const ctxBtnOpen    = document.getElementById('ctx-open');
const ctxBtnDl      = document.getElementById('ctx-download');
const ctxBtnCopy    = document.getElementById('ctx-copy');
const ctxBtnSaveAs  = document.getElementById('ctx-saveas');
const ctxBtnNewTab  = document.getElementById('ctx-newtab');

let ctxTarget = null;

fileListWrap.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const row = e.target.closest('.file-row');
  if (!row) return;
  const idx  = parseInt(row.dataset.index);
  const item = currentItems[idx];
  if (!item) return;
  ctxTarget = { item, idx };
  const icon = getIcon(item.type);
  ctxHeaderIcon.textContent = icon.label;
  ctxHeaderIcon.className   = `ctx-header-icon ${icon.cls}`;
  ctxHeaderName.textContent = item.name;
  const isDir = item.isDir;
  ctxBtnDl.disabled = ctxBtnCopy.disabled = ctxBtnSaveAs.disabled = ctxBtnNewTab.disabled = isDir;
  showCtxMenu(e.clientX, e.clientY);
  selectRow(idx);
});

function showCtxMenu(x, y) {
  ctxMenu.classList.remove('hidden', 'flip-x', 'flip-y');
  const mw = ctxMenu.offsetWidth, mh = ctxMenu.offsetHeight;
  const vw = window.innerWidth,   vh = window.innerHeight;
  let left = x, top = y;
  if (x + mw > vw - 8) { left = x - mw; ctxMenu.classList.add('flip-x'); }
  if (y + mh > vh - 8) { top  = y - mh; ctxMenu.classList.add('flip-y'); }
  ctxMenu.style.left = `${left}px`;
  ctxMenu.style.top  = `${top}px`;
  const first = ctxMenu.querySelector('.ctx-item:not(:disabled)');
  if (first) first.focus();
}

function closeCtxMenu() { ctxMenu.classList.add('hidden'); ctxTarget = null; }

document.addEventListener('click', (e) => {
  if (!ctxMenu.classList.contains('hidden') && !ctxMenu.contains(e.target)) closeCtxMenu();
}, true);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !ctxMenu.classList.contains('hidden')) closeCtxMenu();
});

fileListWrap.addEventListener('scroll', closeCtxMenu, { passive: true });

function buildFileUrl(item) {
  const rel = currentPath ? `${currentPath}/${item.name}` : item.name;
  return `/data/${rel}`;
}

// Letöltés segédfüggvény – növeli a számlálót és frissíti a DOM-ot
function triggerDownload(item) {
  const url = buildFileUrl(item);
  const a   = document.createElement('a');
  a.href = url; a.download = item.name; a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  const filePath = currentPath ? `${currentPath}/${item.name}` : item.name;
  const newCount = incDlCount(filePath);

  // Frissítjük a sort a listában
  const row = fileListWrap.querySelector(`[data-name="${escapeAttr(item.name)}"]`);
  if (row) { const cell = row.querySelector('.col-dl'); if (cell) cell.textContent = newCount; }
}

ctxBtnOpen.addEventListener('click', () => {
  if (!ctxTarget) return;
  openItem(ctxTarget.idx);
  closeCtxMenu();
});

ctxBtnDl.addEventListener('click', () => {
  if (!ctxTarget || ctxTarget.item.isDir) return;
  triggerDownload(ctxTarget.item);
  showToast(`> Letöltés: ${ctxTarget.item.name}`);
  closeCtxMenu();
});

ctxBtnCopy.addEventListener('click', async () => {
  if (!ctxTarget || ctxTarget.item.isDir) return;
  const url = window.location.origin + buildFileUrl(ctxTarget.item);
  try { await navigator.clipboard.writeText(url); showToast(`> Link másolva: ${ctxTarget.item.name}`); }
  catch { prompt('Másold ki kézzel:', url); }
  closeCtxMenu();
});

ctxBtnSaveAs.addEventListener('click', () => {
  if (!ctxTarget || ctxTarget.item.isDir) return;
  triggerDownload(ctxTarget.item);
  closeCtxMenu();
});

// *** ITT VOLT A TÖRÖTT ZÁRÓJEL – JAVÍTVA ***
ctxBtnNewTab.addEventListener('click', () => {
  if (!ctxTarget || ctxTarget.item.isDir) return;
  window.open(buildFileUrl(ctxTarget.item), '_blank', 'noopener,noreferrer');
  closeCtxMenu();
});

// ============================================================
// JELSZÓ DIALÓG
// ============================================================
const pwOverlay    = document.getElementById('pw-overlay');
const pwBox        = document.getElementById('pw-box');
const pwFolderName = document.getElementById('pw-folder-name');
const pwInput      = document.getElementById('pw-input');
const pwError      = document.getElementById('pw-error');
const pwSubmit     = document.getElementById('pw-submit');
const pwCancel     = document.getElementById('pw-cancel');

let pwSuccessCallback = null;

function showPasswordDialog(protectedRoot, onSuccess) {
  pwFolderName.textContent = protectedRoot || '(gyökér)';
  pwInput.value = ''; pwError.textContent = '';
  pwSuccessCallback = onSuccess;
  pwOverlay.classList.remove('hidden');
  setTimeout(() => pwInput.focus(), 150);
}

function closePasswordDialog() {
  pwOverlay.classList.add('hidden');
  pwInput.value = ''; pwError.textContent = '';
  pwSuccessCallback = null;
}

async function submitPassword() {
  const password   = pwInput.value;
  const folderName = pwFolderName.textContent;
  if (!password) { pwError.textContent = '> Írj be egy jelszót!'; pwInput.focus(); return; }
  pwSubmit.disabled = true;
  pwError.textContent = '> Ellenőrzés...';
  try {
    const res  = await fetch('/api/auth/unlock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folderName, password }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      closePasswordDialog();
      if (pwSuccessCallback) pwSuccessCallback();
    } else {
      pwError.textContent = `> ${data.error || 'Hibás jelszó.'}`;
      pwInput.value = ''; pwInput.focus();
      pwBox.classList.remove('shake');
      void pwBox.offsetWidth;
      pwBox.classList.add('shake');
      pwBox.addEventListener('animationend', () => pwBox.classList.remove('shake'), { once: true });
    }
  } catch { pwError.textContent = '> Hálózati hiba.'; }
  finally   { pwSubmit.disabled = false; }
}

pwSubmit.addEventListener('click', submitPassword);
pwCancel.addEventListener('click', closePasswordDialog);
pwInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter')  { e.preventDefault(); submitPassword(); }
  if (e.key === 'Escape') { e.preventDefault(); closePasswordDialog(); }
  e.stopPropagation();
});
pwOverlay.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.activeElement !== pwInput) closePasswordDialog();
});
pwOverlay.addEventListener('click', (e) => { if (e.target === pwOverlay) closePasswordDialog(); });

// ============================================================
// TOAST ÉRTESÍTŐ
// ============================================================
function showToast(msg) {
  const existing = document.querySelector('.ctx-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'ctx-toast'; toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2100);
}

// ============================================================
// CLI PROMPT
// ============================================================
const cliInput   = document.getElementById('cli-input');
const cliRun     = document.getElementById('cli-run');
const cliOutput  = document.getElementById('cli-output');
const cliPrefix  = document.getElementById('cli-prefix');
const cliHistory = [];
let   cliHistIdx = -1;

function updateCliPrefix() {
  cliPrefix.textContent = `${currentPath ? `~/data/${currentPath}` : '~/data'}>`;
}

function cliPrint(lines) {
  cliOutput.innerHTML = lines.map(l => `<div class="${l.cls||'cli-info'}">${l.text}</div>`).join('');
  cliOutput.classList.toggle('has-content', lines.length > 0);
}

function cliClear() { cliOutput.innerHTML = ''; cliOutput.classList.remove('has-content'); }

async function runCliCommand(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return;
  if (cliHistory[0] !== trimmed) cliHistory.unshift(trimmed);
  if (cliHistory.length > 50) cliHistory.pop();
  cliHistIdx = -1;

  const parts = trimmed.split(/\s+/);
  const cmd   = parts[0].toLowerCase();
  const arg   = parts.slice(1).join(' ').trim();

  switch (cmd) {
    case 'cd': {
      if (!arg) { await loadDirectory(''); cliClear(); break; }
      let tp;
      if (arg === '..') { tp = currentPath.split('/').filter(Boolean).slice(0,-1).join('/'); }
      else if (arg.startsWith('/')) { tp = arg.replace(/^\/+/,''); }
      else { tp = currentPath ? `${currentPath}/${arg}` : arg; }
      tp = tp.replace(/\/+/g,'/').replace(/\/$/,'');
      try {
        const res = await fetch(`/api/files-raw?path=${encodeURIComponent(tp||'.')}`);
        if (!res.ok) throw new Error((await res.json()).error||`HTTP ${res.status}`);
        await loadDirectoryRaw(tp); cliClear();
      } catch (err) { cliPrint([{ text:`> HIBA: ${err.message}`, cls:'cli-err' }]); }
      break;
    }
    case 'open': {
      if (!arg) { cliPrint([{ text:'> Használat: open <fájl>', cls:'cli-err' }]); break; }
      let fp = arg.startsWith('/') ? arg.replace(/^\/+/,'') : (currentPath ? `${currentPath}/${arg}` : arg);
      fp = fp.replace(/\/+/g,'/');
      try {
        const segs = fp.split('/'); const fn = segs.pop(); const dp = segs.join('/')||'.';
        const res = await fetch(`/api/files-raw?path=${encodeURIComponent(dp)}`);
        if (!res.ok) throw new Error((await res.json()).error||`HTTP ${res.status}`);
        const data = await res.json();
        const found = data.items.find(i => i.name === fn);
        if (!found)      throw new Error(`"${fn}" nem található`);
        if (found.isDir) throw new Error(`"${fn}" egy mappa`);
        cliClear(); await openItemByMeta(found, segs.join('/'));
      } catch (err) { cliPrint([{ text:`> HIBA: ${err.message}`, cls:'cli-err' }]); }
      break;
    }
    case 'ls': {
      try {
        const p = arg || currentPath || '.';
        const res = await fetch(`/api/files-raw?path=${encodeURIComponent(p)}`);
        if (!res.ok) throw new Error((await res.json()).error||`HTTP ${res.status}`);
        const data = await res.json();
        cliPrint(data.items.length === 0
          ? [{ text:'(üres mappa)', cls:'cli-dim' }]
          : data.items.map(i => ({ text:`  ${getIcon(i.type).label}  ${i.name}${i.isDir?'/':''}`, cls: i.isDir?'cli-ok':'cli-info' })));
      } catch (err) { cliPrint([{ text:`> HIBA: ${err.message}`, cls:'cli-err' }]); }
      break;
    }
    case 'clear': case 'cls': cliClear(); break;
    case 'help':
      cliPrint([
        { text:'── ELÉRHETŐ PARANCSOK ──────────────────', cls:'cli-dim' },
        { text:'  cd <mappa>   Belépés mappába (rejtett is OK)', cls:'cli-info' },
        { text:'  cd ..        Vissza a szülő mappába',          cls:'cli-info' },
        { text:'  cd /         Gyökérbe ugrás',                  cls:'cli-info' },
        { text:'  open <fájl>  Fájl megnyitása (rejtett is OK)', cls:'cli-info' },
        { text:'  ls [mappa]   Mappa tartalmának listázása',     cls:'cli-info' },
        { text:'  clear        Kimenet törlése',                 cls:'cli-info' },
        { text:'  help         Ez a súgó',                       cls:'cli-info' },
        { text:'─────────────────────────────────────────', cls:'cli-dim' },
        { text:'  ↑ / ↓        Előzmény visszahívása',          cls:'cli-dim' },
        { text:'  TAB          Automatikus kiegészítés',         cls:'cli-dim' },
      ]); break;
    default:
      cliPrint([{ text:`> Ismeretlen: "${cmd}"`, cls:'cli-err' }, { text:'  Gépeld: help', cls:'cli-dim' }]);
  }
  updateCliPrefix();
}

async function loadDirectoryRaw(dirPath) {
  currentPath = dirPath; updateCliPrefix();
  fileListWrap.innerHTML = '<div class="loading-row">&gt; Mappa olvasása</div>';
  statusCount.textContent = 'Betöltés...';
  renderBreadcrumb(dirPath);
  let data;
  try {
    const res = await fetch(`/api/files-raw?path=${encodeURIComponent(dirPath||'.')}`);
    if (res.status === 401) {
      const body = await res.json();
      currentPath = ''; updateCliPrefix();
      showPasswordDialog(body.protectedRoot, () => loadDirectoryRaw(dirPath)); return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    fileListWrap.innerHTML = `<div class="error-state">> HIBA: ${err.message}</div>`;
    statusCount.textContent = 'Hiba.'; return;
  }
  currentItems = data.items; selectedIndex = 0;
  renderFileList(data.items); renderBreadcrumb(data.path); updateStatusBar(data.items);
}

async function openItemByMeta(item, dirPath) {
  const savedPath = currentPath; currentPath = dirPath;
  if      (item.type === 'md')                                   await openMarkdown(item);
  else if (item.type === 'yt')                                   await openYouTube(item);
  else if (item.type === 'img')                                        openImage(item);
  else if (['txt','json','js','css','html'].includes(item.type)) await openTextFile(item);
  else if (item.type === 'pdf') {
    const rel = dirPath ? `${dirPath}/${item.name}` : item.name;
    window.open(`/data/${rel}`, '_blank', 'noopener,noreferrer');
  } else { cliPrint([{ text:`> "${item.name}" nem jeleníthető meg.`, cls:'cli-err' }]); }
  currentPath = savedPath;
}

cliInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') { e.preventDefault(); const v = cliInput.value; cliInput.value = ''; await runCliCommand(v); }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (cliHistIdx < cliHistory.length - 1) { cliHistIdx++; cliInput.value = cliHistory[cliHistIdx]; setTimeout(() => cliInput.setSelectionRange(9999,9999),0); }
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (cliHistIdx > 0) { cliHistIdx--; cliInput.value = cliHistory[cliHistIdx]; } else { cliHistIdx = -1; cliInput.value = ''; }
  }
  if (e.key === 'Tab') { e.preventDefault(); tabComplete(); }
  if (['ArrowUp','ArrowDown'].includes(e.key)) e.stopPropagation();
});

cliRun.addEventListener('click', async () => {
  const v = cliInput.value; cliInput.value = ''; cliInput.focus(); await runCliCommand(v);
});

async function tabComplete() {
  const val = cliInput.value;
  const parts = val.trimStart().split(/\s+/);
  const cmd   = parts[0]?.toLowerCase();
  if (parts.length === 1) {
    const cmds = ['cd','open','ls','clear','help'];
    const m = cmds.filter(c => c.startsWith(cmd));
    if (m.length === 1) { cliInput.value = m[0] + ' '; }
    else if (m.length > 1) { cliPrint(m.map(x => ({ text:`  ${x}`, cls:'cli-dim' }))); }
    return;
  }
  if (cmd === 'cd' || cmd === 'open') {
    const partial  = parts[1] || '';
    const segs     = partial.split('/');
    const prefix   = segs.slice(0,-1).join('/');
    const search   = segs[segs.length-1].toLowerCase();
    const lookIn   = prefix ? (currentPath ? `${currentPath}/${prefix}` : prefix) : (currentPath||'.');
    try {
      const res = await fetch(`/api/files-raw?path=${encodeURIComponent(lookIn)}`);
      if (!res.ok) return;
      const data = await res.json();
      const m = data.items.filter(i => i.name.toLowerCase().startsWith(search) && (cmd==='cd' ? i.isDir : true));
      if (m.length === 1) { cliInput.value = `${cmd} ${prefix?`${prefix}/`:''}${m[0].name}${m[0].isDir?'/':''}`; }
      else if (m.length > 1) { cliPrint(m.map(x => ({ text:`  ${x.name}${x.isDir?'/':''}`, cls: x.isDir?'cli-ok':'cli-info' }))); }
    } catch { /* nem kritikus */ }
  }
}
