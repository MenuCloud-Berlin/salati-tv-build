/**
 * Audit-Befund P10/K5, seit dem 2026-07-29 offen: Der Fernseher zeigte die
 * richtigen ZEITPUNKTE in der Zone des GERÄTS statt in der des gewählten Ortes.
 * Ein Gerät in Berlin, eingestellt auf Makkah, las die Makkah-Zeiten in
 * Berliner Zeit ab — 1 bis 2 Stunden daneben, ohne dass es irgendwo aussieht
 * wie ein Fehler.
 *
 * Der Testlauf ist auf Europe/Berlin gepinnt (`jest.config.js`), also ist
 * „Gerätezeit" hier immer Berliner Zeit — genau der Fall, den es zu trennen
 * gilt.
 */
import { tagAmOrt, zeitInZone, zeitzonenFaehig, zeitzonenMessungZuruecksetzen, zoneWeichtAb } from '@/lib/timezone';

beforeEach(() => {
  zeitzonenMessungZuruecksetzen();
});

describe('Fähigkeitsprüfung', () => {
  it('bestätigt die Umrechnung auf einer vollständigen ICU', () => {
    // Node bringt sie mit; auf dem Gerät entscheidet Hermes' ICU.
    expect(zeitzonenFaehig()).toBe(true);
  });

  it('meldet Unfähigkeit, wenn die Zone still ignoriert wird', () => {
    // Genau der gefährliche Fall: keine Ausnahme, aber die Zone wirkt nicht.
    // Ohne die Messung zeigte die App weiter Gerätezeit und behauptete Ortszeit.
    const echt = Intl.DateTimeFormat;
    // @ts-expect-error — Attrappe ohne Zeitzonen-Unterstützung
    Intl.DateTimeFormat = function () {
      return { format: () => '13:00' };
    };
    zeitzonenMessungZuruecksetzen();
    expect(zeitzonenFaehig()).toBe(false);
    Intl.DateTimeFormat = echt;
  });

  it('meldet Unfähigkeit, wenn die Umrechnung wirft', () => {
    const echt = Intl.DateTimeFormat;
    // @ts-expect-error — Attrappe, die wirft
    Intl.DateTimeFormat = function () {
      throw new Error('kein ICU');
    };
    zeitzonenMessungZuruecksetzen();
    expect(zeitzonenFaehig()).toBe(false);
    Intl.DateTimeFormat = echt;
  });
});

describe('zeitInZone', () => {
  // 2026-08-08, 12:00 UTC. In Berlin 14:00 (MESZ), in Makkah 15:00 (+3),
  // in Jakarta 19:00 (+7), in New York 08:00 (EDT).
  const t = new Date(Date.UTC(2026, 7, 8, 12, 0, 0));

  it.each([
    ['Europe/Berlin', '14:00'],
    ['Asia/Riyadh', '15:00'],
    ['Asia/Jakarta', '19:00'],
    ['America/New_York', '08:00'],
    ['Asia/Kolkata', '17:30'], // Halbstunden-Offset
  ])('rechnet nach %s um', (tz, erwartet) => {
    expect(zeitInZone(t, tz, true)).toBe(erwartet);
  });

  it('fällt ohne Zone auf die Gerätezeit zurück, statt leer zu bleiben', () => {
    // Der Fall „GPS-Standort vom Handy": Koordinaten ohne Zonennamen.
    expect(zeitInZone(t, undefined, true)).toBe('14:00');
  });

  it('kann 12-Stunden-Anzeige', () => {
    expect(zeitInZone(t, 'America/New_York', false)).toMatch(/^0?8:00\s?AM$/i);
  });
});

describe('tagAmOrt', () => {
  it('nimmt den Kalendertag des ORTES, nicht den des Fernsehers', () => {
    // 23:30 Berliner Zeit am 8. August. In Jakarta ist es da bereits der 9.
    const spaetAbends = new Date(Date.UTC(2026, 7, 8, 21, 30, 0));
    expect(tagAmOrt(spaetAbends, 'Europe/Berlin').getDate()).toBe(8);
    expect(tagAmOrt(spaetAbends, 'Asia/Jakarta').getDate()).toBe(9);
  });

  it('nimmt auch den Tag DAVOR, wenn der Ort zurückliegt', () => {
    // 01:00 Berliner Zeit am 9. August ist in New York noch der 8.
    const nachMitternacht = new Date(Date.UTC(2026, 7, 8, 23, 0, 0));
    expect(tagAmOrt(nachMitternacht, 'Europe/Berlin').getDate()).toBe(9);
    expect(tagAmOrt(nachMitternacht, 'America/New_York').getDate()).toBe(8);
  });

  it('liefert ohne Zone den Gerätetag', () => {
    const t = new Date(2026, 7, 8, 15, 0, 0);
    expect(tagAmOrt(t, undefined).getDate()).toBe(8);
  });
});

describe('zoneWeichtAb', () => {
  const t = new Date(Date.UTC(2026, 7, 8, 12, 0, 0));

  it('meldet keine Abweichung, wenn Ort und Gerät dieselbe Zeit zeigen', () => {
    // Der Normalfall — ein Hinweis wäre hier nur Lärm.
    expect(zoneWeichtAb(t, 'Europe/Berlin')).toBe(false);
  });

  it('meldet die Abweichung bei einem Ort in einer anderen Zone', () => {
    expect(zoneWeichtAb(t, 'Asia/Riyadh')).toBe(true);
  });

  it('meldet keine Abweichung ohne Zone', () => {
    expect(zoneWeichtAb(t, undefined)).toBe(false);
  });
});
