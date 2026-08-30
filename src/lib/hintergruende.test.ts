import {
  HINTERGRUENDE,
  hintergrundNameKey,
  istHintergrundId,
  medienId,
  medienIdLesen,
} from '@/lib/hintergruende';

/**
 * Die Kennung eines Motivs wird zu einem DATEINAMEN auf dem Geraet
 * (lib/hintergrundMedien.ts) und kommt aus einem Index im Netz. Deshalb steht
 * hier nicht nur, was erlaubt ist, sondern vor allem, was es nicht ist.
 */
describe('medienIdLesen', () => {
  it('liest eine gueltige Kennung', () => {
    expect(medienIdLesen('medium:kaaba-nacht')).toBe('kaaba-nacht');
    expect(medienIdLesen(medienId('tawaf'))).toBe('tawaf');
  });

  it('verwirft alles, was einen Pfad aufmachen koennte', () => {
    for (const boese of [
      'medium:../../geheim',
      'medium:a/b',
      'medium:a\\b',
      'medium:Kaaba',       // Grossbuchstaben sind nicht vorgesehen
      'medium:',
      'medium:' + 'a'.repeat(65),
      'kaaba-nacht',
      42,
      null,
      undefined,
    ]) {
      expect(medienIdLesen(boese)).toBeNull();
    }
  });
});

describe('istHintergrundId', () => {
  it('nimmt jeden gezeichneten Hintergrund', () => {
    for (const id of HINTERGRUENDE) expect(istHintergrundId(id)).toBe(true);
  });

  it('nimmt ein Motiv und verwirft Unbekanntes', () => {
    expect(istHintergrundId('medium:tawaf')).toBe(true);
    expect(istHintergrundId('bunt')).toBe(false);
    expect(istHintergrundId('medium:../x')).toBe(false);
  });
});

it('bildet fuer jeden gezeichneten Hintergrund einen Locale-Schluessel', () => {
  for (const id of HINTERGRUENDE) {
    expect(hintergrundNameKey(id)).toBe(`settings.background.${id}`);
  }
});
