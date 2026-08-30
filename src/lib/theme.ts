// Farbwelten der TV-App.
//
// WARUM ES DIESE DATEI GIBT: bis 1.3.0 stand die Farbe an jeder Stelle einzeln
// im Quelltext — `#0b0b0d`, `#d4af37`, `#f7f3ea` und ein gutes Dutzend
// `rgba(247,243,234,0.55)`-Varianten, verteilt ueber elf Bildschirme und fuenf
// Bausteine. Eine Hintergrund-Einstellung war damit nicht nachtraeglich
// einbaubar, ohne jede Datei anzufassen; genau das ist hier passiert.
//
// Ein Thema beschreibt NUR Farbe. Groessen bleiben dort, wo sie hingehoeren:
// in den dichte-relativen `makeStyles()` der Bildschirme (siehe ClockScreen).
//
// AUSWAHLKRITERIUM der fuenf Themen: jedes muss auf einem Fernseher aus drei
// Metern Sitzabstand lesbar bleiben. Deshalb traegt jedes Thema seinen eigenen
// Akzent (nicht nur einen anderen Hintergrund) und eine eigene Textfarbe —
// Gold auf Papier ist unlesbar, Dunkelbraun auf Mitternacht ebenso.

export type ThemeId = 'mitternacht' | 'tiefschwarz' | 'nachtblau' | 'smaragd' | 'papier';

export interface Theme {
  id: ThemeId;
  /** Uebersetzungs-Schluessel des Anzeigenamens. */
  nameKey: string;
  /** false = heller Untergrund. Steuert Statusleiste und Schatten-Entscheidungen. */
  dark: boolean;
  /** Grundflaeche jedes Bildschirms. */
  bg: string;
  /** Ruhende Karte (FocusCard ohne Fokus). */
  card: string;
  /** Fokussierte Karte. */
  cardFocus: string;
  /** Aktive/gewaehlte Karte (Einstellungen). */
  cardActive: string;
  /** Rahmen der fokussierten bzw. aktiven Karte. */
  accent: string;
  /** Akzent, weit heruntergedimmt — Flaechen hinter Akzent-Text. */
  accentSoft: string;
  /** Primaertext. */
  text: string;
  /** Zweitrangiger Text (Untertitel, Meta). */
  textMuted: string;
  /** Beilaeufiger Text (Hinweiszeilen). */
  textFaint: string;
  /** Ruhige Flaeche ohne Fokusbedeutung (Uhr-Zellen, Miniaturen). */
  surface: string;
  /**
   * Zweite Lichtfarbe fuer den Hintergrund-Schein (die erste ist `accent`).
   * VOLLE Farbe, keine rgba-Angabe: die Deckkraft setzt der Verlauf selbst
   * (s. components/AmbientGlow.tsx). Eine bereits transparente Farbe wuerde
   * dort ein zweites Mal abgeschwaecht und waere unsichtbar.
   */
  glowRing: string;
  /** Abdunkelung ueber einem Cover-Bild, damit Text darauf lesbar bleibt. */
  scrim: string;
  /**
   * Richtig/falsch im Quiz. BEWUSST im Thema und nicht als feste Konstante:
   * das helle Thema braucht dunkle Schrift auf hellem Grund — die frueher fest
   * gesetzten `#7BE29B`/`#FF9B9B` waeren auf Papier praktisch unsichtbar.
   */
  ok: string;
  okSoft: string;
  okText: string;
  err: string;
  errSoft: string;
  errText: string;
}

/**
 * Reihenfolge = Anzeigereihenfolge in den Einstellungen: die drei dunklen
 * zuerst (ein Fernseher steht meist in einem abgedunkelten Raum), danach die
 * beiden mit ausgepraegter Eigenfarbe.
 */
