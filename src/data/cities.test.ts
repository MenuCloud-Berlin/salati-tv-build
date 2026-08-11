/**
 * Sprachparitaet der Staedteliste (Audit 2026-07-28, T16).
 *
 * Der Kern ist derselbe Gedanke wie in `lib/i18n.test.ts`: eine Luecke in einer
 * Sprache faellt am Bildschirm NICHT auf, weil `cityLabel` still auf Englisch
 * zurueckfaellt — ein arabischer Nutzer saehe dann eine arabische Liste mit
 * einem lateinischen Eintrag mittendrin und wuesste nicht, dass das ein Fehler
 * ist. Der Test macht die Luecke sichtbar, bevor sie das Geraet erreicht.
 */
import {
  CITIES,
  cityById,
  cityForLocation,
  cityLabel,
  locationLabel,
  type City,
} from '@/data/cities';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/locale';
import { DEFAULT_LOCATION, METHOD_IDS } from '@/lib/prayerTimes';

// Schriftbereiche der vier nicht-lateinischen Sprachen. Ein lateinischer Name
// in der arabischen Spalte ist der wahrscheinlichste Fehler beim Nachtragen
// einer Stadt („copy aus en") und waere sonst unsichtbar.
const SCRIPTS: Partial<Record<Locale, RegExp>> = {
  ar: /[؀-ۿ]/,
  fa: /[؀-ۿ]/,
  ur: /[؀-ۿ]/,
  ps: /[؀-ۿ]/,
  bn: /[ঀ-৿]/,
  ru: /[Ѐ-ӿ]/,
};

