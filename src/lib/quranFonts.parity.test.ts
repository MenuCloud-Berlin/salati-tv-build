/**
 * `src/lib/quranFonts.ts` ist eine Spiegelkopie von
 * `apps/mobile/src/features/quran/fonts.ts` — gleiche Begründung wie bei
 * `methods.parity.test.ts`: apps/tv ist ein eigenes pnpm-Projekt, ein Import
 * über die App-Grenze wäre im Metro-Bundle nicht auflösbar.
 *
 * Warum ein Wächter: an dieser Datei hängen die Umschreibungen des Korantextes
 * (`adaptQuranText`) und die gemessenen Schrift-Kennzahlen. Läuft die Kopie
 * auseinander, zeigt der Fernseher an genau den Stellen Platzhalter-Kreise
 * mitten im Vers, an denen das Handy den richtigen Buchstaben zeichnet — und
 * niemand sähe es, bis jemand den Fernseher anmacht.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const HANDY_DATEI = join(__dirname, '..', '..', '..', 'mobile', 'src', 'features', 'quran', 'fonts.ts');
const TV_DATEI = join(__dirname, 'quranFonts.ts');

/** Alles ab der ersten Nicht-Kommentarzeile — der Kopf darf sich unterscheiden. */
function rumpf(quelle: string): string {
  const zeilen = quelle.split(/\r?\n/);
  const start = zeilen.findIndex((z) => z.trim() !== '' && !z.trimStart().startsWith('//'));
  return zeilen.slice(start).join('\n').trimEnd();
}

describe('Schriften-Katalog stimmt mit der Handy-App überein', () => {
  // Die Standalone-Kopie der TV-App (eigenes Repo für den EAS-Build) hat keine
  // Handy-App daneben — dort ist nichts zu vergleichen.
  const vergleichbar = existsSync(HANDY_DATEI);

  (vergleichbar ? it : it.skip)('hat denselben Inhalt wie die Handy-Datei', () => {
    expect(rumpf(readFileSync(TV_DATEI, 'utf8'))).toBe(rumpf(readFileSync(HANDY_DATEI, 'utf8')));
  });

  it('weist in der Kopie auf den Ursprung hin', () => {
    expect(readFileSync(TV_DATEI, 'utf8')).toContain('SPIEGELKOPIE');
  });
});
