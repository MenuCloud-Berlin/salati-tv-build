import { DEFAULT_THEME_ID, isThemeId, THEMES, themeById, type Theme } from '@/lib/theme';

/**
 * Ein Thema ist kein Geschmacksdetail, sondern die Farbe JEDES Bildschirms —
 * eine Luecke darin faerbt Text `undefined` und damit auf Android schwarz.
 * Auf einem schwarzen Hintergrund ist das ein unsichtbarer Bildschirm.
 */
const PFLICHTFARBEN: (keyof Theme)[] = [
  'bg',
  'card',
  'cardFocus',
  'cardActive',
  'accent',
  'accentSoft',
  'text',
  'textMuted',
  'textFaint',
  'surface',
  'glowRing',
  'scrim',
  'ok',
  'okSoft',
  'okText',
  'err',
  'errSoft',
  'errText',
];

/** Relative Leuchtdichte nach WCAG — aus `#rrggbb` oder `rgba(r,g,b,a)`. */
function luminanz(farbe: string): number {
  let r: number;
  let g: number;
  let b: number;
  if (farbe.startsWith('#')) {
    r = parseInt(farbe.slice(1, 3), 16);
    g = parseInt(farbe.slice(3, 5), 16);
    b = parseInt(farbe.slice(5, 7), 16);
  } else {
    const teile = farbe.match(/[\d.]+/g);
    if (!teile) throw new Error(`unlesbare Farbe: ${farbe}`);
    [r, g, b] = teile.map(Number);
  }
  const kanal = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
}

function kontrast(a: string, b: string): number {
  const [hell, dunkel] = [luminanz(a), luminanz(b)].sort((x, y) => y - x);
  return (hell + 0.05) / (dunkel + 0.05);
}

describe('Farbwelten', () => {
  it('führt jedes Thema genau einmal und kennt das Standardthema', () => {
    const ids = THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DEFAULT_THEME_ID);
  });

  it.each(THEMES.map((t) => [t.id, t] as const))('%s setzt jede Pflichtfarbe', (_id, thema) => {
    for (const key of PFLICHTFARBEN) {
      expect(typeof thema[key]).toBe('string');
      expect(thema[key]).not.toBe('');
    }
  });

  /**
   * Der eigentliche Grund fuer diesen Test: der Fernseher steht drei Meter weg.
   * Ein Thema, dessen Text im Hintergrund verschwindet, ist keine Geschmacks-,
   * sondern eine Fehlfunktion — und beim hellen Thema „Papier" waere sie beim
   * Ablesen der Farbwerte am Bildschirm nicht aufgefallen, weil die dunklen
   * Themen ihre Werte einfach umgekehrt haben.
   *
   * 4,5:1 ist die WCAG-Schwelle fuer Fliesstext (AA). Die Uhr ist deutlich
   * groesser als Fliesstext, die Hinweiszeilen sind es nicht.
   */
  it.each(THEMES.map((t) => [t.id, t] as const))(
    '%s hält Text, Akzent und Meldungen lesbar über dem Hintergrund',
    (_id, thema) => {
      expect(kontrast(thema.text, thema.bg)).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(thema.accent, thema.bg)).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(thema.okText, thema.bg)).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(thema.errText, thema.bg)).toBeGreaterThanOrEqual(4.5);
    },
  );

  /**
   * `glowRing` ist die einzige Farbe, die als VOLLE Farbe vorliegen muss: die
   * Deckkraft setzt der Verlauf in components/AmbientGlow.tsx. Eine bereits
   * transparente Angabe wuerde dort ein zweites Mal abgeschwaecht und waere am
   * Bildschirm gar nicht mehr zu sehen.
   */
  it.each(THEMES.map((t) => [t.id, t] as const))('%s gibt die Lichtfarbe voll deckend an', (_id, thema) => {
    expect(thema.glowRing).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('markiert genau ein helles Thema', () => {
    const hell = THEMES.filter((t) => !t.dark);
    expect(hell.map((t) => t.id)).toEqual(['papier']);
    // Und es ist wirklich hell — sonst waere `dark: false` eine leere Behauptung.
    expect(luminanz(hell[0].bg)).toBeGreaterThan(0.5);
  });

  it('fällt bei unbekannter Kennung auf das Standardthema zurück, statt undefined zu liefern', () => {
    for (const muell of [undefined, null, '', 'gibtsnicht', 42, {}]) {
      expect(themeById(muell).id).toBe(DEFAULT_THEME_ID);
    }
    expect(isThemeId('papier')).toBe(true);
    expect(isThemeId('gibtsnicht')).toBe(false);
  });
});
