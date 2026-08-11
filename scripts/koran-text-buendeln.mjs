// Erzeugt `src/data/quranText.generated.json` — den vollstaendigen Korantext
// Wort fuer Wort (arabisch + lateinische Umschrift), damit der Leser OHNE JEDE
// vorherige Verbindung funktioniert.
//
// WARUM GEBUENDELT UND NICHT NUR ZWISCHENGESPEICHERT: Die Ablage (lib/cache.ts)
// haelt nur, was schon einmal geladen wurde. Ein frisch eingerichteter
// Fernseher in einem Haus ohne WLAN zeigte damit gar keinen Vers. Der Text
// aendert sich nicht — er gehoert ins Paket, nicht ins Netz.
//
// WAS NICHT GEBUENDELT WIRD, und warum:
//   • Uebersetzungen — 14 Sprachen waeren ein Vielfaches der Textgroesse, und
//     welche gebraucht wird, steht erst auf dem Geraet fest. Sie kommt aus dem
//     Netz und bleibt danach in der Ablage.
//   • Rezitation und Wort-Zeitstempel — Audio ist ein Stream; die Zeitstempel
//     nuetzen ohne ihn nichts.
//
// Quelle: api.quran.com/api/v4 (dieselbe wie zur Laufzeit). Der Lauf holt die
// 114 Suren nacheinander mit kurzer Pause — ein Einmal-Skript, kein Grund,
// einen fremden kostenlosen Dienst mit 114 gleichzeitigen Anfragen zu treffen.
//
//   node scripts/koran-text-buendeln.mjs
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const ZIEL = join(HIER, '..', 'src', 'data', 'quranText.generated.json');
const BASE = 'https://api.quran.com/api/v4';
/** Verszahl je Sure — dient als Vollstaendigkeitspruefung, nicht als Vorgabe. */
const VERSE_JE_SURE = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

async function holeSure(n) {
  const url = `${BASE}/verses/by_chapter/${n}?words=true&word_fields=text_uthmani,transliteration&per_page=300`;
  for (let versuch = 1; versuch <= 4; versuch++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (!Array.isArray(j.verses) || j.verses.length === 0) throw new Error('leere Antwort');
      return j.verses;
    } catch (e) {
      if (versuch === 4) throw new Error(`Sure ${n} nach 4 Versuchen: ${e.message}`);
      await new Promise((f) => setTimeout(f, 1500 * versuch));
    }
  }
  return [];
}

// Vorhandenen Stand weiterschreiben, damit ein Abbruch nicht alles verwirft.
const bestand = existsSync(ZIEL) ? JSON.parse(readFileSync(ZIEL, 'utf8')) : {};
const suren = bestand.suren ?? {};

for (let n = 1; n <= 114; n++) {
  if (Array.isArray(suren[n]) && suren[n].length === VERSE_JE_SURE[n - 1]) {
    continue; // schon vollstaendig
  }
  const verses = await holeSure(n);
  // Nur `char_type_name === 'word'`: die Antwort enthaelt zusaetzlich das
  // Vers-Ende-Zeichen als eigenes „Wort". Im Leser waere das ein Kaestchen
  // mitten im Satz.
  suren[n] = verses.map((v) =>
    v.words
      .filter((w) => w.char_type_name === 'word')
      .map((w) => [w.text_uthmani ?? w.text ?? '', w.transliteration?.text ?? '']),
  );
  if (suren[n].length !== VERSE_JE_SURE[n - 1]) {
    throw new Error(`Sure ${n}: ${suren[n].length} Verse statt ${VERSE_JE_SURE[n - 1]}`);
  }
  process.stdout.write(`\rSure ${n}/114 (${suren[n].length} Verse)   `);
  writeFileSync(ZIEL, JSON.stringify({ quelle: 'api.quran.com/api/v4', suren }), 'utf8');
  await new Promise((f) => setTimeout(f, 120));
}

const gesamt = Object.values(suren).reduce((a, v) => a + v.length, 0);
console.log(`\nfertig: ${gesamt} Verse (erwartet 6236)`);
if (gesamt !== 6236) {
  console.error('Verszahl weicht ab — nicht ausliefern.');
  process.exit(1);
}
console.log(`${ZIEL} · ${(readFileSync(ZIEL).length / 1024 / 1024).toFixed(2)} MB`);
