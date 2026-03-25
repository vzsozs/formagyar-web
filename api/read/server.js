// ============================================================
// server.js – Express szerver fájllistázó API-val
// Feladat: statikus fájlok + /api/files?path= végpont
// ============================================================

const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = 3000;

// Az adat-gyökér: public/data – ide kerülnek a feltöltendő mappák/fájlok
const DATA_ROOT = path.join(__dirname, 'public', 'data');

// Rejtett mappák nevei – ezeket kiszűrjük a listából
const HIDDEN_DIRS = ['file'];

// ---- Segédfüggvény: fájlméret ember-olvasható formátumba ---------------
function formatSize(bytes) {
  if (bytes < 1024)             return `${bytes} B`;
  if (bytes < 1024 * 1024)     return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---- Segédfüggvény: fájltípus meghatározása kiterjesztés alapján -------
function getFileType(name, isDir) {
  if (isDir) return 'dir';
  const ext = path.extname(name).toLowerCase();
  const types = {
    '.md':   'md',
    '.txt':  'txt',
    '.jpg':  'img', '.jpeg': 'img', '.png': 'img',
    '.gif':  'img', '.webp': 'img', '.svg': 'img',
    '.yt':   'yt',   // YouTube link fájl (következő task)
    '.json': 'json',
    '.js':   'js',
    '.css':  'css',
    '.html': 'html',
    '.pdf':  'pdf',
  };
  return types[ext] || 'file';
}

// ---- API végpont: GET /api/files?path=almappa/almappa ----------------
// Visszaadja a megadott relatív útvonal tartalmát JSON-ban
app.get('/api/files', (req, res) => {

  // Relatív útvonal a query stringből (alapértelmezés: gyökér ".")
  const reqPath = req.query.path || '.';

  // Biztonsági check: megakadályozza a könyvtárból való kilépést (path traversal)
  const absPath = path.resolve(DATA_ROOT, reqPath);
  if (!absPath.startsWith(DATA_ROOT)) {
    return res.status(403).json({ error: 'Tiltott útvonal.' });
  }

  // Ellenőrzés: létezik-e a mappa?
  if (!fs.existsSync(absPath)) {
    return res.status(404).json({ error: 'A mappa nem található.' });
  }

  let entries;
  try {
    entries = fs.readdirSync(absPath);
  } catch (err) {
    return res.status(500).json({ error: 'Nem olvasható a mappa.' });
  }

  // Bejárás, szűrés, metaadatok gyűjtése
  const items = entries
    .filter(name => {
      // Rejtett fájlok kizárása (pont-tal kezdődők)
      if (name.startsWith('.')) return false;
      // "file" nevű mappák kizárása (és egyéb HIDDEN_DIRS elemek)
      if (HIDDEN_DIRS.includes(name.toLowerCase())) return false;
      return true;
    })
    .map(name => {
      const fullPath = path.join(absPath, name);
      let stat;
      try { stat = fs.statSync(fullPath); }
      catch { return null; } // olvasási hiba esetén kihagyjuk

      const isDir = stat.isDirectory();
      return {
        name,
        type:     getFileType(name, isDir),
        isDir,
        size:     isDir ? null : formatSize(stat.size),
        sizeRaw:  isDir ? 0 : stat.size,
        modified: stat.mtime.toISOString().slice(0, 10), // YYYY-MM-DD
      };
    })
    .filter(Boolean) // null-ok kiszűrése
    .sort((a, b) => {
      // Mappák előre, fájlok utána; azon belül ABC sorrend
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  // Relatív útvonal visszaküldése (breadcrumb-hoz kell a kliensen)
  res.json({
    path:  reqPath === '.' ? '' : reqPath,
    items,
  });
});

// ---- API végpont: GET /api/read?path=mappa/fajl.md ------------------
// Visszaadja egy fájl tartalmát nyers szövegként (MD, TXT, YT)
// Csak a DATA_ROOT-on belüli fájlokhoz enged hozzáférést (biztonság)
app.get('/api/read', (req, res) => {
  const reqPath = req.query.path;
  if (!reqPath) return res.status(400).json({ error: 'Hiányzó path paraméter.' });

  // Path traversal védelem
  const absPath = path.resolve(DATA_ROOT, reqPath);
  if (!absPath.startsWith(DATA_ROOT)) {
    return res.status(403).json({ error: 'Tiltott útvonal.' });
  }

  // Csak ismert szöveges kiterjesztéseket engedünk olvasni
  const allowed = ['.md', '.txt', '.yt', '.json', '.js', '.css', '.html'];
  if (!allowed.includes(path.extname(absPath).toLowerCase())) {
    return res.status(415).json({ error: 'Ez a fájltípus nem olvasható.' });
  }

  if (!fs.existsSync(absPath)) {
    return res.status(404).json({ error: 'A fájl nem található.' });
  }

  try {
    // UTF-8 szöveg visszaküldése
    const content = fs.readFileSync(absPath, 'utf8');
    res.type('text/plain; charset=utf-8').send(content);
  } catch (err) {
    res.status(500).json({ error: 'Nem olvasható a fájl.' });
  }
});

// Statikus fájlok kiszolgálása a 'public' könyvtárból
app.use(express.static(path.join(__dirname, 'public')));

// Minden egyéb GET → index.html (SPA-kompatibilis)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Szerver indítása
app.listen(PORT, () => {
  console.log(`[SERVER] Fut: http://localhost:${PORT}`);
  console.log(`[SERVER] Adatgyökér: ${DATA_ROOT}`);

  // Ha még nem létezik a data mappa, létrehozzuk
  if (!fs.existsSync(DATA_ROOT)) {
    fs.mkdirSync(DATA_ROOT, { recursive: true });
    console.log('[SERVER] public/data mappa létrehozva.');
  }
});