export const THEMES: readonly Theme[] = [
  {
    id: 'mitternacht',
    nameKey: 'settings.theme.mitternacht',
    dark: true,
    bg: '#0b0b0d',
    card: 'rgba(255,255,255,0.05)',
    cardFocus: 'rgba(212,175,55,0.12)',
    cardActive: 'rgba(212,175,55,0.16)',
    accent: '#d4af37',
    accentSoft: 'rgba(212,175,55,0.16)',
    text: '#f7f3ea',
    textMuted: 'rgba(247,243,234,0.6)',
    textFaint: 'rgba(247,243,234,0.4)',
    surface: 'rgba(255,255,255,0.03)',
    glowRing: '#2E9E4F',
    scrim: 'rgba(11,11,13,0.7)',
    ok: '#2E9E4F',
    okSoft: 'rgba(46,158,79,0.2)',
    okText: '#7BE29B',
    err: '#D64545',
    errSoft: 'rgba(214,69,69,0.2)',
    errText: '#FF9B9B',
  },
  {
    // Reines Schwarz: auf OLED-Panels bleiben diese Pixel aus — kein Schimmer
    // im dunklen Raum, und die Uhr brennt sich nicht ein.
    id: 'tiefschwarz',
    nameKey: 'settings.theme.tiefschwarz',
    dark: true,
    bg: '#000000',
    card: 'rgba(255,255,255,0.06)',
    cardFocus: 'rgba(212,175,55,0.14)',
    cardActive: 'rgba(212,175,55,0.18)',
    accent: '#d9b64a',
    accentSoft: 'rgba(217,182,74,0.16)',
    text: '#f4f1e8',
    textMuted: 'rgba(244,241,232,0.58)',
    textFaint: 'rgba(244,241,232,0.38)',
    surface: 'rgba(255,255,255,0.04)',
    glowRing: '#2E9E4F',
    scrim: 'rgba(11,11,13,0.7)',
    ok: '#2E9E4F',
    okSoft: 'rgba(46,158,79,0.2)',
    okText: '#7BE29B',
    err: '#D64545',
    errSoft: 'rgba(214,69,69,0.2)',
    errText: '#FF9B9B',
  },
  {
    id: 'nachtblau',
    nameKey: 'settings.theme.nachtblau',
    dark: true,
    bg: '#071320',
    card: 'rgba(255,255,255,0.06)',
    cardFocus: 'rgba(88,184,201,0.16)',
    cardActive: 'rgba(88,184,201,0.2)',
    accent: '#67c7d8',
    accentSoft: 'rgba(103,199,216,0.16)',
    text: '#eef6f9',
    textMuted: 'rgba(238,246,249,0.62)',
    textFaint: 'rgba(238,246,249,0.42)',
    surface: 'rgba(255,255,255,0.04)',
    glowRing: '#3c6ebe',
    scrim: 'rgba(11,11,13,0.7)',
    ok: '#2E9E4F',
    okSoft: 'rgba(46,158,79,0.2)',
    okText: '#7BE29B',
    err: '#D64545',
    errSoft: 'rgba(214,69,69,0.2)',
    errText: '#FF9B9B',
  },
  {
    id: 'smaragd',
    nameKey: 'settings.theme.smaragd',
    dark: true,
    bg: '#06140f',
    card: 'rgba(255,255,255,0.06)',
    cardFocus: 'rgba(78,201,138,0.16)',
    cardActive: 'rgba(78,201,138,0.2)',
    accent: '#6ddba0',
    accentSoft: 'rgba(109,219,160,0.16)',
    text: '#eef8f2',
    textMuted: 'rgba(238,248,242,0.62)',
    textFaint: 'rgba(238,248,242,0.42)',
    surface: 'rgba(255,255,255,0.04)',
    glowRing: '#d4af37',
    scrim: 'rgba(11,11,13,0.7)',
    ok: '#2E9E4F',
    okSoft: 'rgba(46,158,79,0.2)',
    okText: '#7BE29B',
    err: '#D64545',
    errSoft: 'rgba(214,69,69,0.2)',
    errText: '#FF9B9B',
  },
  {
    // Der einzige helle Untergrund — gedacht fuer den Koran-Leser am Tag und
    // fuer Raeume mit viel Licht, in denen dunkle Flaechen nur spiegeln.
    // Alle Werte sind eigene Groessen, keine Umkehrung der dunklen Themen:
    // durchscheinendes Weiss auf hellem Grund waere unsichtbar.
    id: 'papier',
    nameKey: 'settings.theme.papier',
    dark: false,
    bg: '#f4ecdc',
    card: 'rgba(60,40,15,0.06)',
    cardFocus: 'rgba(148,101,26,0.16)',
    cardActive: 'rgba(148,101,26,0.2)',
    accent: '#8a5c14',
    accentSoft: 'rgba(138,92,20,0.14)',
    text: '#2b2117',
    textMuted: 'rgba(43,33,23,0.68)',
    textFaint: 'rgba(43,33,23,0.5)',
    surface: 'rgba(60,40,15,0.05)',
    glowRing: '#5f7f5f',
    scrim: 'rgba(244,236,220,0.75)',
    ok: '#2f7d4a',
    okSoft: 'rgba(47,125,74,0.18)',
    okText: '#1d5730',
    err: '#a83232',
    errSoft: 'rgba(168,50,50,0.16)',
    errText: '#7d1f1f',
  },
];

export const DEFAULT_THEME_ID: ThemeId = 'mitternacht';

