// Laedt die in den Einstellungen gewaehlte Koran-Schrift und liefert den
// fertigen Text-Style dazu.
//
// Gleiche Bauart wie `apps/mobile/src/features/quran/useQuranFont.ts`, nur an
// den TV-Einstellungs-Store gebunden. Der Katalog selbst (`quranFonts.ts`) ist
// eine wortgleiche Spiegelkopie der Handy-Datei — der Fernseher soll denselben
// Vers mit denselben Zeichen zeichnen wie das Handy in der Hand daneben.
//
// Bewusst NACHLADEND statt alle acht Schriften beim Start: zusammen sind das
// rund 2,4 MB, die auf Uhr, Home und den Medien-Bereichen niemand braucht.
// Geladen wird immer nur die aktive Schrift; solange sie nicht da ist, bleibt
// `fontFamily` undefiniert (System-Schrift). Die Dateien liegen trotzdem alle
// im Bundle (require unten): ein Fernseher ohne Netz muss die Schrift trotzdem
// wechseln koennen.
import * as Font from 'expo-font';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { TextStyle } from 'react-native';

import {
  ARABIC_FONT_FEATURES,
  QURAN_FONTS,
  adaptQuranText,
  arabicMetrics,
  quranFontDef,
  type ArabicMetrics,
  type QuranFontDef,
  type QuranFontId,
} from '@/lib/quranFonts';
import { useTvSettings } from '@/lib/settings';

const FONT_ASSETS: Record<QuranFontId, number> = {
  kfgqpc: require('../../assets/fonts/kfgqpc-hafs.ttf'),
  'amiri-quran': require('../../assets/fonts/amiri-quran.ttf'),
  amiri: require('../../assets/fonts/amiri.ttf'),
  scheherazade: require('../../assets/fonts/scheherazade-new.ttf'),
  lateef: require('../../assets/fonts/lateef.ttf'),
  harmattan: require('../../assets/fonts/harmattan.ttf'),
  noto: require('../../assets/fonts/noto-naskh-arabic.ttf'),
  'noto-sans': require('../../assets/fonts/noto-sans-arabic.ttf'),
};

/** Fehlgeschlagene Ladeversuche merken, damit ein kaputtes Asset nicht bei
 *  jedem Render erneut versucht wird (und die Systemschrift stabil bleibt). */
const failed = new Set<QuranFontId>();
/** Wer auf „Schrift ist jetzt da" wartet (useSyncExternalStore-Abonnenten). */
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/** Laedt eine Koran-Schrift einmalig. `Font.loadAsync` fasst parallele Aufrufe
 *  fuer denselben Namen selbst zusammen. */
function ensureLoaded(id: QuranFontId): void {
  const def = quranFontDef(id);
  if (Font.isLoaded(def.family) || failed.has(id)) return;
  Font.loadAsync({ [def.family]: FONT_ASSETS[id] })
    .then(notify)
    .catch(() => {
      // Schrift nicht ladbar → Systemschrift. Kein Absturz, keine
      // Endlosschleife; der Vers bleibt lesbar.
      failed.add(id);
    });
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

/** Familienname der Schrift, sobald sie geladen ist — sonst `undefined`
 *  (Systemschrift). Ueber `useSyncExternalStore`, weil der Ladezustand von
 *  expo-font ein EXTERNER Zustand ist, den mehrere Komponenten lesen. */
export function useQuranFontFamily(id: QuranFontId): string | undefined {
  const def = quranFontDef(id);
  const getSnapshot = useCallback(
    () => (Font.isLoaded(def.family) ? def.family : undefined),
    [def.family],
  );
  const family = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    ensureLoaded(id);
  }, [id]);

  return family;
}

export interface QuranFontResult {
  /** Definition der gewaehlten Schrift (auch waehrend sie laedt). */
  def: QuranFontDef;
  /** Registrierter Familienname — `undefined`, solange die Schrift laedt. */
  family: string | undefined;
  /** Fertiger Text-Style: Schriftfamilie + arabische OpenType-Merkmale. */
  style: TextStyle;
  /** Schriftgrad/Zeilenhoehe der gewaehlten Schrift zu einem Basiswert. */
  metrics: (baseSize: number, baseLineHeight: number) => ArabicMetrics;
  /** Schreibt Korantext in die Kodierung um, die die Schrift erwartet. */
  text: (arabic: string) => string;
}

/**
 * Laedt ALLE Schriften und meldet, welche schon da sind.
 *
 * Nur fuer die Schrift-AUSWAHL gedacht, sonst nirgends: dort zeigt jede Kachel
 * ihre eigene Schrift, und genau darum geht es. Bis zum 2026-08-08 lief die
 * Vorschau ueber die gerade aktive Schrift — alle acht Kacheln sahen damit
 * gleich aus und behaupteten, die Schriften seien nicht zu unterscheiden
 * (Bildschirmbefund). Eine Vorschau, die nichts zeigt, ist schlechter als
 * keine.
 *
 * Die rund 2,4 MB werden erst geladen, wenn jemand diesen Bereich oeffnet, und
 * bleiben danach im Speicher. Auf der Uhr, im Home-Hub und in den Medien-
 * Bereichen wird weiterhin nur die EINE aktive Schrift geladen.
 */
export function useAllQuranFonts(): Set<QuranFontId> {
  const getSnapshot = useCallback(() => geladeneSchriften(), []);
  const geladen = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    for (const f of QURAN_FONTS) ensureLoaded(f.id);
  }, []);

  return geladen;
}

/** Zwischengespeicherter Schnappschuss: `useSyncExternalStore` verlangt, dass
 *  zwei Aufrufe ohne Aenderung DASSELBE Objekt liefern — ein frisches `Set` je
 *  Aufruf triebe React in eine Endlosschleife. */
let schnappschuss = new Set<QuranFontId>();
function geladeneSchriften(): Set<QuranFontId> {
  const jetzt = QURAN_FONTS.filter((f) => Font.isLoaded(f.family)).map((f) => f.id);
  if (jetzt.length !== schnappschuss.size || jetzt.some((id) => !schnappschuss.has(id))) {
    schnappschuss = new Set(jetzt);
  }
  return schnappschuss;
}

/** Die aktuell eingestellte Koran-Schrift samt Style und Massen. */
export function useQuranFont(): QuranFontResult {
  const { quranFont, quranSukun } = useTvSettings();
  const def = quranFontDef(quranFont);
  const family = useQuranFontFamily(def.id);
  return {
    def,
    family,
    style: { fontFamily: family, ...ARABIC_FONT_FEATURES },
    // Solange die Schrift laedt, gelten die Masse der System-Schrift (Faktor 1)
    // — sonst springt der Text beim Nachladen zweimal in der Groesse.
    metrics: (baseSize, baseLineHeight) =>
      family ? arabicMetrics(def.id, baseSize, baseLineHeight) : { fontSize: baseSize, lineHeight: baseLineHeight },
    // Solange die Schrift laedt, zeigt die Systemschrift den Text — die
    // versteht die KFGQPC-Schreibweise nicht und wuerde sie falsch darstellen.
    text: (arabic) => (family ? adaptQuranText(arabic, def, quranSukun) : arabic),
  };
}
