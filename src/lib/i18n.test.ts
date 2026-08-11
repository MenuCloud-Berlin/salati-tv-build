/**
 * Uebersetzungsschicht der TV-App (Audit 2026-07-28, T13).
 *
 * Der wichtigste Test hier ist die PARITAET: alle 14 Sprachdateien muessen
 * exakt denselben Schluesselumfang haben. Ohne diesen Test faellt eine Luecke
 * erst am Fernseher auf — und zwar als deutscher Text mitten in einer
 * arabischen Oberflaeche (die Fallback-Kette schluckt sie geraeuschlos).
 * Genauso wird geprueft, dass die Platzhalter je Schluessel in JEDER Sprache
 * dieselben sind: ein fehlendes `{n}` in einer Uebersetzung heisst, dass die
 * Zahl am Bildschirm einfach verschwindet.
 */
import fs from 'fs';
import path from 'path';

import { translate } from '@/lib/i18n';
import { LOCALE_ENDONYMS, SUPPORTED_LOCALES, isRtlLocale, type Locale } from '@/lib/locale';
import { SCREENS } from '@/lib/nav';

const LOCALES_DIR = path.join(__dirname, '..', 'locales');

function flatten(obj: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

function load(locale: Locale): Record<string, string> {
  return flatten(JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), 'utf8')));
}

const DICTS = Object.fromEntries(SUPPORTED_LOCALES.map((l) => [l, load(l)])) as Record<
  Locale,
  Record<string, string>
>;
const REFERENCE = DICTS.de;
const REFERENCE_KEYS = Object.keys(REFERENCE).sort();

/** Die Kacheln des Home-Hubs — jede ist auch ein Sprungziel der Handy-Fernbedienung. */
const HOME_TILES = SCREENS.filter((s) => s !== 'home');

function placeholders(s: string): string[] {
  return (s.match(/\{\w+\}/g) ?? []).sort();
}

describe('Sprachdateien', () => {
  it('deckt genau die 14 Sprachen der Handy-App ab', () => {
    const files = fs
      .readdirSync(LOCALES_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''))
      .sort();
    expect(files).toEqual([...SUPPORTED_LOCALES].sort());
    expect(SUPPORTED_LOCALES).toHaveLength(14);
  });

  it.each(SUPPORTED_LOCALES)('%s hat exakt denselben Schluesselumfang wie de', (locale) => {
    expect(Object.keys(DICTS[locale]).sort()).toEqual(REFERENCE_KEYS);
  });

  it.each(SUPPORTED_LOCALES)('%s hat keinen leeren Text', (locale) => {
    const empty = Object.entries(DICTS[locale])
      .filter(([, v]) => v.trim() === '')
      .map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it.each(SUPPORTED_LOCALES)('%s verwendet dieselben Platzhalter wie de', (locale) => {
    const mismatched = REFERENCE_KEYS.filter(
      (k) => placeholders(DICTS[locale][k]).join() !== placeholders(REFERENCE[k]).join(),
    );
    expect(mismatched).toEqual([]);
  });

  it.each(SUPPORTED_LOCALES)('%s ist ausser bei Marken-/Fachbegriffen nicht die deutsche Zeichenkette', (locale) => {
    if (locale === 'de') return;
    // Einige Werte sind sprachuebergreifend gleich (Gebetsnamen, „Podcast",
    // „Reels", Wi-Fi). Wenn eine Sprache aber MEHRHEITLICH mit dem deutschen
    // Text identisch ist, wurde sie nicht uebersetzt, sondern kopiert.
    const identical = REFERENCE_KEYS.filter((k) => DICTS[locale][k] === REFERENCE[k]);
    expect(identical.length).toBeLessThan(REFERENCE_KEYS.length * 0.35);
  });

  it('hat fuer jede Sprache eine Eigenbezeichnung in der Sprachwahl', () => {
    for (const l of SUPPORTED_LOCALES) expect(LOCALE_ENDONYMS[l]?.length).toBeGreaterThan(0);
  });

  it('kennt genau ar/ur/fa/ps als rechtslaeufig', () => {
    expect(SUPPORTED_LOCALES.filter(isRtlLocale)).toEqual(['ar', 'fa', 'ur', 'ps']);
  });
});

describe('translate', () => {
  it('loest einen verschachtelten Schluessel in der gewuenschten Sprache auf', () => {
    expect(translate('de', 'common.retry')).toBe('Erneut versuchen');
    expect(translate('en', 'common.retry')).toBe('Retry');
    expect(translate('tr', 'common.retry')).not.toBe('Erneut versuchen');
    expect(translate('ar', 'settings.language')).toBe('اللغة');
  });

  it('uebernimmt die Formulierungen woertlich aus den Handy-Locales', () => {
    // Belegt die Vorgabe „Terminologie in beiden Apps gleich": Stichproben aus
    // mirror-Schluesseln, direkt gegen apps/mobile geprueft.
    const mobileDir = path.join(__dirname, '..', '..', '..', 'mobile', 'src', 'locales');
    if (!fs.existsSync(mobileDir)) return; // Standalone-Kopie ohne Handy-App
    const mobile = (l: string) => flatten(JSON.parse(fs.readFileSync(path.join(mobileDir, `${l}.json`), 'utf8')));
    for (const l of SUPPORTED_LOCALES) {
      const m = mobile(l);
      expect(DICTS[l]['common.retry']).toBe(m['common.retry']);
      expect(DICTS[l]['common.loading']).toBe(m['common.loading']);
      expect(DICTS[l]['settings.language']).toBe(m['settings.language']);
      expect(DICTS[l]['quiz.playAgain']).toBe(m['practice.playAgain']);
      expect(DICTS[l]['reader.loadError']).toBe(m['quran.loadError']);
      // Audit 2026-07-28 (T14): jede TV-Kachel heisst auf der Handy-
      // Fernbedienung genauso. Vorher wurde nur `home.clock` stichprobenartig
      // geprueft — `home.radio` („Koran-Radio") stand auf dem Handy als
      // „Radio" da, und vier Kacheln fehlten dort ganz.
      for (const screen of HOME_TILES) {
        expect([l, screen, DICTS[l][`home.${screen}`]]).toEqual([
          l,
          screen,
          m[`tvRemote.${screen}`],
        ]);
      }
      // Audit 2026-07-28 (T17): die Countdown-Einheiten muessen in beiden Apps
      // woertlich dieselben sein, sonst zeigt der Fernseher „1س" und das Handy
      // daneben „1h".
      for (const key of ['time.hoursShort', 'time.minutesShort', 'time.secondsShort']) {
        expect([l, key, DICTS[l][key]]).toEqual([l, key, m[key]]);
      }
    }
  });

  it('ersetzt Platzhalter und laesst unbekannte stehen', () => {
    expect(translate('de', 'reader.verseOf', { n: 3, total: 7 })).toBe('Vers 3 / 7');
    // Fehlender Wert bleibt sichtbar stehen, statt still zu einer Luecke zu werden.
    expect(translate('de', 'reader.verseOf', { n: 3 })).toBe('Vers 3 / {total}');
  });

  it('faellt auf Englisch, dann Deutsch, dann den Schluessel selbst zurueck', () => {
    expect(translate('tr', 'gibt.es.nicht')).toBe('gibt.es.nicht');
  });

  it('liefert nie einen leeren String fuer einen unbekannten Schluessel', () => {
    for (const l of SUPPORTED_LOCALES) expect(translate(l, 'nix.da')).toBe('nix.da');
  });
});
