// SPIEGELKOPIE von apps/mobile/src/features/quran/fonts.ts.
//
// apps/tv ist ein eigenstaendiges pnpm-Projekt (eigenes Lockfile, eigener
// EAS-Build); ein Import ueber die App-Grenze waere im Metro-Bundle nicht
// aufloesbar. Deshalb liegt der Schriften-Katalog hier als Kopie — und
// `quranFonts.parity.test.ts` vergleicht beide Dateien Zeichen fuer Zeichen,
// damit die Kopie nicht still auseinanderlaeuft. NICHT einseitig aendern:
// erst die Handy-Datei, dann hierher kopieren.
//
// Auswählbare Koran-Schriftarten.
//
// Warum überhaupt mehrere: Schriftschnitt und Zeichensetzung sind Geschmacks-
// UND Lesbarkeitsfrage. Der Uthmani-Standardfont des KFGQPC bildet die
// gedruckte Madina-Ausgabe nach, ist auf kleinen Displays aber fein; Lernende
// kommen mit einer klaren Naskh-Schrift oft besser zurecht. Alle drei
// zusätzlichen Schriften stehen unter der SIL Open Font License 1.1, die
// Bündeln und Weitergabe mit Software ausdrücklich erlaubt (§1); Lizenztext
// und Urhebervermerke liegen der App bei (public/licenses/ofl-1.1.txt,
// NOTICE.txt Abschnitt 2).
//
// AUFNAHMEKRITERIUM: eine Schrift kommt nur in diese Liste, wenn sie jedes
// Zeichen des Uthmani-Textes WIRKLICH ZEICHNET. Am 2026-07-31 sind an dieser
// Prüfung vier ansonsten naheliegende Kandidaten gescheitert und deshalb NICHT
// dabei (Tofu-Kästchen mitten im Vers, s. assets/fonts/CREDITS.md): Noto
// Nastaliq Urdu (19 fehlende Zeichen), Gulzar (23), Markazi Text (alle 24 +
// U+06DD), Mirza (U+06E5), Alkalami (21 + Alif waṣla).
//
// „Wirklich zeichnet" heißt ausdrücklich MEHR als ein cmap-Eintrag. Der
// KFGQPC-Font trägt 171 Codepoints ein, die er nicht unterstützt, und zeigt für
// alle denselben Platzhalter — einen ausgefüllten Punkt in einem gepunkteten
// Kreis. Drei davon stehen im Uthmani-Text (U+06DF, U+06E3, U+06EB), U+06DF
// allein in 2.240 der 6.236 Verse. Die frühere Prüfung fragte nur die cmap und
// hat das jahrelang durchgelassen; scripts/pruefe-koran-fonts.mjs vergleicht
// deshalb jetzt die Glyph-Umrisse. Behoben wird es nicht an der Schrift (ihre
// EULA §1 verbietet jede Veränderung), sondern am Text: s. `adaptQuranText`.
//
// Die Zahlen unten sind GEMESSEN, nicht geschätzt — aus den Font-Tabellen der
// tatsächlich gebündelten Dateien (head.unitsPerEm, OS/2 usWinAscent/Descent,
// glyf-Bounding-Box des Alif U+0627):
//
//   Schrift             upem   Ink-Box (usWin)   Alif-Höhe
//   KFGQPC HAFS         2048   1.758 em          0.633 em
//   Amiri Quran         1000   2.774 em          0.719 em
//   Amiri               1000   2.760 em          0.719 em
//   Scheherazade New    2048   2.434 em          0.700 em
//   Lateef              2048   2.065 em          0.534 em
//   Harmattan           2048   1.978 em          0.532 em
//   Noto Naskh Arabic   1000   2.039 em          0.671 em
//   Noto Sans Arabic    1000   2.169 em          0.714 em
//
// Daraus die beiden Faktoren je Schrift:
//   • `lineBoxEm`  = die Box, die die Schrift selbst als „hier liegt meine
//     ganze Tinte" angibt (usWinAscent + usWinDescent). Bewusst diese und
//     nicht die knappere hhea-Box: Android bemisst die Zeilenhöhe mit
//     includeFontPadding über genau diese Werte, und gestapelte Koran-Zeichen
//     (Shadda + Fatha + Waqf-Zeichen darüber) liegen bei mehreren Schriften
//     komplett außerhalb der hhea-Box. Zu enge Zeilen schneiden sie oben ab —
//     genau das Symptom „Abstände zwischen Harakat und Basisbuchstaben
//     stimmen nicht".
//   • `sizeFactor` = 0.633 / eigene Alif-Höhe. Ohne ihn wirkt derselbe
//     Schriftgrad je Schrift unterschiedlich groß (Harmattan zeichnet bei
//     20 px rund 19 % kleiner als der KFGQPC-Font, Amiri 14 % größer).

