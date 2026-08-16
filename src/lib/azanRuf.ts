import { useEffect, useSyncExternalStore } from 'react';
import { createVideoPlayer, type VideoPlayer } from 'expo-video';

import { pausieren as hintergrundPausieren } from '@/lib/hintergrundAudio';

import {
  AZAN_PRAYERS,
  azanAktiv,
  azanQuelle,
  type AzanChoice,
  type AzanPerPrayer,
  type AzanPrayer,
} from '@/lib/azan';
import { timesFor, type DayTimes } from '@/lib/prayerTimes';
import { calcExtras, useTvSettings } from '@/lib/settings';

// Ausloesen und Abspielen des Gebetsrufs. Getrennt von `lib/azan.ts` (dem
// Katalog), weil hier alles steht, was Zeit und Ton anfasst — und weil die
// Faelligkeits-Rechnung als reine Funktion testbar bleiben soll.

export interface RufFaellig {
  prayer: AzanPrayer;
  /** Die gewaehlte Aufnahme; „aus" kann hier nicht stehen. */
  choice: Exclude<AzanChoice, 'aus'>;
  zeit: Date;
}

/**
 * Wie lange nach der Gebetszeit ein Ruf noch erklingen darf.
 *
 * DER GRUND: Der Prueftakt ist zehn Sekunden, aber ein Fernseher schlaeft ein,
 * ein Prozess wird eingefroren, eine Zeitumstellung springt. Ohne Obergrenze
 * wuerde die App nach dem Aufwachen den Ruf eines laengst vergangenen Gebets
 * nachholen — mitten in der Nacht der Fadschr-Ruf von vor vier Stunden. Zwei
 * Minuten sind grosszuegig genug fuer einen verzoegerten Takt und kurz genug,
 * dass ein nachgeholter Ruf noch zur Gebetszeit passt.
 */
export const MAX_VERZUG_MS = 120_000;

/**
 * Welcher Ruf ist im Zeitraum `(seit, jetzt]` faellig geworden?
 *
 * Reine Funktion, damit die Randfaelle pruefbar sind statt nur beobachtbar:
 * genau einmal ausloesen, nichts nachholen, Sonnenaufgang nie.
 */
export function faelligerRuf(
  times: DayTimes,
  je: AzanPerPrayer,
  seit: number,
  jetzt: number,
  maxVerzug: number = MAX_VERZUG_MS,
): RufFaellig | null {
  let treffer: RufFaellig | null = null;
  for (const prayer of AZAN_PRAYERS) {
    const choice = je[prayer];
    if (choice === 'aus') continue;
    const zeit = times[prayer];
    const ms = zeit.getTime();
    if (ms <= seit || ms > jetzt) continue;
    if (jetzt - ms > maxVerzug) continue;
    // Bei mehreren (praktisch unmoeglich, ausser bei einem Zeitsprung) gewinnt
    // das SPAETESTE — der Ruf, der jetzt gerade dran waere.
    if (!treffer || ms > treffer.zeit.getTime()) treffer = { prayer, choice, zeit };
  }
  return treffer;
}

// --- Wiedergabe -------------------------------------------------------------

/** Was gerade laeuft — `null`, wenn kein Ruf spielt. */
export interface AzanLauf {
  prayer: AzanPrayer;
  choice: Exclude<AzanChoice, 'aus'>;
  zeit: Date;
}

let lauf: AzanLauf | null = null;
let spieler: VideoPlayer | null = null;
const hoerer = new Set<() => void>();

function melden() {
  for (const h of hoerer) h();
}

/**
 * Spielt eine Aufnahme ab. Ein laufender Ruf wird vorher beendet — zwei
 * Gebetsrufe uebereinander waeren schlimmer als ein abgeschnittener.
 *
 * expo-video dient als Ton-Maschine, genau wie bei den Rezitatoren: ohne
 * gemountete `VideoView` gibt es nur Ton, gespielt vom nativen ExoPlayer.
 * Hier die IMPERATIVE Fassung (`createVideoPlayer`) statt `useVideoPlayer`,
 * weil der Ruf von einem Zeitpunkt ausgeloest wird und nicht vom Rendern eines
 * Bildschirms.
 */
