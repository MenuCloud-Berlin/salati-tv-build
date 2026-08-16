import { useSyncExternalStore } from 'react';
import { createVideoPlayer, type VideoPlayer } from 'expo-video';

// Koran-Wiedergabe, die den Bildschirmwechsel ueberlebt.
//
// WARUM ES DIESE DATEI GIBT (Nutzerbefund 2026-08-16): der Ton haing an
// `useVideoPlayer()` INNERHALB von AudioNowPlaying, und dieser Baustein hing
// im Rezitatoren-Bildschirm. Wer zur Gebetsuhr wechselte, haengte damit den
// Spieler aus — die Rezitation brach mitten im Vers ab. Genau das, wofuer ein
// Fernseher da ist ("Koran laufen lassen, vorne die Uhr"), war nicht moeglich.
//
// Der Spieler liegt jetzt NEBEN dem Baum, nicht darin — dasselbe Muster wie
// lib/settings.ts und lib/pairing.ts, und aus demselben Grund: Zustand, der
// laenger lebt als ein Bildschirm, darf nicht an dessen Lebensdauer haengen.
//
// expo-video dient weiterhin als reine Ton-Maschine: es wird nie eine
// `VideoView` gemountet, der native ExoPlayer spielt trotzdem weiter.

export interface LaufendesStueck {
  uri: string;
  title: string;
  subtitle?: string;
  /** Uebersetzungs-Schluessel der Zeile ueber dem Titel (z. B. "Rezitation"). */
  kickerKey?: string;
  coverUrl?: string;
  loop: boolean;
  /** Woher es gestartet wurde — der Hinweis-Streifen verlinkt zurueck. */
  quelle: 'reciters' | 'radio' | 'podcasts';
}

interface Zustand {
  stueck: LaufendesStueck | null;
  spielt: boolean;
  /** 'loading' | 'readyToPlay' | 'error' — durchgereicht von expo-video. */
  status: string;
}

let spieler: VideoPlayer | null = null;
let zustand: Zustand = { stueck: null, spielt: false, status: 'idle' };
const hoerer = new Set<() => void>();

function melden() {
  for (const h of [...hoerer]) h();
}

function abonnieren(h: () => void) {
  hoerer.add(h);
  return () => {
    hoerer.delete(h);
  };
}

function lesen(): Zustand {
  return zustand;
}

/** Der laufende Stand. `null` bei `stueck` heisst: es laeuft nichts. */
export function useHintergrundAudio(): Zustand {
  return useSyncExternalStore(abonnieren, lesen, lesen);
}

/**
 * Der native Spieler — nur fuer den Vollbild-Baustein, der Fortschritt und
 * Lautstaerke braucht. Wer nur wissen will, was laeuft, nimmt den Haken oben.
 */
export function spielerHolen(): VideoPlayer | null {
  return spieler;
}

function spielerAufbauen(uri: string, loop: boolean): VideoPlayer {
  const p = createVideoPlayer(uri);
  p.loop = loop;
  p.addListener('playingChange', (e) => {
    zustand = { ...zustand, spielt: e.isPlaying };
    melden();
  });
  p.addListener('statusChange', (e) => {
    zustand = { ...zustand, status: e.status };
    melden();
  });
  return p;
}

/**
 * Startet ein Stueck. Laeuft bereits dasselbe, passiert nichts — sonst
 * begaenne die Rezitation bei jedem Betreten des Bildschirms von vorn.
 */
export function abspielen(stueck: LaufendesStueck): void {
  if (spieler && zustand.stueck?.uri === stueck.uri) {
    // Gleiche Quelle: nur die Beschriftung nachziehen (z. B. anderer Titel
    // nach einem Sprachwechsel) und weiterlaufen lassen.
    zustand = { ...zustand, stueck };
    melden();
    if (!zustand.spielt) spieler.play();
    return;
  }
  spieler?.release();
  spieler = spielerAufbauen(stueck.uri, stueck.loop);
  zustand = { stueck, spielt: false, status: 'loading' };
  melden();
  spieler.play();
}

export function umschalten(): void {
  if (!spieler) return;
  if (zustand.spielt) spieler.pause();
  else spieler.play();
}

export function pausieren(): void {
  if (zustand.spielt) spieler?.pause();
}

/** Beendet die Wiedergabe und gibt den Spieler frei. */
export function beenden(): void {
  spieler?.release();
  spieler = null;
  zustand = { stueck: null, spielt: false, status: 'idle' };
  melden();
}

/** Nur fuer Tests: setzt alles auf den Ausgangszustand zurueck. */
export function zuruecksetzenFuerTest(): void {
  spieler = null;
  zustand = { stueck: null, spielt: false, status: 'idle' };
  hoerer.clear();
}
