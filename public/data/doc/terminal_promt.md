### PROJECT OVERVIEW (CONTEXT FOR AI)

Szia Claude! Egy Ubuntu VPS-en futó, Node.js alapú személyes bemutatkozó oldalt építek.

A stílus: "Retro-futurista / Low-level Terminal".

Csatoltam egy képet (mood.jpg), ami a vizuális iránytűt jelenti a projekthez. Kérlek, elemezd a színeket, a rácshálót (grid) és a betűk stílusát. Azt szeretném, ha a weboldal pont ezt a hangulatot árasztaná: a sötét hátteret, a finom ragyogást a szöveg körül és a pixeles karaktereket.

Főbb jellemzők: Pixeles betűtípusok, sötét háttér, grid-vonalak, Markdown és YouTube (.yt) fájlok kezelése, saját jobb klikk menü.

Egyéb: Légyszíves magyarul kommenteld a kódot, hogy tudjam hol mit csinálok.

---

### TASK 1: INITIAL UI \& SERVER SETUP

Kérlek, készítsd el az alapokat (server.js, index.html, style.css, script.js):

1. **Backend (Node.js/Express):**

- Hozz létre egy alap Express szervert a 3000-es porton.
- Szolgálja ki a statikus fájlokat egy `public` mappából.

2. **Frontend Design (CSS):**

- Háttér: Fekete (mint a régi kijelzők), egy nagyon halvány, sötétszürke rácshálóval (grid line-okkal).
- Betűtípus: Használj egy Google Fonts-ról behúzott pixeles fontot (pl. 'Press Start 2P'). Monokróm zöld/cián pixeles betűtípus
- Színek: cián/zöld szöveg, narancssárga kiemelések.
- Grafika: Ne használj külső képeket, mindent CSS-sel (grid, glow effekt) és karakterekkel oldj meg.

3. **Interakció (A "Ready?" Screen):**

- Betöltéskor a képernyő közepén jelenjen meg a pixeles "Ready?" felirat.
- A szöveg végén legyen egy **folyamatosan villogó kurzor block** (mint a régi terminálokon).
- A felirat alatt legyen két gomb: egy narancssárga **[ Y ]** és egy fehér **[ N ]**.
- Ha az [Y]-ra kattintok a "Ready?" rész egy CRT-monitor kikapcsolásához hasonló animációval (vagy egyszerű fade-out-tal) tűnjön el, és adjon helyet egy üres, keretezett főpanelnek.

Kérlek, add meg a teljes induló kódkészletet!

### TASK 2: DYNAMIC FILE LISTING

A design szuper! Most tegyük funkcionálissá a rendszert:

Dinamikus lista: A szerver listázza egy adott mappa tartalmát (mappák, .md fájlok, képek). Ha új mappát hozok létre a szerveren, az frissítés után jelenjen meg.

1. **Szerver oldali logika (Node.js):**

- A szerver olvassa be a `public/data` mappa tartalmát az `fs` modullal.
- Listázza ki a mappákat és fájlokat (név, kiterjesztés, méret).
- **Fontos:** Ha a mappa neve "file", azt szűrd ki a listából, ne küldd el a kliensnek (rejtett mappa).

2. **Kliens oldali megjelenítés:**

- Miután az [Y]-ra kattintottam, a főpanelben jelenjen meg a fájllista mint egy régi fájkezelő.
- Használj ASCII karaktereket vagy CSS-ből rajzolt ikonokat a típusok jelölésére (pl. `[DIR]` a mappáknak, `[TXT]` a fájloknak).
- A lista legyen interaktív: lehessen navigálni a mappák között (breadcrumb vagy "vissza" gomb támogatásával).

### TASK 3: CONTENT RENDERING (.md \& .yt \& pdf)

Most adjunk értelmet a kattintásoknak:

1. **Markdown (.md):**

- Ha egy .md fájlra kattintok, töltsd be a tartalmát AJAX-szal (vagy fetch-sel).
- Használj egy könnyű library-t (pl. `marked.js`), hogy a szöveg formázottan (bold, italic, listák) jelenjen meg egy felugró terminál-ablakban.

2. **YouTube (.yt) integráció:**

- A szerveren létrehozok `.yt` fájlokat, amikben csak egy YouTube URL van (pl. `https://www.youtube.com/watch?v=...`).
- Ha a fájllistában ilyen fájlt találsz, jeleníts meg mellette egy \[VIDEO] ikont.
- Kattintásra ne töltsd le, hanem ágyazd be a videót egy `<iframe>`-be a felületen belül, mintha egy beépített lejátszó lenne.

### TASK 4: CUSTOM CONTEXT MENU

Utolsó lépésként tiltsuk le a böngésző gyári jobb egérgombos menüjét, és készítsünk egy sajátot:

1. **Custom Context Menu:**

- Csak a fájlokon és mappákon való jobb klikknél jelenjen meg.
- Megjelenés: Pixeles keret, sötét háttér, narancssárga kijelölés.
- Funkciók:
- "Letöltés" (közvetlen link a fájlra),
- "Link címének másolása" (clipboard API),
- "Link mentése másként" (download attribute),
- "Link megnyitása új lapon".

2. **Finomhangolás:**

- Gondoskodj róla, hogy ha a menün kívülre kattintok, a menü eltűnjön.

### Javítások / módosítások:

Az alábbi dolgokat finomítsuk légyszi:

1. **Képnézegető:**

- Ha egy .jpg, .png, .gif, .webp fájlra kattintok, töltsd be a tartalmát légyszi egy képnézegetővel.

2. **Olvasó:**

- Az .md olvasó jelenleg a számozásnál (1. 2. 3. stb) mindenhol 1. ír ki, és a ### (Hero) szövegeknél a ### kiírás ott marad,
- Ha egy .json, .txt, .css, .html fájlra kattintok, töltsd be a tartalmát úgy mint az .md tartalmakat.

3. **PDF:**

- Ha egy .pdf-re kattintanak egy új lapon nyissa meg.

4. **Megjelenés:**

- Adjunk ikonokat a mappáknak
- A Ready képernyőn a szövegek íródjanak ki.
- "▶" ikon vertikálisan nincsen középen.
- LOADING PERSONALITY MODULE-nál az elején egy kamu betöltő csík menjen végig és utána írja ki az OK-ot, utána jelenjen meg a AWAITING USER INPUT
- amikor rányomok Y gombra és eltűnik a (Ready?) panel ennek az animációja nagyon szép, olyan legyen ennek a panelnek (Ready?) a megjelenése is, csak visszafelé.

5. **PROMT**

- alul legyen egy promt mező hol be tudom írni pl: cd file/akarmi.jpg és akkor hiába van eltüntetve megnyitja. vagy cd file/ akkor belép a mappába.