export function azanSpielen(faellig: RufFaellig, lautstaerke: number): void {
  const quelle = azanQuelle(faellig.choice);
  if (quelle == null) return;
  azanStoppen();
  // Der Gebetsruf hat Vorrang. Seit die Rezitation den Bildschirmwechsel
  // ueberlebt (lib/hintergrundAudio.ts), kann sie hier noch laufen — dann
  // laegen zwei Stimmen uebereinander. Nur pausieren, nicht beenden: nach dem
  // Ruf soll der Nutzer da weiterhoeren, wo er war.
  hintergrundPausieren();
  try {
    const p = createVideoPlayer(quelle);
    p.volume = Math.max(0, Math.min(1, lautstaerke));
    p.loop = false;
    // Am Ende der Aufnahme aufraeumen, sonst bliebe der Hinweis „Zurueck
    // beendet den Ruf" stehen, obwohl laengst nichts mehr zu beenden ist.
    p.addListener('playToEnd', () => azanStoppen());
    p.play();
    spieler = p;
    lauf = { prayer: faellig.prayer, choice: faellig.choice, zeit: faellig.zeit };
  } catch {
    // Ein Ton, der nicht startet, darf die Uhr nicht mitnehmen.
    spieler = null;
    lauf = null;
  }
  melden();
}

/** Beendet den laufenden Ruf (Zurueck-Taste, Ende der Aufnahme, Probehoeren). */
export function azanStoppen(): void {
  const p = spieler;
  spieler = null;
  const liefLos = lauf !== null;
  lauf = null;
  if (p) {
    try {
      p.pause();
      p.release();
    } catch {
      // Ein bereits freigegebener Spieler wirft — das ist kein Fehlerfall.
    }
  }
  if (liefLos) melden();
}

function abonnieren(cb: () => void) {
  hoerer.add(cb);
  return () => hoerer.delete(cb);
}

function stand() {
  return lauf;
}

/** Reaktiver Zugriff auf den laufenden Ruf (Banner, Pause fremder Wiedergabe). */
export function useAzanLauf(): AzanLauf | null {
  return useSyncExternalStore(abonnieren, stand, stand);
}

/** Laeuft gerade ein Ruf? (ausserhalb von React) */
export function azanLaeuft(): boolean {
  return lauf !== null;
}

// --- Ausloeser --------------------------------------------------------------

/** Prueftakt. Zehn Sekunden sind genau genug fuer eine minutengenaue Zeit und
 *  kosten auf einem Fernseher nichts. */
export const TAKT_MS = 10_000;

/**
 * Startet den Ruf, sobald eine Gebetszeit erreicht ist — solange die App laeuft.
 *
 * Wird EINMAL in App.tsx aufgerufen, nicht je Bildschirm: der Ruf soll auch
 * erklingen, wenn gerade der Koran-Leser offen ist.
 *
 * Beim Start (und nach jeder Einstellungsaenderung) beginnt der beobachtete
 * Zeitraum bei JETZT. Wer die App um 13:05 oeffnet, bekommt nicht nachtraeglich
 * den Dhuhr-Ruf von 13:02 — das waere kein Gebetsruf mehr, sondern ein Schreck.
 */
export function useAzanAusloeser(): void {
  const s = useTvSettings();
  const an = s.loaded && azanAktiv(s.azan);
  const { location, azan, azanVolume, highLatitude, offsets } = s;

  useEffect(() => {
    if (!an) return;
    let seit = Date.now();
    const id = setInterval(() => {
      const jetzt = Date.now();
      const times = timesFor(location, new Date(jetzt), calcExtras({ highLatitude, offsets }));
      const faellig = faelligerRuf(times, azan, seit, jetzt);
      seit = jetzt;
      if (faellig) azanSpielen(faellig, azanVolume);
    }, TAKT_MS);
    return () => clearInterval(id);
  }, [an, location, azan, azanVolume, highLatitude, offsets]);

  // Beim Verlassen der App keinen Ton zuruecklassen.
  useEffect(() => () => azanStoppen(), []);
}