// --------------------------------------------------------------------------
// Akzentfarbe getrennt vom Thema
//
// WARUM (Nutzerwunsch 2026-08-30: „dass man das Design mehr individualisieren
// kann"): Die Farbwelt legt Grundflaeche UND Akzent zusammen fest — wer den
// dunklen Grund von „Mitternacht" mochte, aber lieber Tuerkis als Gold sah,
// musste die ganze Welt wechseln. Der Akzent ist jetzt eine eigene Wahl.
//
// Jeder Akzent traegt ZWEI Werte: einen fuer dunkle Untergruende und einen
// fuer den hellen. Ein einziger Wert ginge nicht — helles Gold auf „Papier"
// ist nicht lesbar, dunkles Braun auf „Mitternacht" ebenso wenig. Genau daran
// scheitert die naive Umsetzung einer Farbwahl, und der Kontrast-Test in
// theme.test.ts wuerde es sofort melden.

export type AkzentId =
  | 'thema'
  | 'gold'
  | 'bernstein'
  | 'tuerkis'
  | 'smaragd'
  | 'saphir'
  | 'lavendel'
  | 'koralle'
  | 'silber';

interface Akzent {
  id: AkzentId;
  /** Uebersetzungs-Schluessel des Anzeigenamens. */
  nameKey: string;
  /** Auf dunklem Grund. */
  hell: string;
  /** Auf hellem Grund („Papier"). */
  dunkel: string;
}

export const AKZENTE: readonly Akzent[] = [
  // „thema" ist keine Farbe, sondern die Abwesenheit einer Wahl: es bleibt bei
  // dem Akzent, den die Farbwelt selbst mitbringt.
  { id: 'thema', nameKey: 'settings.akzent.thema', hell: '', dunkel: '' },
  { id: 'gold', nameKey: 'settings.akzent.gold', hell: '#d4af37', dunkel: '#8a5c14' },
  { id: 'bernstein', nameKey: 'settings.akzent.bernstein', hell: '#e8a33d', dunkel: '#95591a' },
  { id: 'tuerkis', nameKey: 'settings.akzent.tuerkis', hell: '#67c7d8', dunkel: '#116b7c' },
  { id: 'smaragd', nameKey: 'settings.akzent.smaragd', hell: '#6ddba0', dunkel: '#1c7245' },
  { id: 'saphir', nameKey: 'settings.akzent.saphir', hell: '#8ab4f8', dunkel: '#2b5aa8' },
  { id: 'lavendel', nameKey: 'settings.akzent.lavendel', hell: '#b9a7f0', dunkel: '#5b3fa8' },
  { id: 'koralle', nameKey: 'settings.akzent.koralle', hell: '#f0947a', dunkel: '#a33e22' },
  { id: 'silber', nameKey: 'settings.akzent.silber', hell: '#cfd4dd', dunkel: '#4a5260' },
];

const AKZENT_IDS = new Set(AKZENTE.map((a) => a.id));

export function istAkzentId(v: unknown): v is AkzentId {
  return typeof v === 'string' && AKZENT_IDS.has(v as AkzentId);
}

/** `#rrggbb` mit Deckkraft — die Karten-Farben sind halbdurchsichtig, sie
 *  liegen ueber dem Grund und muessen ihn durchscheinen lassen. */
function mitDeckkraft(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * Das Thema mit einem eigenen Akzent.
 *
 * Es werden GENAU die vier Werte ersetzt, die den Akzent tragen: die Farbe
 * selbst, ihre gedimmte Flaeche und die beiden Kartenzustaende. `glowRing`
 * bleibt beim Thema — er ist die ZWEITE Lichtfarbe des Hintergrunds, und
 * zweimal dieselbe Farbe ergaebe keinen Schein, sondern einen Fleck.
 */
export function themaMitAkzent(theme: Theme, akzent: unknown): Theme {
  if (!istAkzentId(akzent) || akzent === 'thema') return theme;
  const eintrag = AKZENTE.find((a) => a.id === akzent);
  if (!eintrag) return theme;
  const farbe = theme.dark ? eintrag.hell : eintrag.dunkel;
  return {
    ...theme,
    accent: farbe,
    accentSoft: mitDeckkraft(farbe, theme.dark ? 0.16 : 0.14),
    cardFocus: mitDeckkraft(farbe, theme.dark ? 0.14 : 0.16),
    cardActive: mitDeckkraft(farbe, theme.dark ? 0.18 : 0.2),
  };
}

const BY_ID = new Map(THEMES.map((t) => [t.id, t]));

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && BY_ID.has(v as ThemeId);
}

/** Thema zur Kennung; faellt auf das Standardthema zurueck. Nie `undefined` —
 *  ein fehlendes Thema wuerde jede Farbe im Baum zu `undefined` machen und die
 *  Oberflaeche schwarz auf schwarz zeichnen. */
export function themeById(id: unknown): Theme {
  return (isThemeId(id) ? BY_ID.get(id) : undefined) ?? BY_ID.get(DEFAULT_THEME_ID)!;
}
