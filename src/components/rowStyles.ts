import { StyleSheet } from 'react-native';

import { fokusUeberstand } from '@/components/fokusUeberstand';
import type { Theme } from '@/lib/theme';

/**
 * Gemeinsame, DICHTE-RELATIVE Styles der Listen-Screens (Videos, Reels,
 * Podcasts, Radio).
 *
 * Audit 2026-07-28 (T12): diese vier Screens rechneten als einzige noch mit
 * festen dp-Werten (`paddingHorizontal: 56`, Karten `300×230` bzw. `220×260`,
 * Titel `fontSize: 40`), waehrend Clock/Home/Reciters/Quiz/QuranReader laengst
 * hoehen-relativ rechnen. Android-TV-Geraete melden je nach Dichte sehr
 * unterschiedliche dp-Flaechen (der 320-dpi-Emulator nur 540 dp Hoehe, echte
 * 1×-1080p-Panels 1080 dp) — genau der Fehlertyp, der am 2026-07-24 schon
 * einmal Inhalte abgeschnitten hat.
 *
 * `ratio` ist Breite/Hoehe der Karte (Videos quer, Reels hochkant, Podcasts
 * quadratisches Cover). Zusaetzlich RTL: Reihen und Textausrichtung drehen
 * fuer ar/ur/fa/ps, und der Buchstabenabstand faellt weg (er zerreisst
 * arabische Ligaturen).
 *
 * `metaLines` = wie viele Zeilen die Meta-Zeile hoechstens braucht. Bildschirm-
 * befund Audit 2026-07-29 (320-dpi-Panel, 540 dp hoch): auf den schmalen
 * Podcast-Karten (Breite = 0,62 x Hoehe = 134 dp) passt „Episode 1 · 11:54"
 * nicht in EINE Zeile, der Umbruch lief unten aus der Karte heraus und die
 * Dauer war abgeschnitten. Videos/Reels zeigen dort nur „8:43" und brauchen
 * weiterhin nur eine Zeile — deshalb ein Parameter statt einer festen 2.
 */
