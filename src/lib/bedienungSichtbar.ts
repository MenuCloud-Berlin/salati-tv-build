import { useSyncExternalStore } from 'react';

/**
 * Ob die Bedienelemente gerade zu sehen sind.
 *
 * WARUM (Nutzerwunsch 2026-08-16, „dass man home zurueck usw. also Optionen
 * ausblenden kann, bspw. die irgendwann automatisch ausblenden"): ein Fernseher
 * steht stundenlang im Raum. Die Gebetsuhr ist dafuer gemacht — die Hinweise
 * darunter („OK oeffnet das Menue") sind es nicht. Sie sind beim ersten Mal
 * noetig und danach nur noch Text auf einem Bild, das sonst nichts sagen will.
 *
 * Der Zustand liegt NEBEN dem Baum, nicht darin: die Tastenereignisse kommen in
 * App.tsx an, gebraucht wird die Antwort in vier Bildschirmen, und keiner davon
 * ist Elternteil eines anderen. Dasselbe Muster wie lib/hintergrundAudio.ts.
 *
 * Ausgeblendet wird durch DECKKRAFT, nicht durch Ausbauen: die Knoepfe bleiben
 * fokussierbar und an ihrem Platz. Waeren sie weg, spraenge der Fokus beim
 * Wiedereinblenden irgendwohin, und der erste Tastendruck ginge ins Leere.
 */

let sichtbar = true;
let uhr: ReturnType<typeof setTimeout> | null = null;
let verzoegerungMs = 0; // 0 = nie ausblenden
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

function lesen(): boolean {
  return sichtbar;
}

export function useBedienungSichtbar(): boolean {
  return useSyncExternalStore(abonnieren, lesen, lesen);
}

/** Derselbe Stand ohne React — fuer Aufrufer ausserhalb des Baums und Tests. */
export function istBedienungSichtbar(): boolean {
  return sichtbar;
}

function uhrStellen() {
  if (uhr) clearTimeout(uhr);
  uhr = null;
  if (verzoegerungMs <= 0) return;
  uhr = setTimeout(() => {
    uhr = null;
    if (!sichtbar) return;
    sichtbar = false;
    melden();
  }, verzoegerungMs);
}

/**
 * Es ist etwas passiert — Tastendruck, Bildschirmwechsel, Gebetsruf.
 * Zeigt die Bedienung wieder und beginnt die Wartezeit von vorn.
 */
export function bedienungGesehen(): void {
  if (!sichtbar) {
    sichtbar = true;
    melden();
  }
  uhrStellen();
}

/**
 * Setzt die Wartezeit. 0 heisst: nie ausblenden — dann wird sofort wieder
 * eingeblendet, damit ein Umschalten in den Einstellungen unmittelbar wirkt und
 * nicht erst beim naechsten Tastendruck.
 */
export function ausblendenNach(ms: number): void {
  if (ms === verzoegerungMs) return;
  verzoegerungMs = Math.max(0, ms);
  bedienungGesehen();
}

/** Nur fuer Tests. */
export function zuruecksetzenFuerTest(): void {
  if (uhr) clearTimeout(uhr);
  uhr = null;
  sichtbar = true;
  verzoegerungMs = 0;
  hoerer.clear();
}
