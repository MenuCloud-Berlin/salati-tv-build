/**
 * Fragenkatalog des TV-Quiz (Audit 2026-07-28, T15).
 *
 * Zwei Dinge werden hier festgehalten:
 *
 *  1. **Sprachparitaet.** Fehlt eine Sprache in einer Frage, faellt
 *     `buildQuizRound` still auf Englisch zurueck — auf dem Fernseher stuende
 *     dann eine englische Frage mitten in einer bengalischen Runde, ohne dass
 *     irgendwo ein Fehler sichtbar waere.
 *  2. **Kein Drift zur Quelle.** Der Katalog ist aus dem kuratierten
 *     Fragenbestand der Handy-App abgeleitet (`scripts/build-quiz.mjs`). Wird
 *     dort eine Frage korrigiert — und bei religioesem Grundwissen ist genau
 *     das der Grund, warum es EINE Quelle gibt —, muss die TV-Kopie nachziehen.
 *     Dieser Test schlaegt an, sobald sie es nicht tut.
 */
import fs from 'fs';
import path from 'path';

import { QUIZ, buildQuizRound } from '@/data/quiz';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/locale';

const TRIVIA = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'mobile',
  'src',
  'features',
  'practice',
  'trivia.json',
);

interface TriviaQuestion {
  id: string;
  category: string;
  q: Record<string, string>;
  options: Record<string, string>[];
}

const source = JSON.parse(fs.readFileSync(TRIVIA, 'utf8')) as { questions: TriviaQuestion[] };
const sourceById = new Map(source.questions.map((q) => [q.id, q]));

/** Deterministische Zufallsquelle — sonst waere jeder Lauf ein anderer Test. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

describe('Fragenkatalog', () => {
  it('hat 32 Fragen mit eindeutigen Schluesseln und je 4 Optionen', () => {
    expect(QUIZ).toHaveLength(32);
    expect(new Set(QUIZ.map((q) => q.id)).size).toBe(QUIZ.length);
    for (const q of QUIZ) expect(q.options).toHaveLength(4);
  });

  it.each(SUPPORTED_LOCALES)('%s: jede Frage und jede Option ist vorhanden', (locale) => {
    const gaps: string[] = [];
    for (const q of QUIZ) {
      if (!q.q[locale]?.trim()) gaps.push(`${q.id}.q`);
      q.options.forEach((o, i) => {
        if (!o[locale]?.trim()) gaps.push(`${q.id}.options[${i}]`);
      });
    }
    expect(gaps).toEqual([]);
  });

  it('traegt in jeder Frage genau die 14 App-Sprachen', () => {
    const expected = [...SUPPORTED_LOCALES].sort();
    for (const q of QUIZ) {
      expect(Object.keys(q.q).sort()).toEqual(expected);
      for (const o of q.options) expect(Object.keys(o).sort()).toEqual(expected);
    }
  });

  it('stimmt Wort fuer Wort mit dem Bestand der Handy-App ueberein', () => {
    for (const q of QUIZ) {
      const src = sourceById.get(q.id);
      expect(src).toBeDefined();
      for (const locale of SUPPORTED_LOCALES) {
        expect(q.q[locale]).toBe(src!.q[locale]);
        q.options.forEach((o, i) => expect(o[locale]).toBe(src!.options[i]![locale]));
      }
    }
  });

  it('zieht nur aus den fuer den Fernseher geeigneten Kategorien', () => {
    // Sahaba-/Akhlaq-/Nikah-/Dialekt-Fragen der Handy-App haben Optionen von
    // 40-80 Zeichen. Im 2x2-Raster auf 10 Fuss Abstand sind die nicht lesbar.
    for (const q of QUIZ) expect(['knowledge', 'quran']).toContain(q.category);
  });

  it('haelt Frage und Optionen kurz genug fuer das 10-Fuss-Raster', () => {
    // Gerechnet fuer den harten Fall: 1920x1080 bei Dichte 320 = 960x540 dp
    // (der Emulator aus dem Vor-Audit). Dort bleiben nach den Raendern rund
    // 845 dp Textbreite; die Frage laeuft mit ~33 dp Schrift auf etwa 50
    // Zeichen je Zeile, eine Option mit ~22 dp auf etwa 34. Der Screen hat
    // KEIN ScrollView — bei drei Fragezeilen UND zweizeiligen Optionen
    // schoebe das Raster die Fusszeile aus dem Bild.
    for (const q of QUIZ) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(q.q[locale].length).toBeLessThanOrEqual(90); // hoechstens 2 Zeilen
        for (const o of q.options) expect(o[locale].length).toBeLessThanOrEqual(32); // 1 Zeile
      }
    }
  });
});

describe('buildQuizRound', () => {
  it('liefert die Runde in der App-Sprache', () => {
    const de = buildQuizRound('de', 32, seeded(1));
    const ar = buildQuizRound('ar', 32, seeded(1));
    expect(de).toHaveLength(32);
    // Gleiche Zufallsfolge → gleiche Fragen in gleicher Reihenfolge, nur
    // andere Sprache.
    expect(ar.map((q) => q.id)).toEqual(de.map((q) => q.id));
    for (let i = 0; i < de.length; i++) {
      expect(ar[i].q).not.toBe(de[i].q);
      expect(ar[i].q).toBe(QUIZ.find((e) => e.id === ar[i].id)!.q.ar);
    }
  });

  it('markiert in jeder Sprache dieselbe Antwort als richtig', () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const q of buildQuizRound(locale as Locale, 32, seeded(7))) {
        const entry = QUIZ.find((e) => e.id === q.id)!;
        // options[0] der Quelle ist die richtige Antwort — nach dem Mischen
        // muss `correct` genau auf sie zeigen.
        expect(q.options[q.correct]).toBe(entry.options[0][locale]);
      }
    }
  });

  it('mischt die Optionen — die richtige Antwort steht nicht immer oben links', () => {
    // Ohne Mischen waere jede richtige Antwort die Kachel oben links: die
    // Quelle fuehrt sie immer an Position 0.
    const positions = new Set(buildQuizRound('de', 32, seeded(3)).map((q) => q.correct));
    expect(positions.size).toBeGreaterThan(1);
  });

  it('gibt keine Frage doppelt in einer Runde aus', () => {
    const ids = buildQuizRound('en', 10, seeded(99)).map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('bleibt bei einer Rundengroesse ueber dem Katalog stehen', () => {
    expect(buildQuizRound('en', 999, seeded(5))).toHaveLength(QUIZ.length);
  });
});
