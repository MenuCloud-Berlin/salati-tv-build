// Steuerkreuz und OK vom gekoppelten Handy — der Ersatz fuer eine echte
// Fernbedienung.
//
// WARUM ES DIESE DATEI GIBT (Nutzerbefund 2026-08-30, Handy + Fernseher
// zusammen geprueft): Das Handy schickt seit jeher
// `{ t:'key', dir:'up'|'down'|'left'|'right'|'select'|'back' }`
// (apps/mobile/src/app/tv-connect.tsx). Der Fernseher wertete davon NUR `back`
// aus, und `select` auch nur auf der Uhr — vier der sechs Tasten liefen ins
// Leere. Wer sein Handy als Fernbedienung nutzte, konnte Bildschirme
// aufrufen, aber in keinem davon etwas auswaehlen.
//
// WARUM NICHT NATIV: Auf Android liesse sich ein Tastendruck ueber
// `Activity.dispatchKeyEvent` in die eigene Anwendung einspeisen. Das braeuchte
// ein eigenes natives Modul, einen weiteren Config-Plugin und haette auf Apple
// TV gar kein Gegenstueck — tvOS hat keine vergleichbare Einspeisung.
//
// Stattdessen wird der Fokus HIER bewegt: react-native-tvos bringt fuer jede
// View das native Kommando `requestTVFocus` mit (Android:
// `ReactViewManager.kt` → `root.requestFocus()`, tvOS: `RCTTVView` →
// `setNeedsFocusUpdate`). Das ist auf BEIDEN Plattformen genau der Weg, den
// auch die echte Fernbedienung geht: Android scrollt die Liste dabei von
// selbst mit, tvOS aktualisiert seine Fokus-Umgebung.
//
// Die Richtungssuche liegt damit in JS. Das ist gewollt: sie ist ohne Geraet
// pruefbar (s. fernfokus.test.ts), waehrend eine native Einspeisung nur am
// echten Fernseher zu belegen waere.

export type FernRichtung = 'up' | 'down' | 'left' | 'right';
export type FernTaste = FernRichtung | 'select';

const TASTEN: readonly string[] = ['up', 'down', 'left', 'right', 'select'];

/** Prueft einen von aussen (Handy) gelieferten Tastennamen — dieselbe Haltung
 *  wie `isScreen` in lib/nav.ts: was nicht passt, wird verworfen. */
export function istFernTaste(v: unknown): v is FernTaste {
  return typeof v === 'string' && TASTEN.includes(v);
}