export function makeRowStyles(
  w: number,
  h: number,
  rtl: boolean,
  ratio: number,
  theme: Theme,
  metaLines = 1,
) {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const padH = clamp(w * 0.045, 28, 80);
  const padV = clamp(h * 0.05, 20, 48);
  const align = rtl ? ('right' as const) : ('left' as const);
  // Kartenhoehe aus der Bildschirmhoehe: eine Reihe plus Titel plus der Anfang
  // der naechsten Reihe sollen sichtbar bleiben, damit erkennbar ist, dass es
  // weitergeht — und keine Karte darf unten abgeschnitten werden.
  const cardH = clamp(h * 0.4, 140, 330);
  const cardW = Math.round(cardH * ratio);
  const pad = clamp(cardH * 0.07, 10, 18);
  const titleFont = clamp(cardH * 0.085, 15, 22);
  const metaFont = clamp(cardH * 0.07, 13, 19);
  // Bildhoehe aus dem, was NACH dem Text uebrig bleibt — nicht umgekehrt.
  // Geraetetest 2026-07-28 am 320-dpi-Panel: das quadratische Podcast-Cover
  // (Kartenbreite minus Innenabstand) wurde hoeher als der Platz zuliess und
  // schnitt die Folgenzeile unten ab. Jetzt wird der Textblock zuerst
  // reserviert: zwei Titelzeilen + Abstand + eine Metazeile, mit dem
  // RN-Standard-Zeilenabstand von rund 1,3.
  const textBlock = 2 * titleFont * 1.3 + 4 + metaLines * metaFont * 1.3;
  const mediaH = Math.floor(cardH - pad * 2 - pad * 0.7 - textBlock);
  // Ausgleich fuer die im Fokus wachsende Karte (s. components/fokusUeberstand.ts).
  const ueberstand = fokusUeberstand(Math.max(cardW, cardH));
  return StyleSheet.create({
    // Ohne eigene Grundfarbe: die traegt App.tsx, und darueber liegt der
    // gewaehlte Hintergrund (components/Hintergrund.tsx). Deckend gefuellt
    // blendete dieser Bildschirm ihn aus, obwohl die Einstellung „liegt
    // hinter allen Bereichen" verspricht (Bildschirmbefund 2026-08-16).
    root: { flex: 1 },
    content: { paddingHorizontal: padH, paddingVertical: padV },
    title: {
      color: theme.accent,
      fontSize: clamp(h * 0.05, 26, 44),
      fontWeight: '800',
      letterSpacing: rtl ? 0 : 2,
      marginBottom: clamp(h * 0.03, 14, 26),
      textAlign: align,
    },
    section: { marginBottom: clamp(h * 0.045, 18, 40) },
    sectionTitle: {
      color: theme.text,
      fontSize: clamp(h * 0.033, 18, 28),
      fontWeight: '700',
      marginBottom: clamp(h * 0.018, 8, 16),
      textAlign: align,
    },
    // Negativer Rand + gleich grosser Innenabstand: die Schnittkante wandert
    // nach aussen, die Karten bleiben stehen.
    rowScroll: { marginHorizontal: -ueberstand, marginVertical: -ueberstand },
    row: {
      gap: clamp(w * 0.014, 12, 22),
      paddingRight: padH + ueberstand,
      paddingLeft: ueberstand,
      paddingVertical: ueberstand,
      flexDirection: rtl ? 'row-reverse' : 'row',
    },
    gridScroll: { marginHorizontal: -ueberstand, marginVertical: -ueberstand },
    grid: {
      flexDirection: rtl ? 'row-reverse' : 'row',
      flexWrap: 'wrap',
      gap: clamp(w * 0.014, 12, 22),
      paddingHorizontal: ueberstand,
      paddingTop: ueberstand,
      paddingBottom: padV + ueberstand,
    },
    card: { width: cardW, height: cardH, padding: pad },
    thumb: {
      height: mediaH,
      borderRadius: 12,
      backgroundColor: theme.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: pad * 0.7,
    },
    // Cover bleibt quadratisch, wird aber von der verfuegbaren Hoehe gedeckelt.
    cover: {
      width: Math.min(cardW - pad * 2, mediaH),
      height: Math.min(cardW - pad * 2, mediaH),
      borderRadius: 12,
      // Grundflaeche AUCH beim geladenen Bild: solange es unterwegs ist, stand
      // dort sonst nichts — eine Karte mit Titel und Dauer, aber ohne Bild
      // sieht nach einem Fehler aus (Bildschirmbefund 2026-08-16: von sechs
      // sichtbaren Podcast-Karten hatten drei nach zehn Sekunden noch kein
      // Cover).
      backgroundColor: theme.accentSoft,
      marginBottom: pad * 0.7,
      // Mittig: das Cover ist quadratisch und von der HOEHE gedeckelt, die
      // Karte aber breiter — linksbuendig blieb rechts daneben ein leerer
      // Streifen, der wie ein Fehler aussah (Bildschirmbefund 2026-08-16).
      alignSelf: 'center',
    },
    coverFallback: { backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' },
    /**
     * Die Folgennummer als grosses, blasses Zeichen in der Kachel.
     *
     * WARUM (Befund 2026-08-16 auf der Store-Seite): die Lernvideos haben keine
     * Vorschaubilder — der Index auf R2 fuehrt zu 95 Folgen kein einziges Bild.
     * Die Reihe zeigte deshalb neun IDENTISCHE graue Kaesten mit demselben
     * Dreieck; das sieht nicht nach Zurueckhaltung aus, sondern nach fehlendem
     * Bild. Die Nummer gibt jeder Kachel ein eigenes Gesicht und sagt zugleich
     * etwas Nuetzliches: die Videos sind ein Kurs, die Reihenfolge zaehlt.
     */
    thumbNummer: {
      position: 'absolute',
      color: theme.accent,
      opacity: 0.26,
      fontSize: Math.round(mediaH * 0.6),
      fontWeight: '800',
      // Ziffern in einer sehr grossen Groesse tragen sonst oben und unten
      // Luft mit, die die Kachel aus der Mitte schiebt.
      lineHeight: Math.round(mediaH * 0.7),
      includeFontPadding: false,
    },
    /**
     * Das Abspielsymbol sitzt in der ECKE, nicht in der Mitte.
     *
     * Erste Fassung hatte beides mittig — die Ziffer lag hinter dem Dreieck,
     * und „16" mit einem Dreieck im Bauch der 6 sieht nicht nach Gestaltung
     * aus, sondern nach einem Zeichenfehler (Bildschirmbefund 2026-08-16).
     * In der Ecke sagen beide ihre Sache, ohne sich zu stoeren.
     */
    thumbSymbol: {
      position: 'absolute',
      bottom: Math.round(pad * 0.5),
      ...(rtl ? { left: Math.round(pad * 0.5) } : { right: Math.round(pad * 0.5) }),
    },
    cardTitle: {
      color: theme.text,
      fontSize: titleFont,
      lineHeight: Math.round(titleFont * 1.3),
      fontWeight: '600',
      textAlign: align,
      // Zwei Zeilen sind RESERVIERT — genau so viel, wie `textBlock` oben
      // einrechnet. Ein einzeiliger Titel zoege sonst seine Dauer-Zeile nach
      // oben, und in einer Reihe staenden die Kleinzeilen auf verschiedenen
      // Hoehen (derselbe Befund wie am Startbildschirm, 2026-08-16).
      height: Math.round(titleFont * 1.3) * 2,
    },
    cardMeta: {
      color: theme.textMuted,
      fontSize: metaFont,
      marginTop: 4,
      textAlign: align,
    },
  });
}

/** Ikonengroesse passend zu `makeRowStyles` — eine Zahl, kein Style, deshalb
 *  bewusst getrennt statt in das StyleSheet gequetscht. */
export function rowIconSize(h: number): number {
  return Math.round(Math.max(24, Math.min(52, h * 0.4 * 0.16)));
}
