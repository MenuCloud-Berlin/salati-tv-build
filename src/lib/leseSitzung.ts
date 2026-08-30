import { useSyncExternalStore } from 'react';

import { SURAHS } from '@/data/surahs';
import {
  abspielen,
  beenden as audioBeenden,
  vonVorn,
  zustandLesen,
} from '@/lib/hintergrundAudio';
import type { Locale } from '@/lib/locale';
import {
  fetchSurahReader,
  letzteLeseQuelle,
  READER_RECITERS,
  TRANSLATION_RESOURCES,
  type ReaderVerse,
} from '@/lib/quranText';
import { tvSettingsState } from '@/lib/settings';

// Die laufende Koran-Lesung — NEBEN dem Baum, nicht darin.
//
// WARUM ES DIESE DATEI GIBT (Nutzerbefund 2026-08-30): „die TV-App hat keine
// Hintergrundfunktion fuer das Koran-Lesen; ich moechte im Hintergrund Koran
// hoeren und vorne die Gebetsuhr haben. Hintergrund geht nur beim Koran-Radio."
//
// Das stimmte genau so. Seit 1.9.0 ueberlebt zwar die Wiedergabe von
// Rezitatoren, Radio und Podcasts den Bildschirmwechsel (lib/hintergrundAudio.ts),
// der LESER aber nicht: sein Spieler haing an `useVideoPlayer` im Bildschirm,
// und die Weiterschaltung von Vers zu Vers hing an dessen Ereignis-Abonnement.
// Wer zur Uhr wechselte, verlor beides — der Ton brach mitten im Vers ab.
//
// Hier liegt jetzt die ganze Lesung: welche Sure, welche Verse, welcher Vers,
// Wiederholen und das Weiterschalten (auch auf die naechste Sure). Der
// Bildschirm ist nur noch die Oberflaeche dazu — dasselbe Verhaeltnis wie
// zwischen `AudioNowPlaying` und `hintergrundAudio`.

export interface LeseStand {
  /** Laeuft eine Lesung? Auch dann `true`, wenn gerade pausiert wird. */
  aktiv: boolean;
  surah: number;
  verses: ReaderVerse[] | null;
  /** Index INNERHALB von `verses` (nicht die Versnummer). */
  idx: number;
  /** Am Versende denselben Vers erneut — zum Auswendiglernen. */
  wiederholen: boolean;
  laedt: boolean;
  fehler: boolean;
  /** Woher der Text kam; der Bildschirm sagt es dem Nutzer. */
  quelle: 'netz' | 'ablage' | 'paket';
}

const LEER: LeseStand = {
  aktiv: false,
  surah: 1,
  verses: null,
  idx: 0,
  wiederholen: false,
  laedt: false,
  fehler: false,
  quelle: 'netz',
};

let stand: LeseStand = LEER;
const hoerer = new Set<() => void>();
/** Sprache der zuletzt geladenen Sure — die naechste Sure braucht dieselbe. */
let sprache: Locale = 'de';
/**
 * Zaehler des laufenden Ladevorgangs. Ein Ergebnis, das nicht zum letzten
 * Auftrag gehoert, wird verworfen: sonst ueberschriebe eine langsame Antwort
 * zur alten Sure die schnelle zur neuen.
 */
let ladeLauf = 0;

function melden() {
  for (const h of [...hoerer]) h();
}

function setzen(patch: Partial<LeseStand>) {
  stand = { ...stand, ...patch };
  melden();
}

function abonnieren(h: () => void) {
  hoerer.add(h);
  return () => {
    hoerer.delete(h);
  };
}

function lesen(): LeseStand {
  return stand;
}

/** Reaktiver Zugriff auf die laufende Lesung. */
export function useLeseSitzung(): LeseStand {
  return useSyncExternalStore(abonnieren, lesen, lesen);
}

/** Der Stand ausserhalb von React (Tests, Nicht-Hook-Aufrufer). */
export function leseStand(): LeseStand {
  return stand;
}

/** Rezitator des Lesers — Alafasy, der einzige mit Wort-Zeitstempeln. */
const REZITATOR = READER_RECITERS[0].id;

/**
 * Oeffnet eine Sure und beginnt zu lesen.
 *
 * Laeuft dieselbe Sure schon, passiert NICHTS: wer aus der Uhr in den Leser
 * zurueckkehrt, soll dort weiterhoeren, wo er war — und nicht wieder bei
 * Vers 1 anfangen.
 */
