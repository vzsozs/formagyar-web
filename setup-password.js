#!/usr/bin/env node
// ============================================================
// setup-password.js – Jelszó hash generáló segédeszköz
//
// Használat:
//   node setup-password.js <mappa-útvonal>
//
// Példa:
//   node setup-password.js public/data/titkos
//   node setup-password.js public/data/projektek/bizalmas
//
// Ez a script:
//   1. Bekéri a jelszót a terminálból (nem jelenik meg gépelés közben)
//   2. BCrypt-tel hash-eli (cost factor: 12)
//   3. Elmenti a mappa .password fájljába
//   4. A szerver ezentúl ezt a hash-t használja az ellenőrzéshez
// ============================================================

const bcrypt   = require('bcryptjs');
const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

// Parancssori argumentum: mappa útvonala
const targetDir = process.argv[2];
if (!targetDir) {
  console.error('\n  ❌  Hiányzó argumentum!');
  console.error('  Használat: node setup-password.js <mappa-útvonal>');
  console.error('  Példa:     node setup-password.js public/data/titkos\n');
  process.exit(1);
}

const absTarget = path.resolve(process.cwd(), targetDir);

// Mappa létezik-e?
if (!fs.existsSync(absTarget) || !fs.statSync(absTarget).isDirectory()) {
  console.error(`\n  ❌  A mappa nem létezik: ${absTarget}\n`);
  process.exit(1);
}

// Jelszó bekérése (rejtetten, echo nélkül)
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// readline nem tud natively elrejteni, ezért raw mode-ot használunk
function askPassword(prompt) {
  return new Promise(resolve => {
    process.stdout.write(prompt);
    let pw = '';

    // stdin raw módba – hogy karakterenként olvassunk és ne echozzunk
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      process.stdin.on('data', function handler(ch) {
        if (ch === '\r' || ch === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', handler);
          process.stdout.write('\n');
          resolve(pw);
        } else if (ch === '\u0003') { // Ctrl+C
          process.exit();
        } else if (ch === '\u007f') { // Backspace
          if (pw.length > 0) { pw = pw.slice(0, -1); process.stdout.write('\b \b'); }
        } else {
          pw += ch;
          process.stdout.write('*');
        }
      });
    } else {
      // CI / pipe módban: sima readline
      rl.question('', ans => { resolve(ans); });
    }
  });
}

async function main() {
  console.log(`\n  🔐  Jelszó beállítása: ${absTarget}\n`);

  const pw1 = await askPassword('  Jelszó:         ');
  if (pw1.length < 4) {
    console.error('\n  ❌  A jelszó legalább 4 karakter legyen.\n');
    process.exit(1);
  }

  const pw2 = await askPassword('  Jelszó újra:    ');
  if (pw1 !== pw2) {
    console.error('\n  ❌  A két jelszó nem egyezik.\n');
    process.exit(1);
  }

  process.stdout.write('\n  ⏳  Hash generálás (bcrypt, cost=12)...');
  const hash = await bcrypt.hash(pw1, 12);

  const pwFile = path.join(absTarget, '.password');
  fs.writeFileSync(pwFile, hash, 'utf8');

  console.log(' kész!');
  console.log(`\n  ✅  .password fájl létrehozva: ${pwFile}`);
  console.log('      A mappa mostantól jelszóval védett.\n');

  rl.close();
}

main().catch(err => { console.error(err); process.exit(1); });