import { Platform, type TextStyle } from 'react-native';

export type QuranFontId =
  | 'kfgqpc'
  | 'amiri-quran'
  | 'amiri'
  | 'scheherazade'
  | 'lateef'
  | 'harmattan'
  | 'noto'
  | 'noto-sans';

export interface QuranFontDef {
  id: QuranFontId;
  /** Bei expo-font registrierter Schlüssel (= fontFamily im Style). */
  family: string;
  /** Eigenname der Schrift — bewusst unübersetzt. */
  name: string;
  /** i18n-Schlüssel der einzeiligen Beschreibung. */
  hintKey: string;
  /** Anzeigename der Lizenz (Eigenname, unübersetzt). */
  license: string;
  /** Natürliche Zeilenbox in em (hhea ascent − descent + lineGap). */
  lineBoxEm: number;
  /** Ausgleichsfaktor für den Schriftgrad, bezogen auf KFGQPC HAFS = 1. */
  sizeFactor: number;
  /**
   * true, wenn die Schrift arabische Ziffern SELBST als Vers-Ende-Ornament
   * setzt — der gedruckten Madina-Ausgabe entsprechend, wo eine Zahl im
   * Korantext ausschließlich als Versnummer vorkommt (s. `ayahMarker`).
   */
  digitsAreAyahOrnament: boolean;
  /**
   * Welche Textkodierung die Schrift erwartet (s. `adaptQuranText`).
   * `unicode` = die Schreibweise, die api.quran.com liefert.
   * `kfgqpc`  = die abweichende Schreibweise der KFGQPC-Eigenausgabe.
   */
  textEncoding: 'unicode' | 'kfgqpc';
  /**
   * Kann die Schrift das INDOPAKISTANISCHE Schriftbild setzen? Das braucht
   * Buchstaben, die im arabischen Koran-Text nicht vorkommen: Keheh ک (U+06A9),
   * Heh Doachashmee ھ (U+06BE), Heh Goal ہ (U+06C1), Farsi Yeh ی (U+06CC),
   * Yeh Barree ے (U+06D2), hohe Hamza ٴ (U+0674) und zwei Waqf-Zeichen.
   *
   * Das ist NICHT durch Umschreiben zu lösen: ک ist kein Variantenglyph von ك,
   * sondern ein eigener Buchstabe — ihn zu ersetzen nähme dem IndoPak-Satz genau
   * das, was ihn ausmacht. Schriften ohne diese Buchstaben werden deshalb für
   * dieses Schriftbild gar nicht erst verwendet (s. `quranFontForScript`).
   */
  canRenderIndoPak: boolean;
}

/** Referenz-Alif-Höhe (KFGQPC HAFS) für den Größenausgleich. */
const REFERENCE_ALIF_EM = 0.633;

