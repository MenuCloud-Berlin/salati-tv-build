import { makeRowStyles, rowIconSize } from '@/components/rowStyles';
import { themeById } from '@/lib/theme';

// Die Masse haengen NICHT am Thema — es liefert nur Farben. Ein festes Thema
// hier haelt den Test darauf gerichtet, worum es geht: die Platzbilanz.
const THEMA = themeById('mitternacht');

/**
 * Bildschirmbefund Audit 2026-07-29 (Podcast-Reihe, 320-dpi-Panel): die Meta-
 * Zeile „Episode 1 · 11:54" brach auf der schmalen Karte um und die zweite
 * Zeile lief unten aus der Karte heraus. Ursache war die Platzrechnung in
 * `makeRowStyles`, die IMMER nur eine Meta-Zeile reservierte.
 *
 * Der Test rechnet dieselbe Bilanz nach, die die Karte am Bildschirm halten
 * muss: Innenabstaende + Medienflaeche + Abstand + zwei Titelzeilen + die
 * gemeldeten Meta-Zeilen duerfen die Kartenhoehe nicht ueberschreiten.
 */
const SCREENS: [number, number, string][] = [
  [960, 540, '1080p bei 320 dpi (Emulator/viele Sticks)'],
  [1920, 1080, '1080p bei 1x'],
  [1280, 720, '720p'],
  [3840, 2160, '4K bei 1x'],
  [640, 360, 'sehr kleine dp-Flaeche'],
];

function bilanz(s: ReturnType<typeof makeRowStyles>, metaLines: number, media: number) {
  const pad = s.card.padding as number;
  const title = s.cardTitle.fontSize as number;
  const meta = s.cardMeta.fontSize as number;
  return pad * 2 + media + pad * 0.7 + 2 * title * 1.3 + 4 + metaLines * meta * 1.3;
}

describe('makeRowStyles', () => {
  it.each(SCREENS)('%i x %i (%s): Videos/Reels passen in die Karte', (w, h) => {
    for (const ratio of [1.3, 0.85]) {
      const s = makeRowStyles(w, h, false, ratio, THEMA);
      expect(s.thumb.height as number).toBeGreaterThan(0);
      expect(bilanz(s, 1, s.thumb.height as number)).toBeLessThanOrEqual((s.card.height as number) + 0.5);
    }
  });

  it.each(SCREENS)('%i x %i (%s): Podcast-Cover laesst Platz fuer ZWEI Meta-Zeilen', (w, h) => {
    const s = makeRowStyles(w, h, false, 0.62, THEMA, 2);
    const cover = s.cover.height as number;
    expect(cover).toBeGreaterThan(0);
    expect(bilanz(s, 2, cover)).toBeLessThanOrEqual((s.card.height as number) + 0.5);
    // Das Cover bleibt quadratisch und passt in die Kartenbreite.
    expect(s.cover.width).toBe(cover);
    expect(cover).toBeLessThanOrEqual((s.card.width as number) - 2 * (s.card.padding as number));
  });

  it('reserviert mit zwei Meta-Zeilen weniger Medienflaeche als mit einer', () => {
    const eine = makeRowStyles(960, 540, false, 0.62, THEMA, 1);
    const zwei = makeRowStyles(960, 540, false, 0.62, THEMA, 2);
    expect(zwei.cover.height as number).toBeLessThan(eine.cover.height as number);
  });

  it('dreht Reihen und Textausrichtung im RTL-Layout', () => {
    const ltr = makeRowStyles(960, 540, false, 1.3, THEMA);
    const rtl = makeRowStyles(960, 540, true, 1.3, THEMA);
    expect(ltr.row.flexDirection).toBe('row');
    expect(rtl.row.flexDirection).toBe('row-reverse');
    expect(ltr.cardTitle.textAlign).toBe('left');
    expect(rtl.cardTitle.textAlign).toBe('right');
    // Buchstabenabstand zerreisst arabische Ligaturen.
    expect(rtl.title.letterSpacing).toBe(0);
  });

  it('haelt die Symbolgroesse im sichtbaren Bereich', () => {
    for (const [, h] of SCREENS) {
      const size = rowIconSize(h);
      expect(size).toBeGreaterThanOrEqual(24);
      expect(size).toBeLessThanOrEqual(52);
    }
  });
});
