/**
 * Wie ein Vers auf einen Fernsehbildschirm passt.
 *
 * WARUM (Nutzerbefund 2026-08-16, „bei langen Versen ist der Text viel zu viel
 * für den Bildschirm"): der Leser hat den ganzen Vers in eine Flaeche gelegt,
 * die `flex: 1` war und mittig ausgerichtet — waechst der Inhalt ueber die
 * Flaeche hinaus, schiebt er in RN nicht, sondern laeuft ueber. Der Wurzel-View
 * hat `overflow: 'hidden'`, also verschwand der Anfang oben, das Ende unten, und
 * Umschrift und Uebersetzung lagen auf der Bedienleiste.
 *
 * Zahlen dazu: bei der groessten Schriftstufe misst ein Vers 150 px Schriftgrad
 * bei 210 px Zeilenhoehe. Auf einem 1080er Panel bleiben der Buehne rund 700 px
 * — also drei Zeilen. Sure 2, Vers 282 hat 128 Woerter und braucht dort ueber
 * dreissig. Der Vers war zu 90 % unsichtbar.
 *
 * Der Weg hier ist NICHT Scrollen: eine Bildlaufleiste braucht auf dem
 * Fernseher den Fokus, und der Fokus gehoert der Bedienleiste. Stattdessen wird
 * der Vers in Abschnitte geteilt, die je vollstaendig auf den Schirm passen.
 * Weil die Wiedergabe Wort-Zeitstempel hat, weiss der Leser jederzeit, in
 * welchem Abschnitt er steht, und blaettert von selbst mit — wie ein
 * Teleprompter, nur ohne Bewegung im Bild.
 *
 * Alles hier ist reine Rechnung ohne React: so laesst es sich fuer die
 * Grenzfaelle (laengster Vers, groesste Schrift, schmalstes Panel) pruefen,
 * ohne einen Bildschirm zu bauen.
 */

/** Kombinierende Zeichen der arabischen Schrift: sie sitzen ueber oder unter
 *  dem Buchstaben und schieben die Zeile NICHT weiter. Wer sie mitzaehlt, haelt
 *  einen Koranvers fuer doppelt so breit, wie er ist — die Vokalzeichen sind im
 *  Uthmani-Wortlaut fast so zahlreich wie die Buchstaben. */
const KOMBINIEREND = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF]/g;

/**
 * Breite eines Wortes als Vielfaches der Schriftgroesse.
 *
 * Genaehert, nicht gemessen: `Text.measure` gibt es in React Native nur
 * asynchron und nur fuer bereits gerendertes Text — damit waere jeder
 * Verswechsel ein Aufblitzen im falschen Umbruch. Der Mittelwert von 0,5 em je
 * Buchstabe stammt aus den Metriken der mitgelieferten Koran-Schriften
 * (Uthmanic Hafs: Alif 0,26 em, Sad 0,78 em, Mittel ueber die Haeufigkeit im
 * Korpus 0,49 em).
 */
export function wortBreiteEm(wort: string): number {
  const sichtbar = wort.replace(KOMBINIEREND, '').trim().length;
  // Auch ein Wort, das nur aus Zeichen besteht, belegt Platz.
  return Math.max(0.4, sichtbar * 0.5) + 0.28; // + Wortabstand
}

export type Abschnitt = number[]; // Indizes der Woerter dieses Abschnitts

/**
 * Verteilt die Woerter auf Zeilen und die Zeilen auf Abschnitte.
 *
 * Greedy von rechts nach links — die Richtung spielt fuer die Rechnung keine
 * Rolle, nur die Reihenfolge, und die ist die des Verses.
 */
export function abschnitteAufteilen(
  woerter: readonly string[],
  breite: number,
  zeilenProAbschnitt: number,
  fontSize: number,
): Abschnitt[] {
  if (woerter.length === 0) return [[]];
  if (!(breite > 0) || !(fontSize > 0) || zeilenProAbschnitt < 1) return [woerter.map((_, i) => i)];

  const zeilen: Abschnitt[] = [];
  let zeile: Abschnitt = [];
  let belegt = 0;

  woerter.forEach((w, i) => {
    const b = wortBreiteEm(w) * fontSize;
    // Ein einzelnes Wort, das breiter als die Zeile ist, bekommt seine eigene
    // Zeile — sonst laeuft die Schleife leer weiter und teilt nie auf.
    if (zeile.length > 0 && belegt + b > breite) {
      zeilen.push(zeile);
      zeile = [];
      belegt = 0;
    }
    zeile.push(i);
    belegt += b;
  });
  if (zeile.length > 0) zeilen.push(zeile);

  const abschnitte: Abschnitt[] = [];
  for (let i = 0; i < zeilen.length; i += zeilenProAbschnitt) {
    abschnitte.push(zeilen.slice(i, i + zeilenProAbschnitt).flat());
  }
  return abschnitte.length > 0 ? abschnitte : [[]];
}

/** Stufen, in denen die Schrift kleiner wird, bevor ein zweiter Abschnitt
 *  aufgemacht wird. Nicht stufenlos: sonst haette jeder Vers einen anderen
 *  Schriftgrad und das Bild flackerte bei jedem Verswechsel. */
const FAKTOREN = [1, 0.88, 0.76, 0.64] as const;

