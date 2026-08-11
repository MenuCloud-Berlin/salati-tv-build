import raw from '@/data/quiz.json';
import type { Locale } from '@/lib/locale';

/**
 * Wissens-Quiz für den TV-Quizmodus. Bewusst gebündelt statt Laufzeit-Fetch —
 * funktioniert offline und ist die Grundlage sowohl für das Solo-Spiel
 * (Fernbedienung) als auch für das Zweitschirm-Quiz (Antwort kommt vom
 * gekoppelten Handy). Fragen bleiben bewusst allgemein und unstrittig
 * (Grundwissen), keine Fiqh-Streitfragen.
 *
 * Audit 2026-07-28 (T15): der Katalog war fest deutsch — die Quiz-Oberfläche
 * sprach 14 Sprachen, die Fragen darin nur eine. Er ist jetzt aus dem
 * kuratierten, 14-sprachigen Fragenbestand der Handy-App abgeleitet
 * (`apps/mobile/src/features/practice/trivia.json`) statt neu übersetzt: bei
 * religiösem Grundwissen ist eine falsch übertragene Antwortoption ein
 * inhaltlicher Fehler, kein Stilproblem. Erzeugung + Auswahlbegründung in
 * `scripts/build-quiz.mjs`, Abgleich gegen die Quelle in `quiz.test.ts`.
 */
export interface QuizEntry {
  id: string;
  category: string;
  /** Fragetext je App-Sprache. */
  q: Record<Locale, string>;
  /** Vier Optionen je App-Sprache — `options[0]` ist IMMER die richtige. */
  options: Record<Locale, string>[];
}

export const QUIZ: QuizEntry[] = (raw as { questions: unknown }).questions as QuizEntry[];

/** Eine Frage, fertig für den Bildschirm: eine Sprache, Optionen gemischt. */
export interface QuizQuestion {
  id: string;
  q: string;
  options: string[];
  correct: number;
}

/** Zufallsquelle — als Parameter, damit die Rundenbildung testbar bleibt. */
export type Rand = () => number;

function shuffle<T>(arr: readonly T[], rand: Rand): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Eine Runde: `count` zufällige Fragen in der App-Sprache, jede mit gemischten
 * Optionen.
 *
 * Das Mischen der OPTIONEN ist nicht kosmetisch: in der Quelle steht die
 * richtige Antwort immer an Position 0. Ohne Mischen wäre auf dem Fernseher
 * jede richtige Antwort die Kachel oben links.
 */
export function buildQuizRound(locale: Locale, count: number, rand: Rand = Math.random): QuizQuestion[] {
  return shuffle(QUIZ, rand)
    .slice(0, count)
    .map((entry) => {
      const options = shuffle(
        entry.options.map((o, i) => ({ text: o[locale] || o.en, correct: i === 0 })),
        rand,
      );
      return {
        id: entry.id,
        q: entry.q[locale] || entry.q.en,
        options: options.map((o) => o.text),
        correct: options.findIndex((o) => o.correct),
      };
    });
}