/** Rechteck in FENSTER-Koordinaten (nicht relativ zum Elternteil). */
export interface Lage {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Eintrag {
  id: number;
  /** Zuletzt gemessene Lage; `null`, solange nie gemessen wurde. */
  lage: Lage | null;
  /** Misst neu und liefert die Lage — oder `null`, wenn das Element weg ist. */
  messen: () => Promise<Lage | null>;
  /** Bittet die Plattform, den Fokus auf dieses Element zu legen. */
  fokussieren: () => void;
  /** Was „OK" auf diesem Element tut. */
  ausloesen: () => void;
}

const eintraege = new Map<number, Eintrag>();
let naechsteId = 1;
/** Wer den Fokus zuletzt GEMELDET hat — die Plattform ist die Wahrheit. */
let aktiv: number | null = null;

/**
 * Meldet eine fokussierbare Karte an. Rueckgabe: das Abmelden.
 *
 * Aufgerufen wird das aus `FocusCard` — dem einzigen fokussierbaren Baustein
 * der App. Alles, was der Nutzer mit der Fernbedienung erreichen kann, geht
 * durch ihn hindurch, deshalb genuegt diese eine Stelle.
 */
export function anmelden(teil: Omit<Eintrag, 'id' | 'lage'>): { id: number; abmelden: () => void } {
  const id = naechsteId++;
  eintraege.set(id, { id, lage: null, ...teil });
  return {
    id,
    abmelden: () => {
      eintraege.delete(id);
      if (aktiv === id) aktiv = null;
    },
  };
}

/** Die Plattform hat den Fokus auf dieses Element gelegt. */
export function fokusGemeldet(id: number): void {
  aktiv = id;
}

/** Die Plattform hat den Fokus von diesem Element genommen. */
export function fokusVerloren(id: number): void {
  if (aktiv === id) aktiv = null;
}

/** Bekannte Lage nachtragen (aus `onLayout`), damit die erste Taste nicht
 *  auf eine leere Karte trifft. */
export function lageGemeldet(id: number, lage: Lage): void {
  const e = eintraege.get(id);
  if (e) e.lage = lage;
}

/** Nur fuer Tests: alles vergessen. */
export function zuruecksetzenFuerTest(): void {
  eintraege.clear();
  aktiv = null;
}

/** Nur fuer Tests: welche Karte gilt gerade als fokussiert. */
export function aktiveKarteFuerTest(): number | null {
  return aktiv;
}

/**
 * Die Bewertung einer Nachbarkarte.
 *
 * `haupt` ist der Abstand IN der Richtung (zwischen den zugewandten Kanten),
 * `neben` die Verfehlung QUER dazu (0, solange sich die Karten ueberlappen).
 * Die Verfehlung wiegt dreifach: sonst spraenge der Fokus aus der ersten
 * Kachel einer Reihe lieber schraeg in die zweite Reihe als geradeaus nach
 * unten, weil die schraege Karte naeher liegt. Auf einem Fernseher ist genau
 * das der Unterschied zwischen „steuerbar" und „springt wild umher".
 */
const NEBEN_GEWICHT = 3;

export function bewerte(von: Lage, zu: Lage, richtung: FernRichtung): number | null {
  const vonMitteX = von.x + von.w / 2;
  const vonMitteY = von.y + von.h / 2;
  const zuMitteX = zu.x + zu.w / 2;
  const zuMitteY = zu.y + zu.h / 2;

  let haupt: number;
  let neben: number;
  if (richtung === 'up' || richtung === 'down') {
    // Muss echt weiter oben/unten liegen — gemessen an der Mitte, damit
    // gleich hohe Nachbarn derselben Reihe nicht als Ziel gelten.
    if (richtung === 'up' ? zuMitteY >= vonMitteY - 1 : zuMitteY <= vonMitteY + 1) return null;
    haupt =
      richtung === 'up' ? Math.max(0, von.y - (zu.y + zu.h)) : Math.max(0, zu.y - (von.y + von.h));
    neben = ueberlappungsAbstand(von.x, von.w, zu.x, zu.w, vonMitteX, zuMitteX);
  } else {
    if (richtung === 'left' ? zuMitteX >= vonMitteX - 1 : zuMitteX <= vonMitteX + 1) return null;
    haupt =
      richtung === 'left' ? Math.max(0, von.x - (zu.x + zu.w)) : Math.max(0, zu.x - (von.x + von.w));
    neben = ueberlappungsAbstand(von.y, von.h, zu.y, zu.h, vonMitteY, zuMitteY);
  }
  return haupt + neben * NEBEN_GEWICHT;
}

/** 0, solange sich die beiden Strecken ueberlappen — sonst der Abstand der
 *  Mittelpunkte. */
function ueberlappungsAbstand(
  a: number,
  aLen: number,
  b: number,
  bLen: number,
  aMitte: number,
  bMitte: number,
): number {
  const ueberlappt = a < b + bLen && b < a + aLen;
  return ueberlappt ? 0 : Math.abs(aMitte - bMitte);
}

/**
 * Alle angemeldeten Karten neu vermessen.
 *
 * Warum bei JEDEM Tastendruck und nicht einmal beim Anmelden: eine Liste, die
 * gescrollt wurde, steht nicht mehr dort, wo sie beim Aufbau stand — mit
 * gespeicherten Lagen liefe die Richtungssuche nach dem ersten Scrollen ins
 * Leere. Das Messen ist EIN nativer Durchgang und laeuft neben dem Zeichnen.
 */
async function alleVermessen(): Promise<Eintrag[]> {
  const liste = [...eintraege.values()];
  const lagen = await Promise.all(liste.map((e) => e.messen().catch(() => null)));
  const brauchbar: Eintrag[] = [];
  liste.forEach((e, i) => {
    const l = lagen[i] ?? e.lage;
    if (!l || l.w <= 0 || l.h <= 0) return;
    e.lage = l;
    brauchbar.push(e);
  });
  return brauchbar;
}

/**
 * Eine Taste der Handy-Fernbedienung ausfuehren.
 *
 * Rueckgabe: ob etwas geschehen ist. `false` heisst „auf diesem Bildschirm gab
 * es nichts zu treffen" — der Aufrufer entscheidet dann (App.tsx schaltet auf
 * der Uhr zum Menue).
 */
export async function fernTaste(taste: FernTaste): Promise<boolean> {
  if (taste === 'select') {
    const e = aktiv !== null ? eintraege.get(aktiv) : undefined;
    if (!e) return false;
    e.ausloesen();
    return true;
  }

  const brauchbar = await alleVermessen();
  if (brauchbar.length === 0) return false;

  const von = aktiv !== null ? eintraege.get(aktiv) : undefined;
  if (!von?.lage) {
    // Kein Fokus (frisch geoeffneter Bildschirm, oder die Plattform hat ihn
    // verloren): auf die oberste, im Leserichtungs-Sinn erste Karte legen.
    // Ohne das waere die erste Taste nach dem Wechsel wirkungslos.
    const erste = brauchbar.reduce((a, b) =>
      a.lage!.y !== b.lage!.y ? (a.lage!.y < b.lage!.y ? a : b) : a.lage!.x <= b.lage!.x ? a : b,
    );
    erste.fokussieren();
    return true;
  }

  let bestes: Eintrag | null = null;
  let besteBewertung = Infinity;
  for (const e of brauchbar) {
    if (e.id === von.id) continue;
    const b = bewerte(von.lage, e.lage!, taste);
    if (b === null || b >= besteBewertung) continue;
    bestes = e;
    besteBewertung = b;
  }
  if (!bestes) return false; // Rand der Liste — kein Umlauf, wie am echten Geraet
  bestes.fokussieren();
  return true;
}
