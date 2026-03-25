// ============================================================
// server.js – Express szerver + jelszavas mappa védelem
//
// Függőségek: express, bcryptjs, jsonwebtoken, cookie-parser
// Telepítés:  npm install
//
// Jelszó beállítása egy mappához:
//   node setup-password.js public/data/titkos
// ============================================================

const express      = require('express');
const path         = require('path');
const fs           = require('fs');
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app  = express();
const PORT = 3000;

// ---- Konfiguráció -----------------------------------------------

// Az adat-gyökér: public/data
const DATA_ROOT = path.join(__dirname, 'public', 'data');

// Rejtett mappák nevei a fájllistából
const HIDDEN_DIRS = ['file'];

// JWT titkos kulcs: .env-ből, vagy indításkor generált véletlen érték.
// Dockerben adj meg egy fix JWT_SECRET env változót, hogy újraindításkor
// ne invalidálódjanak a régi tokenek.
const JWT_SECRET = process.env.JWT_SECRET || require('crypto').randomBytes(48).toString('hex');

// JWT élettartam: 8 óra (azután újra kell a jelszó)
const JWT_TTL    = '8h';

// ---- Middleware --------------------------------------------------
app.use(express.json());          // JSON body parsing (POST-hoz)
app.use(cookieParser());          // Cookie olvasás/írás


// ============================================================
// SEGÉDFÜGGVÉNYEK
// ============================================================

