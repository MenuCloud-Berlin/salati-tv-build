/**
 * DER Test dieses Audits (2026-07-29): die TV-App muss dieselben Gebetszeiten
 * liefern wie die Handy-App.
 *
 * Die Sollwerte in `parity-table.generated.ts` stammen aus einem direkten Lauf
 * von `apps/mobile/src/features/prayer-times/calc.ts` — sie sind nicht hier
 * nachgerechnet. 19 Faelle (alle 13 Berechnungsmethoden, beide Madhabs, drei
 * Hochbreiten-Regeln, Nord- und Suedhalbkugel, Polarkreis) x 4 Termine ueber
 * das Jahr = 76 Tage, 456 Einzelzeiten.
 *
 * Warum ueberhaupt eine Tabelle und kein direkter Import der Handy-Funktion:
 * apps/tv ist ein eigenstaendiges pnpm-Projekt (eigenes Lockfile, eigener
 * EAS-Build). Ein Import quer ueber die App-Grenze waere im Metro-Bundle nicht
 * aufloesbar. Die Tabelle ist zugleich die Regressionsbremse: aendert jemand
 * die Rechenkette der TV-App, wird dieser Test rot, nicht erst der Nutzer.
 */
import { MOBILE_PARITY_TABLE } from '@/lib/parity-table.generated';
import { METHOD_IDS, fmtTime, timesFor, toMethodId, type PrayerKey, type TvLocation } from '@/lib/prayerTimes';
import { NO_PRAYER_TIME_OFFSETS } from '@/lib/prayerTimes';

/** Aladhan-Feldname je TV-Schluessel. */
const FIELDS: Record<PrayerKey, keyof MobileTimings> = {
  fajr: 'Fajr',
  sunrise: 'Sunrise',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};
type MobileTimings = { Fajr: string; Sunrise: string; Dhuhr: string; Asr: string; Maghrib: string; Isha: string };

describe('Gleichheit mit der Handy-App', () => {
  it('pinnt die Zeitzone des Testlaufs (sonst ist die Tabelle nicht vergleichbar)', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Berlin');
  });

  for (const c of MOBILE_PARITY_TABLE) {
    describe(c.id, () => {
      const loc: TvLocation = {
        lat: c.lat,
        lon: c.lon,
        label: c.id,
        method: toMethodId(c.method),
        madhab: c.madhab,
      };
      for (const day of c.days) {
        it(`${day.date} — alle sechs Zeiten identisch`, () => {
          const [y, m, d] = day.date.split('-').map(Number);
          const tv = timesFor(loc, new Date(y, m - 1, d, 12, 0), {
            highLatitude: c.highLatitude,
            offsets: NO_PRAYER_TIME_OFFSETS,
          });
          const actual = Object.fromEntries(
            (Object.keys(FIELDS) as PrayerKey[]).map((k) => [FIELDS[k], fmtTime(tv[k], true)]),
          );
          expect(actual).toEqual(day.t);
        });
      }
    });
  }
});

describe('Minuten-Korrektur', () => {
  const loc: TvLocation = { lat: 52.52, lon: 13.405, label: 'Berlin', method: 13, madhab: 'shafi' };
  const day = new Date(2026, 0, 15, 12, 0);

  it('verschiebt genau das gewaehlte Gebet um die gewaehlten Minuten', () => {
    const base = timesFor(loc, day);
    const shifted = timesFor(loc, day, {
      highLatitude: 'auto',
      offsets: { ...NO_PRAYER_TIME_OFFSETS, fajr: -5, isha: 7 },
    });
    expect(shifted.fajr.getTime() - base.fajr.getTime()).toBe(-5 * 60_000);
    expect(shifted.isha.getTime() - base.isha.getTime()).toBe(7 * 60_000);
    expect(shifted.dhuhr.getTime()).toBe(base.dhuhr.getTime());
  });

  it('begrenzt auf +/-60 Minuten wie die Handy-App', () => {
    const base = timesFor(loc, day);
    const extreme = timesFor(loc, day, {
      highLatitude: 'auto',
      offsets: { ...NO_PRAYER_TIME_OFFSETS, asr: 999 },
    });
    expect(extreme.asr.getTime() - base.asr.getTime()).toBe(60 * 60_000);
  });
});

