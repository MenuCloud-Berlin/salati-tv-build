// Erzeugt `src/data/quiz.json` aus dem kuratierten Fragen-Bestand der Handy-App
// (`apps/mobile/src/features/practice/trivia.json`).
//
// Warum abgeleitet statt selbst uebersetzt (Audit 2026-07-28, T15):
// der TV-Fragenkatalog war fest deutsch. Die 18 Fragen in 13 weitere Sprachen
// zu uebertragen hiesse, religioeses Grundwissen frei zu uebersetzen — eine
// falsche Antwortoption ist dort ein inhaltlicher Fehler, kein Stilproblem.
// Die Handy-App fuehrt denselben Stoff bereits in allen 14 Sprachen, kuratiert
// und durch `apps/mobile/src/features/content-i18n.test.ts` abgesichert. Also
// wird die TV-Auswahl aus dieser Quelle GEZOGEN, nicht neu uebersetzt.
//
// Aufruf:  node scripts/build-quiz.mjs
// Der Test `src/data/quiz.test.ts` prueft, dass die eingecheckte Datei noch
// Wort fuer Wort zur Quelle passt — driftet trivia.json, faellt das auf.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TRIVIA = path.join(HERE, '..', '..', 'mobile', 'src', 'features', 'practice', 'trivia.json');
const OUT = path.join(HERE, '..', 'src', 'data', 'quiz.json');

/**
 * Auswahl fuer den Fernseher — 32 Fragen aus den Kategorien `knowledge` und
 * `quran`. Kriterien, in dieser Reihenfolge:
 *
 *  1. Die 13 Fragen, die es im bisherigen deutschen TV-Katalog schon gab und
 *     die im Handy-Bestand eine inhaltlich gleiche Entsprechung haben, sind
 *     alle dabei (mit * markiert).
 *  2. Kurze Antwortoptionen: auf 10 Fuss Abstand in einem 2x2-Raster lesbar.
 *     Alles ueber ~30 Zeichen (Sahaba-/Akhlaq-/Nikah-Fragen sind ganze Saetze)
 *     faellt raus.
 *  3. Breit unstrittiges Grundwissen, keine Fiqh-Streitfragen, keine
 *     Grammatik- oder Dialektfragen (die gehoeren in den Lernteil der
 *     Handy-App, nicht in ein Wohnzimmer-Quiz).
 */
const SELECTION = [
  // Saeulen & Gebet
  'pillars-count', // *
  'prayers-count', // *
  'iman-pillars',
  'fajr',
  'wudu',
  'adhan',
  'imam',
  'muezzin',
  'friday',
  'qibla', // *
  // Qur'an
  'surah-count', // *
  'first-surah', // *
  'last-surah',
  'longest-surah',
  'shortest-surah', // *
  'juz-count',
  'quran-language',
  'no-bismillah', // *
  'yasin-heart', // *
  'most-named-prophet', // *
  'laylat-alqadr', // *
  // Saeulen: Fasten, Zakat, Hadsch
  'ramadan',
  'zakat',
  'hajj', // *
  'eid-fitr', // *
  'eid-adha',
  // Kalender & Geschichte
  'hijra',
  'hijri-months',
  'hijri-first-month',
  'prophet-birth-city',
  'first-caliph',
  'first-muezzin', // *
];

const LOCALES = ['de', 'en', 'tr', 'ar', 'es', 'fr', 'id', 'bn', 'fa', 'ms', 'ur', 'ru', 'sw', 'ps'];

const source = JSON.parse(fs.readFileSync(TRIVIA, 'utf8'));
const byId = new Map(source.questions.map((q) => [q.id, q]));

const questions = SELECTION.map((id) => {
  const q = byId.get(id);
  if (!q) throw new Error(`Frage "${id}" steht nicht (mehr) in trivia.json`);
  // Nur die 14 App-Sprachen uebernehmen und in fester Reihenfolge schreiben,
  // damit ein Neulauf keinen Schluessel-Shuffle im Diff erzeugt.
  const pick = (o) => {
    const out = {};
    for (const l of LOCALES) {
      const v = o[l];
      if (typeof v !== 'string' || !v.trim()) throw new Error(`${id}: ${l} fehlt`);
      out[l] = v;
    }
    return out;
  };
  if (q.options.length !== 4) throw new Error(`${id}: ${q.options.length} Optionen statt 4`);
  return { id, category: q.category, q: pick(q.q), options: q.options.map(pick) };
});

const json = {
  note:
    'GENERIERT — nicht von Hand aendern. Quelle: apps/mobile/src/features/practice/trivia.json, ' +
    'Auswahl und Erzeugung in apps/tv/scripts/build-quiz.mjs. options[0] ist immer die richtige ' +
    'Antwort; die Reihenfolge wird zur Laufzeit gemischt (QuizScreen).',
  source: 'apps/mobile/src/features/practice/trivia.json',
  questions,
};

fs.writeFileSync(OUT, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
console.log(`${questions.length} Fragen x ${LOCALES.length} Sprachen -> ${path.relative(process.cwd(), OUT)}`);
