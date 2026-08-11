import {
  AZAN_AUS,
  AZAN_CHOICES,
  AZAN_LIZENZEN,
  AZAN_PRAYERS,
  AZAN_VORSCHLAG,
  azanAktiv,
  azanNummer,
  azanQuelle,
  istAzanGebet,
  normalizeAzan,
} from '@/lib/azan';
import { faelligerRuf, MAX_VERZUG_MS } from '@/lib/azanRuf';
import { PRAYER_KEYS, type DayTimes } from '@/lib/prayerTimes';

jest.mock('expo-video', () => ({ createVideoPlayer: jest.fn() }));

// Der Gebetsruf ist die einzige Funktion der TV-App, die von selbst laut wird.
// Entsprechend liegt der Schwerpunkt dieser Tests auf dem, was NICHT passieren
// darf: kein Ruf ohne Wahl, keiner zweimal, keiner nachgeholt, keiner zum
// Sonnenaufgang.

describe('Katalog', () => {
  it('liefert fuer jede Aufnahme eine Quelle und fuer „aus" keine', () => {
    expect(azanQuelle('aus')).toBeNull();
    for (const c of AZAN_CHOICES) {
      if (c === 'aus') continue;
      expect(azanQuelle(c)).not.toBeNull();
    }
  });

  it('nummeriert die Aufnahmen ab 1 und in Katalogreihenfolge', () => {
    expect(azanNummer('adhan1')).toBe(1);
    expect(azanNummer('adhan2')).toBe(2);
    expect(azanNummer('fajr')).toBe(3);
  });

  it('kennt den Sonnenaufgang nicht als Gebet', () => {
    expect(istAzanGebet('sunrise')).toBe(false);
    // Alle uebrigen Gebete der Uhr muessen einen Ruf bekommen koennen — sonst
    // fiele ein Gebet stillschweigend aus der Liste.
    for (const k of PRAYER_KEYS) {
      if (k === 'sunrise') continue;
      expect(istAzanGebet(k)).toBe(true);
    }
  });

  it('ist im Auslieferungszustand ueberall aus', () => {
    expect(azanAktiv(AZAN_AUS)).toBe(false);
    expect(azanAktiv(AZAN_VORSCHLAG)).toBe(true);
  });

  it('gibt Fadschr im Vorschlag die Aufnahme mit Tathwib', () => {
    expect(AZAN_VORSCHLAG.fajr).toBe('fajr');
    for (const p of AZAN_PRAYERS) {
      if (p === 'fajr') continue;
      expect(AZAN_VORSCHLAG[p]).not.toBe('fajr');
    }
  });

  it('nennt jede Aufnahme mit Urheber, Lizenz und Quelle', () => {
    expect(AZAN_LIZENZEN).toHaveLength(AZAN_CHOICES.length - 1);
    for (const l of AZAN_LIZENZEN) {
      expect(l.urheber.length).toBeGreaterThan(0);
      expect(l.lizenz).toMatch(/^CC/);
      expect(l.quelle).toContain('wikimedia.org');
    }
  });
});

describe('normalizeAzan', () => {
  it('faellt bei Unsinn auf „alles aus" zurueck', () => {
    expect(normalizeAzan(null)).toEqual(AZAN_AUS);
    expect(normalizeAzan('adhan1')).toEqual(AZAN_AUS);
    expect(normalizeAzan(42)).toEqual(AZAN_AUS);
  });

  it('uebernimmt gueltige Werte und verwirft unbekannte einzeln', () => {
    // Ein unbekannter Wert darf NUR sein eigenes Gebet stumm schalten, nicht
    // die ganze Einstellung zuruecksetzen.
    const r = normalizeAzan({ fajr: 'fajr', dhuhr: 'adhan9', asr: 'adhan2' });
    expect(r.fajr).toBe('fajr');
    expect(r.dhuhr).toBe('aus');
    expect(r.asr).toBe('adhan2');
  });

  it('ignoriert den Sonnenaufgang, auch wenn er gespeichert wurde', () => {
    const r = normalizeAzan({ sunrise: 'adhan1' }) as Record<string, string>;
    expect(r.sunrise).toBeUndefined();
  });
});