export type VersLayout = {
  /** Mit diesem Faktor werden Schriftgrad und Zeilenhoehe multipliziert. */
  faktor: number;
  abschnitte: Abschnitt[];
};

/**
 * Schriftgrad und Aufteilung fuer einen Vers.
 *
 * Erst kleiner werden, dann blaettern: ein Vers, der knapp nicht passt, soll
 * nicht mitten im Satz umbrechen, nur weil zwei Woerter fehlen. Unter 64 % geht
 * es nicht — darunter ist der Vers auf drei Meter Abstand nicht mehr lesbar,
 * und dann sind mehrere Abschnitte das kleinere Uebel.
 */
export function versLayout(opts: {
  woerter: readonly string[];
  breite: number;
  hoehe: number;
  fontSize: number;
  lineHeight: number;
  /** Ab wie vielen Abschnitten die Schrift kleiner wird. Standard: mehr als 1. */
  zielAbschnitte?: number;
}): VersLayout {
  const { woerter, breite, hoehe, fontSize, lineHeight } = opts;
  const ziel = opts.zielAbschnitte ?? 1;
  if (!(breite > 0) || !(hoehe > 0) || !(fontSize > 0) || !(lineHeight > 0)) {
    return { faktor: 1, abschnitte: [woerter.map((_, i) => i)] };
  }

  let letzte: VersLayout = { faktor: 1, abschnitte: [[]] };
  for (const faktor of FAKTOREN) {
    const zeilen = Math.max(1, Math.floor(hoehe / (lineHeight * faktor)));
    const abschnitte = abschnitteAufteilen(woerter, breite, zeilen, fontSize * faktor);
    letzte = { faktor, abschnitte };
    if (abschnitte.length <= ziel) return letzte;
  }
  return letzte;
}

/** In welchem Abschnitt steht das Wort mit diesem Index? */
export function abschnittVonWort(abschnitte: readonly Abschnitt[], wortIndex: number): number {
  if (wortIndex < 0) return 0;
  const i = abschnitte.findIndex((a) => a.includes(wortIndex));
  return i < 0 ? 0 : i;
}

/**
 * Faktor, mit dem eine Zeile lateinischer Schrift in ihre Flaeche passt.
 *
 * Warum eine Wurzel: die Zahl der Zeilen waechst mit dem Schriftgrad, die Hoehe
 * jeder Zeile ebenfalls — die belegte Hoehe waechst also mit dem QUADRAT. Wer
 * linear verkleinert, verkleinert doppelt so stark wie noetig und macht aus
 * einer Uebersetzung, die knapp nicht passt, eine Ameisenschrift.
 */
export function textFaktor(opts: {
  text: string;
  breite: number;
  hoehe: number;
  fontSize: number;
  lineHeight: number;
  minFaktor?: number;
}): number {
  const { text, breite, hoehe, fontSize, lineHeight } = opts;
  const min = opts.minFaktor ?? 0.62;
  if (!text || !(breite > 0) || !(hoehe > 0) || !(fontSize > 0) || !(lineHeight > 0)) return 1;
  // 0,5 em je Zeichen ist der uebliche Mittelwert lateinischer Fliesstexte;
  // arabische und indische Uebersetzungen liegen daneben, aber immer darunter.
  const gebraucht = Math.ceil((text.length * 0.5 * fontSize) / breite) * lineHeight;
  if (gebraucht <= hoehe) return 1;
  return Math.max(min, Math.sqrt(hoehe / gebraucht));
}

/**
 * Teilt einen Fliesstext in `anzahl` moeglichst gleich lange Stuecke, ohne ein
 * Wort zu zerschneiden.
 *
 * Gebraucht fuer die Uebersetzung langer Verse: der arabische Text blaettert
 * mit der Rezitation, und eine Uebersetzung, die dabei unveraendert stehen
 * bliebe, waere zwar vollstaendig, aber nur im ersten Abschnitt lesbar — den
 * Rest schnitte die Flaeche ab.
 *
 * BEWUSST UNGENAU: die Zuordnung ist der Laenge nach, nicht dem Sinn nach. Eine
 * wortgenaue Zuordnung gaebe es nur mit einer Wort-fuer-Wort-Uebersetzung, und
 * die liefert keine der Quellen fuer ganze Verse. Der Nutzer sieht also den
 * ungefaehr passenden Teil — was besser ist als ein abgeschnittener Satz.
 */
export function textAbschnitte(text: string, anzahl: number): string[] {
  const sauber = text?.trim() ?? '';
  if (anzahl <= 1 || !sauber) return [sauber];
  const woerter = sauber.split(/\s+/);
  if (woerter.length <= anzahl) return [sauber];
  const proTeil = Math.ceil(woerter.length / anzahl);
  const teile: string[] = [];
  for (let i = 0; i < woerter.length; i += proTeil) {
    teile.push(woerter.slice(i, i + proTeil).join(' '));
  }
  // Bei ungerader Teilung koennen weniger Teile herauskommen als Abschnitte —
  // dann bekommt der letzte Abschnitt nichts mehr. Leere Zeichenketten
  // auffuellen, damit der Index immer trifft.
  while (teile.length < anzahl) teile.push('');
  return teile;
}