describe('Staedteliste', () => {
  it('hat stabile, eindeutige Schluessel', () => {
    const ids = CITIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it.each(SUPPORTED_LOCALES)('%s hat einen Namen fuer JEDE Stadt', (locale) => {
    const missing = CITIES.filter((c) => !c.labels[locale]?.trim()).map((c) => c.id);
    expect(missing).toEqual([]);
  });

  it('hat in jeder Stadt genau die 14 App-Sprachen — keine mehr, keine weniger', () => {
    const expected = [...SUPPORTED_LOCALES].sort();
    for (const c of CITIES) expect(Object.keys(c.labels).sort()).toEqual(expected);
  });

  it.each(Object.keys(SCRIPTS) as Locale[])('%s steht in der eigenen Schrift', (locale) => {
    const re = SCRIPTS[locale]!;
    const latin = CITIES.filter((c) => !re.test(c.labels[locale])).map((c) => c.id);
    expect(latin).toEqual([]);
  });

  it('ist nicht bloss die deutsche Liste kopiert', () => {
    // Ortsnamen sind haeufig sprachuebergreifend gleich (Berlin, Paris, Dubai),
    // deshalb keine Null-Toleranz — aber eine Sprache, die zu >85 % dem
    // Deutschen gleicht, ist nicht uebersetzt worden.
    for (const locale of SUPPORTED_LOCALES) {
      if (locale === 'de') continue;
      const same = CITIES.filter((c) => c.labels[locale] === c.labels.de).length;
      expect(same / CITIES.length).toBeLessThan(0.85);
    }
  });

  it('haelt Koordinaten und Berechnungsmethode je Stadt plausibel', () => {
    for (const c of CITIES) {
      expect(Math.abs(c.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(c.lon)).toBeLessThanOrEqual(180);
      expect(c.method).toBeTruthy();
    }
  });
});

describe('Standort-Beschriftung', () => {
  const berlin = CITIES.find((c) => c.id === 'berlin') as City;

  it('uebersetzt eine Voreinstellungs-Stadt', () => {
    expect(cityLabel(berlin, 'ar')).toBe('برلين');
    expect(cityLabel(berlin, 'ru')).toBe('Берлин');
  });

  it('faellt fuer einen GPS-Standort vom Handy auf dessen eigenen Namen zurueck', () => {
    // Ein Geocoder-Ergebnis gehoert keiner Stadt dieser Liste — es zu
    // „uebersetzen" hiesse, es durch Englisch zu ersetzen. Das waere falscher
    // als der Originalname.
    const gps = { label: 'Neukölln, Berlin' };
    expect(locationLabel(gps, 'ar')).toBe('Neukölln, Berlin');
  });

  it('erkennt Einstellungen, die VOR dem Audit gespeichert wurden (nur deutscher Name)', () => {
    // Ohne diese Bruecke saehe ein arabischer Nutzer nach dem Update weiter
    // „Kairo" — und keine Kachel waere als aktiv markiert.
    const legacy = { label: 'Kairo' };
    expect(cityForLocation(legacy)?.id).toBe('kairo');
    expect(locationLabel(legacy, 'ar')).toBe('القاهرة');
  });

  it('der Vorgabe-Standort ist eine Stadt aus der Liste', () => {
    // Vorgabe seit dem Audit 2026-07-29 Berlin — wie in der Handy-App
    // (DEFAULT_SETTINGS.location), vorher Makkah.
    expect(cityById(DEFAULT_LOCATION.cityId)?.id).toBe('berlin');
    expect(locationLabel(DEFAULT_LOCATION, 'ru')).toBe('Берлин');
    expect(locationLabel(DEFAULT_LOCATION, 'en')).toBe(DEFAULT_LOCATION.label);
  });

  it('unbekannter Schluessel liefert keine Stadt', () => {
    expect(cityById('gibt-es-nicht')).toBeUndefined();
    expect(cityById(undefined)).toBeUndefined();
  });
});

/**
 * Audit 2026-07-29 (P1): jede voreingestellte Stadt muss eine Methode tragen,
 * die es auch in der Handy-App gibt. Vorher standen hier adhan-js-Namen, zwei
 * davon („Dubai", „Tehran") ohne jede Entsprechung auf dem Handy.
 */
describe('Berechnungsmethode je Stadt', () => {
  it('nutzt nur Methoden, die auch die Handy-App anbietet', () => {
    for (const c of CITIES) {
      expect([c.id, METHOD_IDS.includes(c.method)]).toEqual([c.id, true]);
    }
  });

  it('belegt die deutschsprachigen Staedte mit Diyanet wie die Handy-Vorgabe', () => {
    for (const id of ['berlin', 'hamburg', 'muenchen', 'koeln', 'frankfurt', 'stuttgart', 'duesseldorf', 'wien']) {
      expect([id, cityById(id)?.method]).toEqual([id, 13]);
    }
  });
});

/**
 * Zeitzonen (Audit-Befund P10/K5). 41 Staedte von Hand einzutragen ist genau
 * die Art Liste, in der ein Tippfehler unbemerkt bleibt: `Europe/Muenchen`
 * gibt es nicht, und `Intl` wirft dann erst auf dem Fernseher.
 *
 * Geprueft wird deshalb beides — dass die Zone EXISTIERT und dass sie zur
 * Laenge passt: der Zonen-Offset muss ungefaehr dem entsprechen, was der
 * Laengengrad erwarten laesst (15 Grad = 1 Stunde). Das faengt vertauschte
 * Kontinente ab, ohne fuer jede Stadt einen Sollwert zu pflegen.
 */
describe('Zeitzonen der Staedte', () => {
  it('traegt fuer jede Stadt eine Zone ein', () => {
    for (const c of CITIES) {
      expect(typeof c.tz).toBe('string');
      expect(c.tz).toMatch(/^[A-Za-z]+\/[A-Za-z_+-]+$/);
    }
  });

  it.each(CITIES.map((c) => [c.id, c] as const))('%s: die Zone existiert wirklich', (_id, c) => {
    expect(() => new Intl.DateTimeFormat('en-GB', { timeZone: c.tz }).format(new Date())).not.toThrow();
  });

  it.each(CITIES.map((c) => [c.id, c] as const))('%s: Zone passt zum Laengengrad', (_id, c) => {
    // Offset der Zone in Stunden, gemessen an einem festen Zeitpunkt.
    const t = new Date(Date.UTC(2026, 6, 1, 12, 0, 0));
    const alsZone = new Date(
      new Intl.DateTimeFormat('en-US', {
        timeZone: c.tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      })
        .format(t)
        .replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/, '$3-$1-$2T$4:$5:$6Z'),
    );
    const offsetStunden = (alsZone.getTime() - t.getTime()) / 3_600_000;
    const ausLaenge = c.lon / 15;
    // 3 Stunden Spielraum: Zonengrenzen folgen Staatsgrenzen, nicht Meridianen
    // (Spanien liegt auf Greenwich-Laenge und faehrt Mitteleuropaeische Zeit),
    // und die Sommerzeit verschiebt zusaetzlich um eine Stunde.
    expect(Math.abs(offsetStunden - ausLaenge)).toBeLessThanOrEqual(3);
  });
});
