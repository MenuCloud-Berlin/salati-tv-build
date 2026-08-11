/**
 * `src/lib/methods.ts` ist eine Spiegelkopie von
 * `apps/mobile/src/features/settings/methods.ts` — apps/tv ist ein eigenes
 * pnpm-Projekt, ein Import über die App-Grenze wäre im Metro-Bundle nicht
 * auflösbar.
 *
 * Eine Kopie ohne Wächter läuft auseinander. Dieser Test vergleicht deshalb den
 * Inhalt beider Dateien: identisch bis auf den Kopfkommentar, der in der Kopie
 * erklärt, DASS sie eine Kopie ist. Wer die Winkel einer Behörde nur an einer
 * Stelle ändert, sieht es hier — nicht der Nutzer auf dem Sofa, dessen
 * Fernseher dann andere Zeiten zeigt als sein Handy.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const HANDY_DATEI = join(__dirname, '..', '..', '..', 'mobile', 'src', 'features', 'settings', 'methods.ts');
const TV_DATEI = join(__dirname, 'methods.ts');

/** Alles ab der ersten Nicht-Kommentarzeile — der Kopf darf sich unterscheiden. */
function rumpf(quelle: string): string {
  const zeilen = quelle.split(/\r?\n/);
  const start = zeilen.findIndex((z) => z.trim() !== '' && !z.trimStart().startsWith('//'));
  return zeilen.slice(start).join('\n').trimEnd();
}

describe('Behörden-Katalog stimmt mit der Handy-App überein', () => {
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