// Reihenfolge = Anzeigereihenfolge in den Einstellungen: erst die beiden
// Druckbild-Schriften der gedruckten Mushafs, dann die Lese-/Lern-Schriften,
// zuletzt die bildschirmoptimierten.
export const QURAN_FONTS: readonly QuranFontDef[] = [
  {
    id: 'kfgqpc',
    family: 'KFGQPCHafs',
    name: 'KFGQPC HAFS Uthmanic',
    hintKey: 'settings.quranFont.hint.kfgqpc',
    license: 'KFGQPC EULA',
    lineBoxEm: 1.758,
    sizeFactor: 1,
    digitsAreAyahOrnament: true,
    textEncoding: 'kfgqpc',
    canRenderIndoPak: false,
  },
  {
    id: 'amiri-quran',
    family: 'AmiriQuran',
    name: 'Amiri Quran',
    hintKey: 'settings.quranFont.hint.amiriQuran',
    license: 'SIL OFL 1.1',
    lineBoxEm: 2.774,
    sizeFactor: REFERENCE_ALIF_EM / 0.719,
    digitsAreAyahOrnament: false,
    textEncoding: 'unicode',
    canRenderIndoPak: false,
  },
  {
    id: 'amiri',
    family: 'Amiri',
    name: 'Amiri',
    hintKey: 'settings.quranFont.hint.amiri',
    license: 'SIL OFL 1.1',
    lineBoxEm: 2.76,
    sizeFactor: REFERENCE_ALIF_EM / 0.719,
    digitsAreAyahOrnament: false,
    textEncoding: 'unicode',
    canRenderIndoPak: true,
  },
  {
    id: 'scheherazade',
    family: 'ScheherazadeNew',
    name: 'Scheherazade New',
    hintKey: 'settings.quranFont.hint.scheherazade',
    license: 'SIL OFL 1.1',
    lineBoxEm: 2.434,
    sizeFactor: REFERENCE_ALIF_EM / 0.7,
    digitsAreAyahOrnament: false,
    textEncoding: 'unicode',
    canRenderIndoPak: true,
  },
  {
    id: 'lateef',
    family: 'Lateef',
    name: 'Lateef',
    hintKey: 'settings.quranFont.hint.lateef',
    license: 'SIL OFL 1.1',
    lineBoxEm: 2.065,
    sizeFactor: REFERENCE_ALIF_EM / 0.534,
    digitsAreAyahOrnament: false,
    textEncoding: 'unicode',
    canRenderIndoPak: true,
  },
  {
    id: 'harmattan',
    family: 'Harmattan',
    name: 'Harmattan',
    hintKey: 'settings.quranFont.hint.harmattan',
    license: 'SIL OFL 1.1',
    lineBoxEm: 1.978,
    sizeFactor: REFERENCE_ALIF_EM / 0.532,
    digitsAreAyahOrnament: false,
    textEncoding: 'unicode',
    canRenderIndoPak: true,
  },
  {
    id: 'noto',
    family: 'NotoNaskhArabic',
    name: 'Noto Naskh Arabic',
    hintKey: 'settings.quranFont.hint.noto',
    license: 'SIL OFL 1.1',
    lineBoxEm: 2.039,
    sizeFactor: REFERENCE_ALIF_EM / 0.671,
    digitsAreAyahOrnament: false,
    textEncoding: 'unicode',
    canRenderIndoPak: true,
  },
  {
    id: 'noto-sans',
    family: 'NotoSansArabic',
    name: 'Noto Sans Arabic',
    hintKey: 'settings.quranFont.hint.notoSans',
    license: 'SIL OFL 1.1',
    lineBoxEm: 2.169,
    sizeFactor: REFERENCE_ALIF_EM / 0.714,
    digitsAreAyahOrnament: false,
    textEncoding: 'unicode',
    canRenderIndoPak: true,
  },
] as const;

export const DEFAULT_QURAN_FONT: QuranFontId = 'kfgqpc';

export function quranFontDef(id: string | undefined): QuranFontDef {
  return QURAN_FONTS.find((f) => f.id === id) ?? QURAN_FONTS[0];
}

/**
 * Ersatzschrift für das indopakistanische Schriftbild, wenn die eingestellte
 * Schrift dessen Buchstaben nicht hat.
 *
 * Scheherazade New, weil SIL sie ausdrücklich für den erweiterten arabischen
 * Schriftkreis (u. a. Urdu) gezeichnet hat, sie den IndoPak-Zeichenvorrat
 * vollständig setzt (gemessen) und als Naskh dem gewohnten Mushaf-Bild nahe
 * kommt. Sie liegt ohnehin im Bundle — es wird nichts nachgeladen.
 */
export const INDOPAK_FALLBACK_FONT: QuranFontId = 'scheherazade';

/**
 * Die Schrift, mit der ein Schriftbild tatsächlich gesetzt wird.
 *
 * Für `uthmani` immer die eingestellte. Für `indopak` nur dann, wenn sie dessen
 * Buchstaben überhaupt hat — sonst die Ersatzschrift. Lieber ein anderer
 * Schriftschnitt als neun Platzhalter-Kreise mitten im Vers (mit dem
 * KFGQPC-Font wären es 3.771 Vorkommen).
 */
export function quranFontForScript(id: string | undefined, script: 'uthmani' | 'indopak'): QuranFontDef {
  const gewaehlt = quranFontDef(id);
  if (script !== 'indopak' || gewaehlt.canRenderIndoPak) return gewaehlt;
  return quranFontDef(INDOPAK_FALLBACK_FONT);
}