describe('Hochbreiten-Regel', () => {
  const berlin: TvLocation = { lat: 52.52, lon: 13.405, label: 'Berlin', method: 13, madhab: 'shafi' };
  const sommer = new Date(2026, 5, 21, 12, 0);

  // Der Befund, der das Audit ausgeloest hat: ohne gesetzte Regel faellt
  // adhan-js auf „Mitte der Nacht" zurueck. In Berlin am laengsten Tag liegen
  // beide Regeln ueber eine Stunde auseinander.
  it('unterscheidet sich in Berlin im Sommer deutlich zwischen den Regeln', () => {
    const angle = timesFor(berlin, sommer, { highLatitude: 'twilightAngle', offsets: NO_PRAYER_TIME_OFFSETS });
    const middle = timesFor(berlin, sommer, { highLatitude: 'middleOfNight', offsets: NO_PRAYER_TIME_OFFSETS });
    const diffFajr = Math.abs(angle.fajr.getTime() - middle.fajr.getTime()) / 60_000;
    expect(diffFajr).toBeGreaterThan(60);
  });

  it('waehlt bei `auto` oberhalb von 48 Grad die winkelbasierte Regel — auch suedlich', () => {
    const puntaArenas: TvLocation = { lat: -53.1638, lon: -70.9171, label: 'PA', method: 3, madhab: 'shafi' };
    const auto = timesFor(puntaArenas, new Date(2026, 11, 21, 12, 0), {
      highLatitude: 'auto',
      offsets: NO_PRAYER_TIME_OFFSETS,
    });
    const angle = timesFor(puntaArenas, new Date(2026, 11, 21, 12, 0), {
      highLatitude: 'twilightAngle',
      offsets: NO_PRAYER_TIME_OFFSETS,
    });
    expect(fmtTime(auto.fajr)).toBe(fmtTime(angle.fajr));
    expect(fmtTime(auto.isha)).toBe(fmtTime(angle.isha));
  });

  it('nimmt naeher am Aequator die Mitte der Nacht', () => {
    const kairo: TvLocation = { lat: 30.0444, lon: 31.2357, label: 'Kairo', method: 5, madhab: 'shafi' };
    const auto = timesFor(kairo, sommer, { highLatitude: 'auto', offsets: NO_PRAYER_TIME_OFFSETS });
    const middle = timesFor(kairo, sommer, { highLatitude: 'middleOfNight', offsets: NO_PRAYER_TIME_OFFSETS });
    expect(fmtTime(auto.fajr)).toBe(fmtTime(middle.fajr));
  });
});

describe('Polarkreis', () => {
  // Ohne PolarCircleResolution liefert adhan-js dort `Invalid Date` — die Uhr
  // zeigte „NaN:NaN".
  it('liefert in Tromsoe auch mitten im Polarwinter gueltige Zeiten', () => {
    const tromsoe: TvLocation = { lat: 69.6492, lon: 18.9553, label: 'Tromsoe', method: 3, madhab: 'shafi' };
    for (const d of [new Date(2026, 11, 10, 12, 0), new Date(2026, 5, 21, 12, 0)]) {
      const t = timesFor(tromsoe, d);
      for (const key of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerKey[]) {
        expect(Number.isFinite(t[key].getTime())).toBe(true);
        expect(fmtTime(t[key])).toMatch(/^\d{2}:\d{2}$/);
      }
      // Asr-Kappung: die Reihenfolge muss halten, darauf baut nextPrayer.
      expect(t.asr.getTime()).toBeGreaterThan(t.dhuhr.getTime());
      expect(t.asr.getTime()).toBeLessThanOrEqual(t.maghrib.getTime());
    }
  });
});

/**
 * Gegenprobe gegen die QUELLE statt gegen eine Kopie: liest die Methodenliste
 * der Handy-App direkt aus deren Datei. Wird dort eine Methode ergaenzt oder
 * entfernt, wird dieser Test rot — sonst faellt die Liste der TV-App still
 * hinter die der Handy-App zurueck (genau so entstand der Befund, dass der
 * Fernseher „Dubai" und „Teheran" anbot, die es auf dem Handy nicht gibt).
 */
describe('Methodenliste gegen apps/mobile', () => {
  it('bietet exakt dieselben Methoden in derselben Reihenfolge an', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const file = path.join(__dirname, '..', '..', '..', 'mobile', 'src', 'features', 'settings', 'methods.ts');
    if (!fs.existsSync(file)) return; // Standalone-Kopie ohne Handy-App
    const src = fs.readFileSync(file, 'utf8');
    const block = src.slice(src.indexOf('export const PRAYER_METHODS'), src.indexOf('export const DEFAULT_METHOD_ID'));
    const ids = [...block.matchAll(/^\s{4}id:\s*(\d+),$/gm)].map((m) => Number(m[1]));
    expect(ids.length).toBeGreaterThan(0);
    expect(METHOD_IDS).toEqual(ids);
  });
});
