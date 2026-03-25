/* ============================================================
   script.js – Interakciók + dinamikus fájlkezelő
   Felelős: Ready screen, CRT animáció, fájllista betöltés,
            breadcrumb navigáció, billentyűzet kezelés
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
// ÁLLAPOT – navigáció nyomon követése
// ============================================================
let currentPath   = '';
let selectedIndex = 0;
let currentItems  = [];

// ============================================================
// BOOT SZEKVENCIA – Ready képernyő animált megjelenése
// Sorrend: CRT-on → "Ready?" gépelés → BIOS sor → progress bar → OK → AWAITING → gombok
// ============================================================

// Segéd: Promise-alapú késleltetés
const wait = ms => new Promise(r => setTimeout(r, ms));

// Segéd: typewriter effekt – karakterenként írja ki a szöveget
async function typeWriter(el, text, speed = 55) {
  el.textContent = '';
  for (const ch of text) {
    el.textContent += ch;
    await wait(speed);
  }
}

// Segéd: egy log sort fadeIn-nel megjelenít
function showLogLine(el) {
  el.style.opacity = '0';
  el.classList.add('log-fadein');
  el.style.opacity = ''; // az animáció veszi át
}

// Segéd: progress bar animálása 0→100% adott ms alatt
async function animateProgress(barEl, durationMs) {
  const steps    = 40;
  const stepMs   = durationMs / steps;
  const stepPct  = 100 / steps;
  for (let i = 1; i <= steps; i++) {
    barEl.style.width = `${i * stepPct}%`;
    await wait(stepMs);
  }
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

  // Kezdeti állapot
  logBios.style.opacity    = '0';
  logLoading.style.opacity = '0';

  // 1. Várunk a CRT-on animáció végéig (kb. 550ms)
  await wait(620);

  // 2. "Ready?" gépelés karakterenként
  readyCursor.classList.remove('blinking'); // gépelés alatt ne villogjon
  await typeWriter(readyLabel, 'Ready?', 60);
  readyCursor.classList.add('blinking');    // gépelés után villog

  await wait(300);

  // 3. BIOS sor megjelenítése
  showLogLine(logBios);
  await wait(700);

  // 4. LOADING... sor megjelenítése (progress bar nélkül először)
  progressWrap.style.display = 'none';
  logOk.style.display        = 'none';
  showLogLine(logLoading);
  await wait(400);

  // 5. Progress bar megjelenítése és animálása
  progressWrap.style.display = 'inline-block';
  await animateProgress(progressBar, 1400);

  // 6. Progress bar eltűnik, OK megjelenik
  progressWrap.style.display = 'none';
  logOk.style.display        = 'inline';

  await wait(350);

  // 7. AWAITING USER INPUT megjelenik
  showLogLine(logAwait);

  await wait(400);

  // 8. Gombok megjelennek
  readyButtons.style.opacity       = '1';
  readyButtons.style.pointerEvents = 'auto';
}

// Boot szekvencia indítása az oldal betöltésekor
runBootSequence();

// ============================================================
// [Y] GOMB – CRT-off animáció, főpanel megjelenítése
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

// ============================================================
// [N] GOMB – hozzáférés megtagadva visszajelzés
// ============================================================
btnNo.addEventListener('click', () => {
  const logAwait = document.getElementById('log-await');
  if (!logAwait) return;

  logAwait.style.color      = 'var(--orange)';
  logAwait.style.textShadow = '0 0 8px var(--orange)';
  logAwait.textContent      = '> HOZZÁFÉRÉS MEGTAGADVA. Újrapróbálkozás...';

  setTimeout(() => {
    logAwait.style.color      = '';
    logAwait.style.textShadow = '';
    logAwait.textContent      = 'AWAITING USER INPUT';
  }, 1500);
});

// Billentyűzet: Y / N a Ready képernyőn
document.addEventListener('keydown', (e) => {
  if (!readyScreen.classList.contains('hidden')) {
    if (e.key === 'y' || e.key === 'Y') btnYes.click();
    if (e.key === 'n' || e.key === 'N') btnNo.click();
  }
});

// ============================================================
// FÁJLIKON MEGHATÁROZÁSA TÍPUS SZERINT
// ASCII-alapú ikonok, CSS osztállyal színezve
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
// FÁJLLISTA BETÖLTÉSE A SZERVERRŐL
// path: relatív útvonal a data/ gyökérhöz képest
// ============================================================
async function loadDirectory(path) {
  const previousPath = currentPath; // mentjük, ha 401-re visszakell állni
  currentPath = path;
  if (typeof updateCliPrefix === 'function') updateCliPrefix();

  // Betöltés jelzése
  fileListWrap.innerHTML = '<div class="loading-row">&gt; Mappa olvasása</div>';
  statusCount.textContent = 'Betöltés...';

  // Breadcrumb frissítése betöltés közben is
  renderBreadcrumb(path);

  let data;
  try {
    const res = await fetch(`/api/files?path=${encodeURIComponent(path || '.')}`);

    // 401: védett mappa – jelszó dialóg feldobása
    if (res.status === 401) {
      const body = await res.json();
      // Visszaállítjuk az előző útvonalat (ne maradjunk védett helyen)
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
// FÁJLLISTA RENDERELÉSE A DOM-BA
// ============================================================
function renderFileList(items) {
  // Ha üres a mappa
  if (items.length === 0) {
    fileListWrap.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">□</span>
        A mappa üres.<br>
        <span style="font-size:7px;color:var(--dim)">
          Hozz létre fájlokat a public/data mappában.
        </span>
      </div>`;
    return;
  }

  // Minden elemhez egy .file-row div épül fel
  fileListWrap.innerHTML = items.map((item, idx) => {
    const icon = getIcon(item.type);
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
        <span class="col-date">${item.modified ?? ''}</span>
      </div>`;
  }).join('');

  // Kattintás és dupla kattintás kezelése
  fileListWrap.querySelectorAll('.file-row').forEach(row => {
    row.addEventListener('click',    () => selectRow(parseInt(row.dataset.index)));
    row.addEventListener('dblclick', () => openItem(parseInt(row.dataset.index)));
  });
}

// ============================================================
// BREADCRUMB RENDERELÉSE
// A path pl. "projektek/web" → [ROOT] > [projektek] > [web]
// ============================================================
function renderBreadcrumb(path) {
  const parts = path ? path.split('/').filter(Boolean) : [];

  // Gyökér elem mindig ott van
  let html = `<span class="breadcrumb-item${parts.length === 0 ? ' active' : ''}"
    data-path="" title="Gyökér mappa">~/data</span>`;

  // Közbenső mappák
  parts.forEach((part, i) => {
    const subPath = parts.slice(0, i + 1).join('/');
    const isLast  = i === parts.length - 1;
    html += `<span class="breadcrumb-sep">/</span>`;
    html += `<span class="breadcrumb-item${isLast ? ' active' : ''}"
      data-path="${escapeAttr(subPath)}">${escapeHtml(part)}</span>`;
  });

  breadcrumbBar.innerHTML = html;

  // Kattintásra navigálás (nem aktív elemekre)
  breadcrumbBar.querySelectorAll('.breadcrumb-item:not(.active)').forEach(el => {
    el.addEventListener('click', () => loadDirectory(el.dataset.path));
  });
}

// ============================================================
// ÁLLAPOTSOR FRISSÍTÉSE
// ============================================================
function updateStatusBar(items) {
  const dirs  = items.filter(i => i.isDir).length;
  const files = items.filter(i => !i.isDir).length;
  statusCount.textContent = `${dirs} mappa, ${files} fájl`;
}

// ============================================================
// SOR KIJELÖLÉSE (billentyűzet / egér)
// ============================================================
function selectRow(index) {
  // Előző kijelölés törlése
  const prev = fileListWrap.querySelector('.file-row.selected');
  if (prev) prev.classList.remove('selected');

  selectedIndex = Math.max(0, Math.min(index, currentItems.length - 1));

  const next = fileListWrap.querySelector(`[data-index="${selectedIndex}"]`);
  if (next) {
    next.classList.add('selected');
    // Görgetés: sor látható legyen
    next.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// ============================================================
// ELEM MEGNYITÁSA (mappa: navigálás; fájl: egyelőre log)
// ============================================================
function openItem(index) {
  const item = currentItems[index];
  if (!item) return;

  if (item.isDir) {
    // Mappa megnyitása: útvonal összerakása és betöltés
    const newPath = currentPath ? `${currentPath}/${item.name}` : item.name;
    loadDirectory(newPath);
  } else if (item.type === 'md') {
    // Markdown fájl: betöltés + megjelenítés modal-ban
    openMarkdown(item);
  } else if (item.type === 'yt') {
    // YouTube fájl: URL kiolvasás + embed lejátszó modal-ban
    openYouTube(item);
  } else if (item.type === 'img') {
    // Képfájl: közvetlen megjelenítés a modal-ban
    openImage(item);
  } else if (['txt', 'json', 'js', 'css', 'html'].includes(item.type)) {
    // Szöveges fájlok: nyers tartalom megjelenítése kódnézetben
    openTextFile(item);
  } else if (item.type === 'pdf') {
    // PDF: új lapon nyitjuk meg (böngésző beépített PDF nézetével)
    const rel = currentPath ? `${currentPath}/${item.name}` : item.name;
    window.open(`/data/${rel}`, '_blank', 'noopener,noreferrer');
    statusCount.textContent = `> ${item.name} – nem támogatott nézet`;
    setTimeout(() => updateStatusBar(currentItems), 2000);
  }
}

// ============================================================
// MODAL MEGNYITÁSA / BEZÁRÁSA
// ============================================================

const viewerOverlay = document.getElementById('viewer-overlay');
const viewerBox     = document.getElementById('viewer-box');
const viewerTitle   = document.getElementById('viewer-title');
const viewerContent = document.getElementById('viewer-content');
const viewerClose   = document.getElementById('viewer-close');

// Modal megnyitása – cím és tartalom HTML átadásával
function openViewer(title, contentHtml, extraClass = '') {
  viewerTitle.textContent = title;
  viewerContent.innerHTML = contentHtml;

  // Extra CSS osztály (pl. 'viewer-yt' a YT lejátszóhoz)
  viewerBox.className = 'viewer-box' + (extraClass ? ` ${extraClass}` : '');

  viewerOverlay.classList.remove('hidden');

  // Fókusz a bezárás gombra (akadálymentesség)
  viewerClose.focus();
}

// Modal bezárása
function closeViewer() {
  viewerOverlay.classList.add('hidden');
  viewerContent.innerHTML = ''; // YT iframe leállítása is így történik
}

// Bezárás gomb kattintásra
viewerClose.addEventListener('click', closeViewer);

// Overlay háttérre kattintva is bezár
viewerOverlay.addEventListener('click', (e) => {
  if (e.target === viewerOverlay) closeViewer();
});

// ESC billentyűre bezár
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !viewerOverlay.classList.contains('hidden')) {
    closeViewer();
  }
});

// ============================================================
// MARKDOWN MEGJELENÍTŐ
// Fetch-szel lekéri a fájl tartalmát, marked.js-sel rendereli
// ============================================================
async function openMarkdown(item) {
  // Betöltés közben: spinner szöveg a modal-ban
  openViewer(item.name, '<div class="viewer-loading">&gt; Markdown betöltése<span class="loading-dots"></span></div>');

  const filePath = currentPath ? `${currentPath}/${item.name}` : item.name;

  let raw;
  try {
    // /api/read végponton keresztül kérjük le a nyers szöveget
    const res = await fetch(`/api/read?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.text();
  } catch (err) {
    openViewer(item.name, `<div class="viewer-error">&gt; HIBA: ${escapeHtml(err.message)}</div>`);
    return;
  }

  // marked.js: nyers Markdown → HTML
  // A 'breaks: true' sorvégeket <br>-ré alakítja (terminál-barát)
  const html = marked.parse(raw, { breaks: true, gfm: true });

  // Csomagoló div a stílusozáshoz
  openViewer(item.name, `<div class="md-body">${html}</div>`);
}

// ============================================================
// YOUTUBE LEJÁTSZÓ
// A .yt fájlból kinyeri az URL-t, majd iframe embed-et hoz létre
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

  // Az első nem-üres sort tekintjük YouTube URL-nek
  const url = raw.trim().split('\n')[0].trim();

  // YouTube video ID kinyerése az URL-ből
  // Támogatja: youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/...
  const videoId = extractYouTubeId(url);

  if (!videoId) {
    openViewer(item.name,
      `<div class="viewer-error">&gt; Érvénytelen YouTube URL:<br><span style="font-size:8px;color:var(--dim)">${escapeHtml(url)}</span></div>`,
      'viewer-yt'
    );
    return;
  }

  // Embed iframe: youtube-nocookie.com (adatvédelem-barát YouTube embed)
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;

  const html = `
    <div class="yt-wrap">
      <div class="yt-scanline" aria-hidden="true"></div>
      <iframe
        class="yt-iframe"
        src="${embedUrl}"
        title="YouTube lejátszó"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      ></iframe>
    </div>
    <div class="yt-meta">
      <span class="yt-label">[YT]</span>
      <span class="yt-url">${escapeHtml(url)}</span>
    </div>`;

  openViewer(item.name, html, 'viewer-yt');
}

// YouTube video ID kinyerése különböző URL formátumokból
function extractYouTubeId(url) {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,          // youtube.com/watch?v=...
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,      // youtu.be/...
    /\/shorts\/([a-zA-Z0-9_-]{11})/,       // youtube.com/shorts/...
    /\/embed\/([a-zA-Z0-9_-]{11})/,        // youtube.com/embed/...
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

// ============================================================
// SZÖVEGES FÁJL NÉZEGETŐ (.txt, .json, .css, .html, .js)
// Nyers tartalmat jelenít meg szintaxis-kiemelés nélkül,
// <pre><code> blokkban, a terminál stílusban
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

  // Fájl kiterjesztése a fejlécbe
  const ext = item.name.split('.').pop().toUpperCase();

  const html = `
    <div class="code-header">
      <span class="code-lang">${escapeHtml(ext)}</span>
      <span class="code-lines">${raw.split('\n').length} sor</span>
    </div>
    <pre class="code-block"><code>${escapeHtml(raw)}</code></pre>`;

  openViewer(item.name, html, 'viewer-code');
}

// ============================================================
// KÉPNÉZEGETŐ
// .jpg, .png, .gif, .webp fájlokhoz – statikus URL alapján tölti be
// ============================================================
function openImage(item) {
  // A kép statikusan elérhető a /data/ útvonalon keresztül
  const filePath = currentPath ? `${currentPath}/${item.name}` : item.name;
  const src      = `/data/${filePath}`;

  const html = `
    <div class="img-wrap">
      <!-- Betöltés közben spinner szöveg jelenik meg, majd a kép felülírja -->
      <div class="img-loading" id="img-loading">&gt; Kép betöltése<span class="loading-dots"></span></div>
      <img
        class="img-viewer"
        id="img-viewer-el"
        src="${escapeAttr(src)}"
        alt="${escapeAttr(item.name)}"
        draggable="false"
      />
    </div>
    <div class="img-meta">
      <span class="img-label">[IMG]</span>
      <span class="img-filename">${escapeHtml(item.name)}</span>
      <span class="img-size">${item.size ?? ''}</span>
    </div>`;

  openViewer(item.name, html, 'viewer-img');

  // Kép betöltése után: loading szöveg elrejtése, kép megjelenítése
  // (a DOM friss, requestAnimationFrame-mel várjuk meg a renderelést)
  requestAnimationFrame(() => {
    const imgEl      = document.getElementById('img-viewer-el');
    const loadingEl  = document.getElementById('img-loading');
    if (!imgEl) return;

    imgEl.addEventListener('load', () => {
      if (loadingEl) loadingEl.style.display = 'none';
      imgEl.classList.add('img-loaded');
    });

    imgEl.addEventListener('error', () => {
      if (loadingEl) loadingEl.textContent = '> HIBA: A kép nem tölthető be.';
      imgEl.style.display = 'none';
    });
  });
}

// Visszalépés szülő mappába
function goUp() {
  if (!currentPath) return; // Már a gyökérben vagyunk
  const parts    = currentPath.split('/').filter(Boolean);
  const parentPath = parts.slice(0, -1).join('/');
  loadDirectory(parentPath);
}

// ============================================================
// BILLENTYŰZET NAVIGÁCIÓ A FÁJLLISTÁBAN
// ============================================================
document.addEventListener('keydown', (e) => {
  // Csak a főpanel aktív esetén
  if (mainPanel.classList.contains('hidden')) return;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      selectRow(selectedIndex + 1);
      break;

    case 'ArrowUp':
      e.preventDefault();
      selectRow(selectedIndex - 1);
      break;

    case 'Enter':
      e.preventDefault();
      openItem(selectedIndex);
      break;

    case 'Backspace':
      // Vissza a szülő mappába
      e.preventDefault();
      goUp();
      break;

    case 'Home':
      e.preventDefault();
      selectRow(0);
      break;

    case 'End':
      e.preventDefault();
      selectRow(currentItems.length - 1);
      break;
  }
});

// ============================================================
// SEGÉDFÜGGVÉNYEK (XSS-védelem)
// ============================================================

// HTML speciális karakterek escapelése (megjelenítéshez)
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// HTML attribútum érték escapelése
function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ============================================================
// CUSTOM KONTEXTUS MENÜ
// Fájl/mappa sorokon jobb klikknél jelenik meg
// ============================================================

const ctxMenu       = document.getElementById('ctx-menu');
const ctxHeaderIcon = document.getElementById('ctx-header-icon');
const ctxHeaderName = document.getElementById('ctx-header-name');
const ctxBtnOpen    = document.getElementById('ctx-open');
const ctxBtnDl      = document.getElementById('ctx-download');
const ctxBtnCopy    = document.getElementById('ctx-copy');
const ctxBtnSaveAs  = document.getElementById('ctx-saveas');
const ctxBtnNewTab  = document.getElementById('ctx-newtab');

// Az éppen jobb-klikkel megcélzott elem adatai
let ctxTarget = null;

// ---- Böngésző alapértelmezett kontextus menüjének tiltása -------
// Csak a fájllistán belül tiltjuk, az oldal többi részén nem
fileListWrap.addEventListener('contextmenu', (e) => {
  e.preventDefault(); // Böngésző menü megakadályozása

  // Megkeressük a legközelebbi .file-row szülőt a kattintott elemtől
  const row = e.target.closest('.file-row');
  if (!row) return; // Ha nem soron kattintottunk, nem nyílunk meg

  // Sor adatainak kiolvasása a data-* attribútumokból
  const idx  = parseInt(row.dataset.index);
  const item = currentItems[idx];
  if (!item) return;

  ctxTarget = { item, idx };

  // Fejléc frissítése: ikon + fájlnév
  const icon = getIcon(item.type);
  ctxHeaderIcon.textContent = icon.label;
  ctxHeaderIcon.className   = `ctx-header-icon ${icon.cls}`;
  ctxHeaderName.textContent = item.name;

  // Mappán: letöltés/link opciók nem értelmesek → letiltjuk
  const isDir = item.isDir;
  ctxBtnDl    .disabled = isDir;
  ctxBtnCopy  .disabled = isDir;
  ctxBtnSaveAs.disabled = isDir;
  ctxBtnNewTab.disabled = isDir;

  // Menü megjelenítése a kurzor pozíciójánál
  showCtxMenu(e.clientX, e.clientY);

  // A kattintott sort is jelöljük ki vizuálisan
  selectRow(idx);
});

// ---- Menü pozicionálása (képernyő szélén való tükrözéssel) ------
function showCtxMenu(x, y) {
  // Először láthatóvá tesszük, hogy mérhető legyen a mérete
  ctxMenu.classList.remove('hidden', 'flip-x', 'flip-y');

  const mw = ctxMenu.offsetWidth;
  const mh = ctxMenu.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Ha kilógna jobbra → tükrözés
  let left = x;
  let top  = y;
  if (x + mw > vw - 8) { left = x - mw; ctxMenu.classList.add('flip-x'); }
  if (y + mh > vh - 8) { top  = y - mh; ctxMenu.classList.add('flip-y'); }

  ctxMenu.style.left = `${left}px`;
  ctxMenu.style.top  = `${top}px`;

  // Fókusz az első engedélyezett menüpontra (akadálymentesség)
  const firstEnabled = ctxMenu.querySelector('.ctx-item:not(:disabled)');
  if (firstEnabled) firstEnabled.focus();
}

// ---- Menü bezárása -----------------------------------------------
function closeCtxMenu() {
  ctxMenu.classList.add('hidden');
  ctxTarget = null;
}

// Menün kívüli kattintásra bezár (capture fázis, hogy a row click előtt fusson)
document.addEventListener('click', (e) => {
  if (!ctxMenu.classList.contains('hidden') && !ctxMenu.contains(e.target)) {
    closeCtxMenu();
  }
}, true);

// ESC billentyűre bezár (a meglévő ESC listener elé kerül)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !ctxMenu.classList.contains('hidden')) {
    closeCtxMenu();
  }
});

// Görgetésnél is bezárjuk (scroll a fájllistán)
fileListWrap.addEventListener('scroll', closeCtxMenu, { passive: true });

// ---- Segédfüggvény: fájl URL összerakása ------------------------
// A /data/ prefix alatt lévő fájlok statikusan elérhetők
function buildFileUrl(item) {
  const rel = currentPath ? `${currentPath}/${item.name}` : item.name;
  return `/data/${rel}`;
}

// ---- Menüpont: Megnyitás ----------------------------------------
ctxBtnOpen.addEventListener('click', () => {
  if (!ctxTarget) return;
  openItem(ctxTarget.idx); // Ugyanaz, mint a dupla kattintás
  closeCtxMenu();
});

// ---- Menüpont: Letöltés -----------------------------------------
// Egy rejtett <a download> linket hozunk létre és klikkelünk rá
ctxBtnDl.addEventListener('click', () => {
  if (!ctxTarget || ctxTarget.item.isDir) return;

  const url      = buildFileUrl(ctxTarget.item);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = ctxTarget.item.name; // 'download' attribútum = fájlként menti
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  showToast(`> Letöltés: ${ctxTarget.item.name}`);
  closeCtxMenu();
});

// ---- Menüpont: Link másolása (Clipboard API) --------------------
ctxBtnCopy.addEventListener('click', async () => {
  if (!ctxTarget || ctxTarget.item.isDir) return;

  const url      = window.location.origin + buildFileUrl(ctxTarget.item);
  const fileName = ctxTarget.item.name;

  try {
    await navigator.clipboard.writeText(url);
    showToast(`> Link másolva: ${fileName}`);
  } catch {
    // Clipboard API nem elérhető (pl. HTTP, Safari) → fallback
    prompt('Másold ki kézzel:', url);
  }

  closeCtxMenu();
});

// ---- Menüpont: Mentés másként -----------------------------------
// Ugyanaz, mint a letöltés, de a böngésző "Mentés másként" dialógját hívja
ctxBtnSaveAs.addEventListener('click', () => {
  if (!ctxTarget || ctxTarget.item.isDir) return;

  const url  = buildFileUrl(ctxTarget.item);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = ctxTarget.item.name;
  // A 'download' attribútum önmagában hívja a Mentés másként dialógust
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  closeCtxMenu();
});

// ---- Menüpont: Megnyitás új lapon -------------------------------
ctxBtnNewTab.addEventListener('click', () => {
  if (!ctxTarget || ctxTarget.item.isDir) return;

  const url = buildFileUrl(ctxTarget.item);
  window.open(url, '_blank', 'noopener,noreferrer');
  closeCtxMenu();
});

// ============================================================
// JELSZÓ DIALÓG – védett mappák feloldásához
// ============================================================

const pwOverlay    = document.getElementById('pw-overlay');
const pwBox        = document.getElementById('pw-box');
const pwFolderName = document.getElementById('pw-folder-name');
const pwInput      = document.getElementById('pw-input');
const pwError      = document.getElementById('pw-error');
const pwSubmit     = document.getElementById('pw-submit');
const pwCancel     = document.getElementById('pw-cancel');

// Callback: sikeres feloldás után ezt hívja a dialóg
let pwSuccessCallback = null;

// Dialóg megnyitása
// protectedRoot: a védett mappa relatív útvonala (pl. "titkos")
// onSuccess: függvény, amit sikeres jelszó után hívunk
function showPasswordDialog(protectedRoot, onSuccess) {
  pwFolderName.textContent = protectedRoot || '(gyökér)';
  pwInput.value            = '';
  pwError.textContent      = '';
  pwSuccessCallback        = onSuccess;

  pwOverlay.classList.remove('hidden');
  // Kis késleltetés után fókusz az input-ra (animáció után)
  setTimeout(() => pwInput.focus(), 150);
}

// Dialóg bezárása
function closePasswordDialog() {
  pwOverlay.classList.add('hidden');
  pwInput.value       = '';
  pwError.textContent = '';
  pwSuccessCallback   = null;
}

// Jelszó beküldése a szervernek
async function submitPassword() {
  const password    = pwInput.value;
  const folderName  = pwFolderName.textContent;

  if (!password) {
    pwError.textContent = '> Írj be egy jelszót!';
    pwInput.focus();
    return;
  }

  // Gomb letiltása a dupla klikk ellen
  pwSubmit.disabled = true;
  pwError.textContent = '> Ellenőrzés...';

  try {
    const res = await fetch('/api/auth/unlock', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ path: folderName, password }),
    });

    const data = await res.json();

    if (res.ok && data.ok) {
      // Siker: bezárjuk a dialógot, és futtatjuk a callback-et
      closePasswordDialog();
      if (pwSuccessCallback) pwSuccessCallback();
    } else {
      // Hibás jelszó: shake animáció + hibaüzenet
      pwError.textContent = `> ${data.error || 'Hibás jelszó.'}`;
      pwInput.value       = '';
      pwInput.focus();
      // Shake effekt
      pwBox.classList.remove('shake');
      void pwBox.offsetWidth; // reflow a class-újraalkalmazáshoz
      pwBox.classList.add('shake');
      pwBox.addEventListener('animationend', () => pwBox.classList.remove('shake'), { once: true });
    }
  } catch {
    pwError.textContent = '> Hálózati hiba. Próbáld újra.';
  } finally {
    pwSubmit.disabled = false;
  }
}

// Gombok
pwSubmit.addEventListener('click', submitPassword);
pwCancel.addEventListener('click', closePasswordDialog);

// ENTER a jelszó input-ban
pwInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); submitPassword(); }
  if (e.key === 'Escape') { e.preventDefault(); closePasswordDialog(); }
  e.stopPropagation(); // ne navigáljon a fájllistában
});

// ESC az overlay-en (de ne az input-on, azt fentebb kezeljük)
pwOverlay.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.activeElement !== pwInput) {
    closePasswordDialog();
  }
});

// Háttérre kattintva bezár
pwOverlay.addEventListener('click', (e) => {
  if (e.target === pwOverlay) closePasswordDialog();
});
// Rövid visszajelzés a képernyő alján (pl. "Link másolva!")
// ============================================================
function showToast(msg) {
  const existing = document.querySelector('.ctx-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className   = 'ctx-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2100);
}

// ============================================================
// CLI PROMPT
// Parancsok: cd, open, ls, clear, help
// A "raw" API végpontokat használja → rejtett mappák is elérhetők
// ============================================================

const cliInput  = document.getElementById('cli-input');
const cliRun    = document.getElementById('cli-run');
const cliOutput = document.getElementById('cli-output');
const cliPrefix = document.getElementById('cli-prefix');

// Parancs-előzmények (↑/↓ billentyűkkel visszahívható)
const cliHistory  = [];
let   cliHistIdx  = -1;   // -1 = nincs kiválasztott előzmény

// ---- Prefix frissítése az aktuális útvonal alapján ----------------
function updateCliPrefix() {
  const display = currentPath ? `~/data/${currentPath}` : '~/data';
  cliPrefix.textContent = `${display}>`;
}

// ---- Kimenet megjelenítése a prompt alatt -------------------------
function cliPrint(lines) {
  cliOutput.innerHTML = lines.map(l =>
    `<div class="${l.cls || 'cli-info'}">${l.text}</div>`
  ).join('');

  if (lines.length > 0) {
    cliOutput.classList.add('has-content');
  } else {
    cliOutput.classList.remove('has-content');
  }
}

// ---- Kimenet törlése ----------------------------------------------
function cliClear() {
  cliOutput.innerHTML = '';
  cliOutput.classList.remove('has-content');
}

// ---- Parancs végrehajtása -----------------------------------------
async function runCliCommand(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return;

  // Előzményekbe mentés (duplikátum kerülés)
  if (cliHistory[0] !== trimmed) cliHistory.unshift(trimmed);
  if (cliHistory.length > 50) cliHistory.pop();
  cliHistIdx = -1;

  // Parancs és argumentumok szétválasztása
  const parts = trimmed.split(/\s+/);
  const cmd   = parts[0].toLowerCase();
  const arg   = parts.slice(1).join(' ').trim();

  switch (cmd) {

    // ------------------------------------------------------------------
    case 'cd': {
      if (!arg) {
        // cd argumentum nélkül → gyökérbe ugrás
        await loadDirectory('');
        cliClear();
        break;
      }

      // Útvonal összerakása: abszolút (/ kezdetű) vagy relatív
      let targetPath;
      if (arg === '..') {
        // Vissza a szülőbe
        const parts2 = currentPath.split('/').filter(Boolean);
        targetPath = parts2.slice(0, -1).join('/');
      } else if (arg.startsWith('/')) {
        // Abszolút: / = gyökér
        targetPath = arg.replace(/^\/+/, '');
      } else {
        // Relatív: az aktuális mappához képest
        targetPath = currentPath ? `${currentPath}/${arg}` : arg;
      }
      // Normalizálás: dupla slashek, trailing slash eltávolítása
      targetPath = targetPath.replace(/\/+/g, '/').replace(/\/$/, '');

      // Ellenőrzés: létezik-e a mappa? (raw API → rejtett is OK)
      try {
        const res = await fetch(`/api/files-raw?path=${encodeURIComponent(targetPath || '.')}`);
        if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);

        // Siker: navigálás. A loadDirectory a normál API-t hívja,
        // de az útvonal beállítódik és a lista megjelenik.
        // Rejtett mappánál rawLoad-ot használunk.
        await loadDirectoryRaw(targetPath);
        cliClear();
      } catch (err) {
        cliPrint([{ text: `> HIBA: ${err.message}`, cls: 'cli-err' }]);
      }
      break;
    }

    // ------------------------------------------------------------------
    case 'open': {
      if (!arg) {
        cliPrint([{ text: '> Használat: open <fájl.kiterjesztés>', cls: 'cli-err' }]);
        break;
      }

      // Útvonal összerakása (abszolút vagy relatív)
      let filePath;
      if (arg.startsWith('/')) {
        filePath = arg.replace(/^\/+/, '');
      } else {
        filePath = currentPath ? `${currentPath}/${arg}` : arg;
      }
      filePath = filePath.replace(/\/+/g, '/');

      // Fájl metaadatainak lekérése (raw API)
      try {
        // A fájlt tartalmazó mappa és a fájl neve
        const segments  = filePath.split('/');
        const fileName  = segments.pop();
        const dirPath   = segments.join('/') || '.';

        const res = await fetch(`/api/files-raw?path=${encodeURIComponent(dirPath)}`);
        if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
        const data = await res.json();

        // Megkeressük a fájlt a listában (típus meghatározáshoz)
        const found = data.items.find(i => i.name === fileName);
        if (!found) throw new Error(`"${fileName}" nem található`);
        if (found.isDir) throw new Error(`"${fileName}" egy mappa, nem fájl`);

        // Fájl megnyitása típus szerint – ugyanazok a megjelenítők,
        // de a "raw" API végpontokat hívjuk a háttérben
        cliClear();
        await openItemByMeta(found, segments.join('/'));

      } catch (err) {
        cliPrint([{ text: `> HIBA: ${err.message}`, cls: 'cli-err' }]);
      }
      break;
    }

    // ------------------------------------------------------------------
    case 'ls': {
      // Aktuális mappa listázása (raw → rejtett is látszik)
      try {
        const p   = arg || currentPath || '.';
        const res = await fetch(`/api/files-raw?path=${encodeURIComponent(p)}`);
        if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
        const data = await res.json();

        if (data.items.length === 0) {
          cliPrint([{ text: '(üres mappa)', cls: 'cli-dim' }]);
        } else {
          cliPrint(data.items.map(i => ({
            text: `  ${getIcon(i.type).label}  ${i.name}${i.isDir ? '/' : ''}`,
            cls:  i.isDir ? 'cli-ok' : 'cli-info',
          })));
        }
      } catch (err) {
        cliPrint([{ text: `> HIBA: ${err.message}`, cls: 'cli-err' }]);
      }
      break;
    }

    // ------------------------------------------------------------------
    case 'clear':
    case 'cls':
      cliClear();
      break;

    // ------------------------------------------------------------------
    case 'help':
      cliPrint([
        { text: '── ELÉRHETŐ PARANCSOK ──────────────────', cls: 'cli-dim' },
        { text: '  cd <mappa>   Belépés mappába (rejtett is OK)', cls: 'cli-info' },
        { text: '  cd ..        Vissza a szülő mappába',           cls: 'cli-info' },
        { text: '  cd /         Gyökérbe ugrás',                   cls: 'cli-info' },
        { text: '  open <fájl>  Fájl megnyitása (rejtett is OK)',  cls: 'cli-info' },
        { text: '  ls [mappa]   Mappa tartalmának listázása',      cls: 'cli-info' },
        { text: '  clear        Kimenet törlése',                  cls: 'cli-info' },
        { text: '  help         Ez a súgó',                        cls: 'cli-info' },
        { text: '─────────────────────────────────────────', cls: 'cli-dim' },
        { text: '  ↑ / ↓        Előzmény visszahívása',           cls: 'cli-dim' },
        { text: '  TAB          Parancs automatikus kiegészítése', cls: 'cli-dim' },
      ]);
      break;

    // ------------------------------------------------------------------
    default:
      cliPrint([
        { text: `> Ismeretlen parancs: "${cmd}"`, cls: 'cli-err' },
        { text: '  Gépeld: help', cls: 'cli-dim' },
      ]);
  }

  // Prefix frissítése a navigáció után
  updateCliPrefix();
}

// ============================================================
// RAW KÖNYVTÁR BETÖLTÉS (rejtett mappákhoz is)
// Ugyanaz mint loadDirectory, de /api/files-raw-t hív
// ============================================================
async function loadDirectoryRaw(dirPath) {
  currentPath = dirPath;
  updateCliPrefix();

  fileListWrap.innerHTML = '<div class="loading-row">&gt; Mappa olvasása</div>';
  statusCount.textContent = 'Betöltés...';
  renderBreadcrumb(dirPath);

  let data;
  try {
    const res = await fetch(`/api/files-raw?path=${encodeURIComponent(dirPath || '.')}`);
    if (res.status === 401) {
      const body = await res.json();
      currentPath = ''; updateCliPrefix();
      showPasswordDialog(body.protectedRoot, () => loadDirectoryRaw(dirPath));
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    fileListWrap.innerHTML = `<div class="error-state">> HIBA: ${err.message}</div>`;
    statusCount.textContent = 'Hiba.';
    return;
  }

  currentItems  = data.items;
  selectedIndex = 0;
  renderFileList(data.items);
  renderBreadcrumb(data.path);
  updateStatusBar(data.items);
}

// ============================================================
// FÁJL MEGNYITÁSA METAADATOK ALAPJÁN (path-tól függetlenül)
// A CLI open parancsa hívja: meg kell adni a fájl item-et
// és a könyvtár útvonalát, ahol található
// ============================================================
async function openItemByMeta(item, dirPath) {
  // Ideiglenesen beállítjuk a currentPath-t, hogy a megjelenítők
  // a helyes URL-t használják, majd visszaállítjuk
  const savedPath = currentPath;
  currentPath     = dirPath;

  if      (item.type === 'md')                                  await openMarkdown(item);
  else if (item.type === 'yt')                                  await openYouTube(item);
  else if (item.type === 'img')                                       openImage(item);
  else if (['txt','json','js','css','html'].includes(item.type)) await openTextFile(item);
  else if (item.type === 'pdf') {
    const rel = dirPath ? `${dirPath}/${item.name}` : item.name;
    window.open(`/data/${rel}`, '_blank', 'noopener,noreferrer');
  } else {
    cliPrint([{ text: `> "${item.name}" típusa nem jeleníthető meg.`, cls: 'cli-err' }]);
  }

  currentPath = savedPath; // visszaállítás
}

// ============================================================
// BILLENTYŰZET: ENTER, ↑↓ előzmény, TAB kiegészítés
// ============================================================
cliInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const val = cliInput.value;
    cliInput.value = '';
    await runCliCommand(val);
  }

  // ↑: előző parancs
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (cliHistIdx < cliHistory.length - 1) {
      cliHistIdx++;
      cliInput.value = cliHistory[cliHistIdx];
      // Kurzort a sor végére
      setTimeout(() => cliInput.setSelectionRange(9999, 9999), 0);
    }
  }

  // ↓: következő (újabb) parancs
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (cliHistIdx > 0) {
      cliHistIdx--;
      cliInput.value = cliHistory[cliHistIdx];
    } else {
      cliHistIdx     = -1;
      cliInput.value = '';
    }
  }

  // TAB: egyszerű parancs-kiegészítés
  if (e.key === 'Tab') {
    e.preventDefault();
    tabComplete();
  }

  // Fájllistában ne navigáljon a nyíl, ha a promptban vagyunk
  if (['ArrowUp','ArrowDown'].includes(e.key)) e.stopPropagation();
});

// Futtatás gomb
cliRun.addEventListener('click', async () => {
  const val = cliInput.value;
  cliInput.value = '';
  cliInput.focus();
  await runCliCommand(val);
});

// ============================================================
// TAB KIEGÉSZÍTÉS
// Az aktuális gépelt szó alapján listázza a lehetőségeket
// ============================================================
async function tabComplete() {
  const val   = cliInput.value;
  const parts = val.trimStart().split(/\s+/);
  const cmd   = parts[0]?.toLowerCase();

  // Parancs kiegészítés (ha csak egy szó van)
  if (parts.length === 1) {
    const cmds    = ['cd', 'open', 'ls', 'clear', 'help'];
    const matches = cmds.filter(c => c.startsWith(cmd));
    if (matches.length === 1) {
      cliInput.value = matches[0] + ' ';
    } else if (matches.length > 1) {
      cliPrint(matches.map(m => ({ text: `  ${m}`, cls: 'cli-dim' })));
    }
    return;
  }

  // Útvonal kiegészítés (cd / open parancs esetén)
  if (cmd === 'cd' || cmd === 'open') {
    const partial   = parts[1] || '';
    const segments  = partial.split('/');
    const prefix    = segments.slice(0, -1).join('/');
    const search    = segments[segments.length - 1].toLowerCase();
    const lookInDir = prefix
      ? (currentPath ? `${currentPath}/${prefix}` : prefix)
      : (currentPath || '.');

    try {
      const res = await fetch(`/api/files-raw?path=${encodeURIComponent(lookInDir)}`);
      if (!res.ok) return;
      const data    = await res.json();
      const matches = data.items.filter(i =>
        i.name.toLowerCase().startsWith(search) &&
        (cmd === 'cd' ? i.isDir : !i.isDir || cmd === 'open')
      );

      if (matches.length === 1) {
        const completed = prefix ? `${prefix}/${matches[0].name}` : matches[0].name;
        cliInput.value  = `${cmd} ${completed}${matches[0].isDir ? '/' : ''}`;
      } else if (matches.length > 1) {
        cliPrint(matches.map(m => ({
          text: `  ${m.name}${m.isDir ? '/' : ''}`,
          cls:  m.isDir ? 'cli-ok' : 'cli-info',
        })));
      }
    } catch { /* nem kritikus */ }
  }
}