function formatSize(bytes) {
  if (bytes < 1024)         return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileType(name, isDir) {
  if (isDir) return 'dir';
  const ext = path.extname(name).toLowerCase();
  return ({
    '.md': 'md', '.txt': 'txt',
    '.jpg': 'img', '.jpeg': 'img', '.png': 'img', '.gif': 'img', '.webp': 'img', '.svg': 'img',
    '.yt': 'yt', '.json': 'json', '.js': 'js', '.css': 'css', '.html': 'html', '.pdf': 'pdf',
  })[ext] || 'file';
}

// Megkeresi a legszorosabb .password fájlt a megadott útvonal fa-struktúrájában.
// Visszaadja az útvonal-prefix-et, amelyhez a védelem tartozik, vagy null-t.
// Pl.: "projektek/titkos/kepek" → megtalálja "projektek/titkos/.password"-t
function findProtectionRoot(relPath) {
  const segments = relPath ? relPath.split('/').filter(Boolean) : [];
  // A gyökértől lefelé haladva keressük a legközelebbi .password-t
  // (az első találat érvényes, az almappák is védve vannak)
  for (let i = 0; i <= segments.length; i++) {
    const checkDir  = path.join(DATA_ROOT, ...segments.slice(0, i));
    const pwFile    = path.join(checkDir, '.password');
    if (fs.existsSync(pwFile)) {
      // A védelem gyökere: az a relatív útvonal ahol a .password van
      return segments.slice(0, i).join('/') || '';
    }
  }
  return null; // Nem védett
}

// JWT token érvényességének ellenőrzése a sütikből.
// Visszaadja a dekódolt payload-ot, vagy null-t ha érvénytelen.
function getTokenPayload(req) {
  const token = req.cookies?.dir_token;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Ellenőrzi, hogy a kért útvonalhoz van-e érvényes token a sütikben.
// A token a "protectedRoot" mezőt tartalmazza – ha a kért útvonal
// ezzel kezdődik, a hozzáférés engedélyezett.
function isAuthorized(req, protectionRoot) {
  const payload = getTokenPayload(req);
  if (!payload) return false;
  // A token a pontos védett gyökér útvonalát tárolja
  return payload.protectedRoot === protectionRoot;
}

// Mappa tartalmának listázása (közös logika /api/files és /api/files-raw-hoz)
function listDirectory(absPath, filterHidden) {
  const entries = fs.readdirSync(absPath);
  return entries
    .filter(name => {
      if (name.startsWith('.')) return false;            // dot-fájlok mindig rejtve
      if (name === '.password') return false;            // .password soha nem látható
      if (filterHidden && HIDDEN_DIRS.includes(name.toLowerCase())) return false;
      return true;
    })
    .map(name => {
      const fp = path.join(absPath, name);
      let stat;
      try { stat = fs.statSync(fp); } catch { return null; }
      const isDir = stat.isDirectory();
      return {
        name, type: getFileType(name, isDir), isDir,
        size: isDir ? null : formatSize(stat.size),
        sizeRaw: isDir ? 0 : stat.size,
        modified: stat.mtime.toISOString().slice(0, 10),
        // Jelzi, hogy ez a mappa jelszóval védett-e (csak mappáknál)
        locked: isDir ? fs.existsSync(path.join(fp, '.password')) : false,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

// Path traversal védelem + létezés ellenőrzés
function resolveSafePath(reqPath) {
  const absPath = path.resolve(DATA_ROOT, reqPath || '.');
  if (!absPath.startsWith(DATA_ROOT)) return null;
  if (!fs.existsSync(absPath))        return null;
  return absPath;
}


// ============================================================
// AUTH MIDDLEWARE – védett mappák kapuőre
// Minden /api/* végpont elé fut, ha a mappa védett
// ============================================================
function requireAuth(req, res, next) {
  const reqPath = req.query.path || req.body?.path || '.';

  // A "." esetén a gyökeret nézzük
  const relPath = reqPath === '.' ? '' : reqPath;

  // Van-e .password fájl a fa valamely szintjén?
  const protRoot = findProtectionRoot(relPath);
  if (protRoot === null) {
    // Nem védett útvonal → szabad átjárás
    return next();
  }

  // Védett – van-e érvényes token?
  if (isAuthorized(req, protRoot)) {
    return next();
  }

  // Nincs token vagy érvénytelen → 401, a frontend feldobja a jelszó dialógot
  return res.status(401).json({
    error:          'Jelszó szükséges.',
    protectedRoot:  protRoot,   // A kliens tudja, melyik mappáért kell jelszó
  });
}


// ============================================================
// API: POST /api/auth/unlock  – jelszó ellenőrzés + token kiadás
// Body: { path: "relatív/útvonal", password: "titkos" }
// ============================================================
app.post('/api/auth/unlock', async (req, res) => {
  const { path: reqPath, password } = req.body || {};

  if (!password) return res.status(400).json({ error: 'Hiányzó jelszó.' });

  const relPath  = (reqPath && reqPath !== '.') ? reqPath : '';
  const protRoot = findProtectionRoot(relPath);

  if (protRoot === null) {
    return res.status(400).json({ error: 'Ez a mappa nem védett.' });
  }

  // .password fájl beolvasása
  const pwFile = path.join(DATA_ROOT, protRoot, '.password');
  if (!fs.existsSync(pwFile)) {
    return res.status(500).json({ error: '.password fájl nem olvasható.' });
  }

  const hash = fs.readFileSync(pwFile, 'utf8').trim();

  // Bcrypt összehasonlítás (aszinkron, timing-safe)
  const ok = await bcrypt.compare(password, hash);
  if (!ok) {
    // 1 másodperces késleltetés brute-force ellen
    await new Promise(r => setTimeout(r, 1000));
    return res.status(403).json({ error: 'Hibás jelszó.' });
  }

  // JWT token kiállítása
  const token = jwt.sign(
    { protectedRoot: protRoot },
    JWT_SECRET,
    { expiresIn: JWT_TTL }
  );

  // Süti beállítása: HttpOnly, SameSite=Strict
  res.cookie('dir_token', token, {
    httpOnly: true,               // JS nem férhet hozzá → XSS védelem
    sameSite: 'strict',           // CSRF védelem
    secure:   process.env.NODE_ENV === 'production', // HTTPS-en mindig Secure
    maxAge:   8 * 60 * 60 * 1000, // 8 óra ms-ban
  });

  res.json({ ok: true, protectedRoot: protRoot });
});


// ============================================================
// API: GET /api/files?path=  – fájllista (védett mappák kizárva)
// ============================================================
app.get('/api/files', requireAuth, (req, res) => {
  const reqPath = req.query.path || '.';
  const absPath = resolveSafePath(reqPath);
  if (!absPath) return res.status(404).json({ error: 'A mappa nem található.' });

  try {
    const items = listDirectory(absPath, true); // filterHidden=true
    res.json({ path: reqPath === '.' ? '' : reqPath, items });
  } catch {
    res.status(500).json({ error: 'Nem olvasható a mappa.' });
  }
});


// ============================================================
// API: GET /api/files-raw?path=  – fájllista, HIDDEN_DIRS szűrés nélkül
// CLI prompt használja; auth ugyanúgy érvényes
// ============================================================
app.get('/api/files-raw', requireAuth, (req, res) => {
  const reqPath = req.query.path || '.';
  const absPath = resolveSafePath(reqPath);
  if (!absPath) return res.status(404).json({ error: 'A mappa nem található.' });

  try {
    const items = listDirectory(absPath, false); // filterHidden=false
    res.json({ path: reqPath === '.' ? '' : reqPath, items });
  } catch {
    res.status(500).json({ error: 'Nem olvasható.' });
  }
});


// ============================================================
// API: GET /api/read?path=  – fájl tartalom olvasás
// ============================================================
app.get('/api/read', requireAuth, (req, res) => {
  const reqPath = req.query.path;
  if (!reqPath) return res.status(400).json({ error: 'Hiányzó path paraméter.' });

  const absPath = resolveSafePath(reqPath);
  if (!absPath) return res.status(404).json({ error: 'A fájl nem található.' });

  const allowed = ['.md', '.txt', '.yt', '.json', '.js', '.css', '.html'];
  if (!allowed.includes(path.extname(absPath).toLowerCase()))
    return res.status(415).json({ error: 'Ez a fájltípus nem olvasható.' });

  try {
    res.type('text/plain; charset=utf-8').send(fs.readFileSync(absPath, 'utf8'));
  } catch {
    res.status(500).json({ error: 'Nem olvasható a fájl.' });
  }
});


// ============================================================
// API: GET /api/read-raw?path=  – fájl tartalom, CLI-hez
// ============================================================
app.get('/api/read-raw', requireAuth, (req, res) => {
  const reqPath = req.query.path;
  if (!reqPath) return res.status(400).json({ error: 'Hiányzó path.' });

  const absPath = resolveSafePath(reqPath);
  if (!absPath) return res.status(404).json({ error: 'A fájl nem található.' });

  const allowed = ['.md', '.txt', '.yt', '.json', '.js', '.css', '.html'];
  if (!allowed.includes(path.extname(absPath).toLowerCase()))
    return res.status(415).json({ error: 'Ez a fájltípus nem olvasható szövegként.' });

  try {
    res.type('text/plain; charset=utf-8').send(fs.readFileSync(absPath, 'utf8'));
  } catch {
    res.status(500).json({ error: 'Olvasási hiba.' });
  }
});


// ============================================================
// Statikus fájlok + SPA fallback
// ============================================================
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// ============================================================
// Szerver indítása
// ============================================================
app.listen(PORT, () => {
  console.log(`[SERVER] Fut: http://localhost:${PORT}`);
  console.log(`[SERVER] Adatgyökér: ${DATA_ROOT}`);
  if (!process.env.JWT_SECRET) {
    console.warn('[SERVER] ⚠️  JWT_SECRET nincs beállítva! Minden újraindításkor új kulcs generálódik.');
    console.warn('[SERVER]    Dockerben add meg: -e JWT_SECRET=<titkos_kulcs>');
  }
  if (!fs.existsSync(DATA_ROOT)) {
    fs.mkdirSync(DATA_ROOT, { recursive: true });
    console.log('[SERVER] public/data mappa létrehozva.');
  }
});