/** Ornament-Klammern des Vers-Endes: U+FD3F ﴿ … U+FD3E ﴾. */
const ORNATE_OPEN = '﴿';
const ORNATE_CLOSE = '﴾';

/**
 * Setzt die Versnummer so, wie die jeweilige Schrift sie gedruckt zeigt.
 *
 * Hintergrund (am 2026-07-31 im Android-Emulator nachgestellt, nicht vermutet):
 * Der KFGQPC-Font zieht eine Ziffernfolge über seine GSUB-Tabelle zu EINEM
 * Glyphen zusammen — dem Vers-Ende-Ornament der gedruckten Madina-Ausgabe, dem
 * verzierten Kreis mit der Nummer darin. Gemessen mit HarfBuzz gegen die
 * gebündelten Dateien:
 *
 *   Schrift             "٢٥٦" ergibt   Ink-Box des ersten Glyphen
 *   KFGQPC HAFS         1 Glyphe       0.89 × 0.72 em   ← Ornament
 *   alle sieben anderen 3 Glyphen      ~0.6 × 0.4 em    ← nur Ziffern
 *
 * Deshalb war `﴿…﴾` um die Nummer herum bei KFGQPC doppelt falsch: die Nummer
 * stand ohnehin schon im Kreis, und die Ornament-Klammern U+FD3E/U+FD3F fehlen
 * dieser Schrift — Android holte sie aus einer fremden Fallback-Schrift und
 * setzte geschweifte Klammern um den Kreis.
 *
 * `arabicNumber` kommt bereits in arabisch-indischen Ziffern (`toArabicDigits`).
 */
export function ayahMarker(font: QuranFontDef, arabicNumber: string): string {
  return font.digitsAreAyahOrnament ? arabicNumber : `${ORNATE_OPEN}${arabicNumber}${ORNATE_CLOSE}`;
}

/**
 * Schreibt den Korantext in die Kodierung der KFGQPC-Eigenausgabe um.
 *
 * WARUM das nötig ist: Die App zeigt den Uthmani-Text von api.quran.com, die
 * KFGQPC-Schrift ist aber für die HAUSEIGENE Textausgabe des King Fahd Complex
 * gezeichnet. Beide schreiben dieselben Zeichen unterschiedlich, und für drei
 * davon hat die Schrift überhaupt keinen Glyphen — sie zeigt dort einen
 * Platzhalter (ausgefüllter Punkt in gepunktetem Kreis). Am sichtbarsten bei
 * U+06DF, das in 2.240 der 6.236 Verse steht (z. B. „كَفَرُوا۟", „أُو۟لَـٰٓئِكَ").
 *
 * Die Zuordnung ist nicht geraten, sondern am 2026-07-31 aus der offiziellen
 * KFGQPC-Textausgabe abgelesen (`hafsData_v18`, 6.236 Verse) — Stelle für
 * Stelle dasselbe Wort in beiden Ausgaben:
 *
 *   quran.com                          KFGQPC-Ausgabe
 *   كَفَرُوا۟   …U+0627 U+06DF          كَفَرُواْ   …U+0627 U+0652
 *   عَلَيْهِمْ  …U+0652                  عَلَيۡهِمۡ  …U+06E1
 *   ٱلْمُصَۣيْطِرُونَ  U+06E3            ٱلۡمُصَۜيۡطِرُونَ  U+06DC   (52:37, 1×)
 *   تَأْمَ۫نَّا      U+06EB              تَأۡمَ۬نَّا      U+06EC   (12:11, 1×)
 *
 * Gegenprobe über den Gesamttext: mit dieser Abbildung stimmen 1.429 statt 78
 * Verse zeichengenau mit der KFGQPC-Ausgabe überein (der Rest sind andere,
 * hier nicht relevante Schreibunterschiede der beiden Ausgaben).
 *
 * Die Reihenfolge ist wichtig: erst U+0652 → U+06E1, DANN U+06DF → U+0652.
 * Andernfalls liefe das aus U+06DF entstandene U+0652 gleich weiter auf U+06E1
 * und der Unterschied zwischen Sukūn und stummem Buchstaben ginge verloren —
 * genau die Unterscheidung, die der Madina-Druck macht.
 *
 * DAS SIEHT AUS WIE EIN FEHLER, IST ABER KEINER — bitte nicht „zurückreparieren":
 * Nach dieser Abbildung steht am Wortende ein kleiner Haken statt des gewohnten
 * Kreises. Der Haken (Kopf des Ḫāʾ, U+06E1) IST das Sukūn des gedruckten
 * Madina-Mushafs; der Kreis bedeutet dort etwas anderes, nämlich einen
 * geschriebenen, aber nicht gesprochenen Buchstaben. Die offizielle
 * KFGQPC-Textausgabe setzt an diesen Stellen 37.148-mal U+06E1.
 *
 * Am 2026-08-01 wurde genau das als vermeintlicher Anzeigefehler gemeldet
 * („am Versende hängt ein kleines Mīm im letzten Buchstaben"). Weil die Frage
 * berechtigt ist und Gewohnheit gegen Drucktreue steht, entscheidet sie jetzt
 * der Nutzer selbst: Einstellung `quranSukun` — 'madina' (Standard, Haken) oder
 * 'kreis'. Bei 'kreis' sehen Sukūn und stummer Buchstabe gleich aus; das steht
 * so auch im Hinweistext der Einstellung.
 *
 * Die Schriftdatei selbst bleibt unangetastet: ihre EULA (§1) verbietet jede
 * Veränderung, deshalb wird der Text an die Schrift angepasst, nicht umgekehrt.
 */