/** Gebetszeiten eines Tages aus Uhrzeiten bauen (Testhilfe). */
function tag(werte: Record<string, string>): DayTimes {
  const bau = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return new Date(2026, 7, 8, h, m, 0, 0);
  };
  return {
    fajr: bau(werte.fajr ?? '03:20'),
    sunrise: bau(werte.sunrise ?? '05:40'),
    dhuhr: bau(werte.dhuhr ?? '13:15'),
    asr: bau(werte.asr ?? '17:10'),
    maghrib: bau(werte.maghrib ?? '20:45'),
    isha: bau(werte.isha ?? '22:30'),
  };
}

describe('faelligerRuf', () => {
  const times = tag({});
  const dhuhr = times.dhuhr.getTime();
  const alleAn = { fajr: 'fajr', dhuhr: 'adhan1', asr: 'adhan1', maghrib: 'adhan1', isha: 'adhan1' } as const;

  it('meldet das Gebet, dessen Zeit im Fenster liegt', () => {
    const r = faelligerRuf(times, alleAn, dhuhr - 10_000, dhuhr + 1_000);
    expect(r?.prayer).toBe('dhuhr');
    expect(r?.choice).toBe('adhan1');
  });

  it('meldet dasselbe Gebet kein zweites Mal', () => {
    // Zweiter Takt: das Fenster beginnt dort, wo das erste endete.
    expect(faelligerRuf(times, alleAn, dhuhr + 1_000, dhuhr + 11_000)).toBeNull();
  });

  it('schweigt bei „aus"', () => {
    expect(faelligerRuf(times, AZAN_AUS, dhuhr - 10_000, dhuhr + 1_000)).toBeNull();
  });

  it('holt einen laengst vergangenen Ruf NICHT nach', () => {
    // Der Fernseher war stundenlang eingefroren: das Fenster umfasst Dhuhr,
    // aber die Zeit ist zu lange her.
    const spaet = dhuhr + MAX_VERZUG_MS + 1;
    expect(faelligerRuf(times, alleAn, dhuhr - 10_000, spaet)).toBeNull();
    // Eine Sekunde vor der Grenze ruft er noch.
    expect(faelligerRuf(times, alleAn, dhuhr - 10_000, dhuhr + MAX_VERZUG_MS - 1_000)?.prayer).toBe('dhuhr');
  });

  it('ruft nie zum Sonnenaufgang', () => {
    const sr = times.sunrise.getTime();
    expect(faelligerRuf(times, alleAn, sr - 10_000, sr + 1_000)).toBeNull();
  });

  it('nimmt bei mehreren im Fenster das spaeteste Gebet', () => {
    // Zeitsprung ueber Asr und Maghrib hinweg: der Ruf, der jetzt gerade dran
    // waere, ist Maghrib — nicht der von vor drei Stunden.
    const eng = tag({ asr: '20:44', maghrib: '20:45' });
    const jetzt = eng.maghrib.getTime() + 1_000;
    expect(faelligerRuf(eng, alleAn, eng.asr.getTime() - 1_000, jetzt)?.prayer).toBe('maghrib');
  });

  it('ruft nur fuer die Gebete, die eingeschaltet sind', () => {
    const nurMaghrib = { ...AZAN_AUS, maghrib: 'adhan2' as const };
    expect(faelligerRuf(times, nurMaghrib, dhuhr - 10_000, dhuhr + 1_000)).toBeNull();
    const mg = times.maghrib.getTime();
    expect(faelligerRuf(times, nurMaghrib, mg - 10_000, mg + 1_000)?.choice).toBe('adhan2');
  });
});