export function sureOeffnen(surah: number, locale: Locale): void {
  if (stand.aktiv && stand.surah === surah && sprache === locale && stand.verses) return;
  sprache = locale;
  laden(surah, 0);
}

/** Laedt die Sure neu — der „Erneut versuchen"-Knopf des Bildschirms. */
export function nochmalVersuchen(): void {
  laden(stand.surah, stand.idx);
}

function laden(surah: number, startIdx: number): void {
  const lauf = ++ladeLauf;
  setzen({ aktiv: true, surah, verses: null, idx: startIdx, laedt: true, fehler: false });
  fetchSurahReader(surah, REZITATOR, TRANSLATION_RESOURCES[sprache])
    .then((verses) => {
      if (lauf !== ladeLauf) return;
      const idx = Math.min(Math.max(0, startIdx), Math.max(0, verses.length - 1));
      setzen({ verses, idx, laedt: false, fehler: false, quelle: letzteLeseQuelle() });
      versAbspielen(verses, idx, surah);
    })
    .catch(() => {
      if (lauf !== ladeLauf) return;
      setzen({ laedt: false, fehler: true });
    });
}

/** Sichtbarer Name der Sure — steht im Wiedergabe-Streifen auf der Uhr. */
function sureTitel(surah: number): string {
  const meta = SURAHS.find((x) => x.n === surah);
  return meta ? `${surah}. ${meta.en}` : `${surah}`;
}

function versAbspielen(verses: ReaderVerse[], idx: number, surah: number): void {
  const vers = verses[idx];
  if (!vers?.audioUrl) return;
  abspielen(
    {
      uri: vers.audioUrl,
      title: sureTitel(surah),
      subtitle: `${vers.n}/${verses.length}`,
      kickerKey: 'player.kickerRecitation',
      loop: false,
      quelle: 'quran',
    },
    { beiEnde: versEnde },
  );
}

/** Springt zu einem Vers (Index) und spielt ihn. */
export function versSetzen(idx: number): void {
  const verses = stand.verses;
  if (!verses || idx < 0 || idx >= verses.length) return;
  setzen({ idx });
  versAbspielen(verses, idx, stand.surah);
}

/** Einen Vers vor oder zurueck. Rueckgabe: ob es einen gab. */
export function versSpringen(delta: number): boolean {
  const verses = stand.verses;
  if (!verses) return false;
  const ziel = stand.idx + delta;
  if (ziel < 0 || ziel >= verses.length) return false;
  versSetzen(ziel);
  return true;
}

export function wiederholenUmschalten(): void {
  setzen({ wiederholen: !stand.wiederholen });
}

/**
 * Was am Ende eines Verses geschieht — und zwar UNABHAENGIG davon, ob der
 * Lese-Bildschirm noch offen ist. Genau darum geht es bei dieser Datei.
 */
function versEnde(): void {
  // Hat inzwischen eine andere Quelle den Spieler uebernommen (Radio,
  // Podcast), gehoert dieses Ende nicht uns.
  if (zustandLesen().stueck?.quelle !== 'quran') return;
  if (stand.wiederholen) {
    vonVorn();
    return;
  }
  const verses = stand.verses;
  if (!verses) return;
  if (stand.idx + 1 < verses.length) {
    versSetzen(stand.idx + 1);
    return;
  }
  // Letzter Vers. Ohne „Auto-Weiter" bleibt die Lesung stehen — genau das ist
  // der Sinn der Einstellung: ein Fernseher im Wohnzimmer soll nicht nach
  // Sure 2 noch stundenlang weiterlaufen, ohne dass jemand darum gebeten hat.
  if (!tvSettingsState().readerAutoAdvance) return;
  laden(stand.surah < 114 ? stand.surah + 1 : 1, 0);
}

/** Beendet die Lesung samt Ton (der Nutzer verlaesst sie bewusst). */
export function sitzungBeenden(): void {
  ladeLauf++;
  stand = LEER;
  audioBeenden();
  melden();
}

/** Nur fuer Tests. */
export function zuruecksetzenFuerTest(): void {
  ladeLauf++;
  stand = LEER;
  sprache = 'de';
  hoerer.clear();
}