export type SukunStil = 'madina' | 'kreis';

export function adaptQuranText(text: string, font: QuranFontDef, sukun: SukunStil = 'madina'): string {
  if (font.textEncoding !== 'kfgqpc' || !text) return text;
  const grund = text.replace(/ۣ/g, 'ۜ').replace(/۫/g, '۬');
  if (sukun === 'kreis') {
    // Beide Zeichen werden zum Kreis: U+0652 bleibt, U+06DF wird dazu. Die
    // Unterscheidung des Madina-Drucks geht dabei bewusst verloren — der
    // Nutzer hat sie in den Einstellungen abgewählt.
    return grund.replace(/۟/g, 'ْ');
  }
  return grund.replace(/ْ/g, 'ۡ').replace(/۟/g, 'ْ');
}

/**
 * OpenType-Merkmale, die für arabische Schrift gebraucht werden:
 * `ccmp`/`rlig`/`liga`/`calt` (Zusammenziehen und Pflicht-Ligaturen wie
 * Lām-Alif), `mark`/`mkmk` (Positionierung der Harakat am Buchstaben und
 * übereinander), `curs` (kursive Anbindung).
 *
 * Auf iOS/Android sind das die Standard-Merkmale des Shapers (HarfBuzz aktiviert
 * sie für arabische Schrift von sich aus) — dort ist nichts zu setzen und React
 * Native bietet dafür auch keine Style-Eigenschaft.
 *
 * Nur auf Web können sie durch CSS verlorengehen (`font-variant-ligatures:
 * none` in einem Reset, `font-feature-settings` einer Elternregel). Deshalb
 * werden sie dort explizit angefordert.
 */
export const ARABIC_FONT_FEATURES: TextStyle = Platform.select({
  web: {
    fontFeatureSettings: '"ccmp", "rlig", "liga", "calt", "mark", "mkmk", "curs"',
    fontVariantLigatures: 'common-ligatures contextual',
    fontKerning: 'normal',
  } as TextStyle,
  default: {},
});

export interface ArabicMetrics {
  fontSize: number;
  lineHeight: number;
}

/**
 * Rechnet den in den Einstellungen gewählten Schriftgrad auf die konkrete
 * Schrift um: gleicher optischer Eindruck, und garantiert genug Zeilenhöhe,
 * damit die hohen Koran-Zeichen nicht abgeschnitten werden.
 *
 * `baseLineHeight` bleibt die Untergrenze — der Zeilenabstand wird also nie
 * enger als bisher, nur bei Bedarf größer.
 */
export function arabicMetrics(id: string | undefined, baseSize: number, baseLineHeight: number): ArabicMetrics {
  const font = quranFontDef(id);
  const fontSize = Math.round(baseSize * font.sizeFactor);
  return {
    fontSize,
    lineHeight: Math.max(baseLineHeight, Math.ceil(fontSize * font.lineBoxEm)),
  };
}
