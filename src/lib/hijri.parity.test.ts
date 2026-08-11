/**
 * `src/lib/hijri.ts` ist eine Spiegelkopie aus
 * `apps/mobile/src/features/calendar/offline.ts` (Konverter + Monatsnamen).
 *
 * Anders als bei `methods.ts` und `quranFonts.ts` ist es KEINE ganze Datei,
 * sondern ein Ausschnitt — ein Textvergleich wie dort ginge also nicht. Statt
 * dessen wird das VERHALTEN verglichen: beide Konverter laufen ueber denselben
 * Zeitraum und muessen Tag fuer Tag dasselbe Hidschri-Datum liefern, und die
 * Monatsnamen muessen in allen 14 Sprachen wortgleich sein. Laeuft die Kopie
 * auseinander, zeigt der Fernseher ein anderes Datum als das Handy daneben.
 */
import { existsSync } from 'fs';
import { join } from 'path';

import { gregorianToHijriOffline, HIJRI_MONTHS } from '@/lib/hijri';
import { SUPPORTED_LOCALES } from '@/lib/locale';

const HANDY_DATEI = join(__dirname, '..', '..', '..', 'mobile', 'src', 'features', 'calendar', 'offline.ts');
const vergleichbar = existsSync(HANDY_DATEI);

// eslint-disable-next-line @typescript-eslint/no-require-imports -- bedingter Import: die Standalone-Kopie hat keine Handy-App daneben.
const handy = vergleichbar ? require(HANDY_DATEI) : null;

describe('Hidschri-Datum stimmt mit der Handy-App überein', () => {
  (vergleichbar ? it : it.skip)('liefert für 1.200 Tage in Folge dasselbe Datum', () => {
    // Gut drei Jahre ab dem 1.1.2026 — deckt jeden Monatsübergang und drei
    // Jahreswechsel beider Kalender ab.
    const abweichungen: string[] = [];
    for (let i = 0; i < 1200; i++) {
      const tag = new Date(2026, 0, 1 + i);
      const meins = gregorianToHijriOffline(tag);
      const ihres = handy.gregorianToHijriOffline(tag);
      if (meins.year !== ihres.year || meins.month !== ihres.month || meins.day !== ihres.day) {
        abweichungen.push(`${tag.toDateString()}: TV ${JSON.stringify(meins)} vs Handy ${JSON.stringify(ihres)}`);
      }
    }
    expect(abweichungen).toEqual([]);
  });

  (vergleichbar ? it : it.skip)('führt in jeder Sprache dieselben zwölf Monatsnamen', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(HIJRI_MONTHS[locale]).toEqual(handy.HIJRI_MONTHS[locale]);
    }
  });

  it('hat für jede der 14 Sprachen genau zwölf Monatsnamen', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(HIJRI_MONTHS[locale]).toHaveLength(12);
      for (const name of HIJRI_MONTHS[locale]) expect(name.trim()).not.toBe('');
    }
  });
});
