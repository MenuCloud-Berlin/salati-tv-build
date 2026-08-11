import {
  DEFAULT_LOCATION,
  LEGACY_METHOD_IDS,
  METHOD_IDS,
  METHOD_LABELS,
  countdownUnits,
  fmtCountdown,
  fmtTime,
  isMethodId,
  nextPrayer,
  timesFor,
  toMethodId,
  type TvLocation,
} from '@/lib/prayerTimes';
import { translate } from '@/lib/i18n';
import { SUPPORTED_LOCALES } from '@/lib/locale';

const BERLIN: TvLocation = {
  lat: 52.52,
  lon: 13.405,
  label: 'Berlin',
  method: 3, // Muslim World League
  madhab: 'shafi',
};

describe('fmtTime', () => {
  it('polstert im 24h-Format zweistellig', () => {
    expect(fmtTime(new Date(2026, 6, 28, 5, 4), true)).toBe('05:04');
    expect(fmtTime(new Date(2026, 6, 28, 23, 59), true)).toBe('23:59');
  });

  // 12h-Randfaelle: 00:xx muss "12:xx AM" ergeben (h % 12 || 12), nicht "0:xx".
  it('bildet Mitternacht und Mittag im 12h-Format korrekt ab', () => {
    expect(fmtTime(new Date(2026, 6, 28, 0, 7), false)).toBe('12:07 AM');
    expect(fmtTime(new Date(2026, 6, 28, 12, 0), false)).toBe('12:00 PM');
    expect(fmtTime(new Date(2026, 6, 28, 13, 5), false)).toBe('1:05 PM');
  });
});

describe('fmtCountdown', () => {
  // Einheiten kommen seit dem Audit 2026-07-28 (T17) aus der Sprache. Hier
  // stehen sie fest, damit die Formatierung geprueft wird und nicht die
  // Uebersetzung — die deckt der Sprach-Block weiter unten ab.
  const en = { hours: 'h', minutes: 'm', seconds: 's' };

  it('zeigt unter einer Stunde Minuten + Sekunden, darueber Stunden + Minuten', () => {
    expect(fmtCountdown(90_000, en)).toBe('1m 30s');
    expect(fmtCountdown(3 * 3600_000 + 4 * 60_000, en)).toBe('3h 4m');
  });

  // Der Clock-Screen pollt sekuendlich; eine minimal negative Differenz darf
  // niemals "-1m -1s" anzeigen.
  it('klemmt negative Werte auf 0', () => {
    expect(fmtCountdown(-5000, en)).toBe('0m 00s');
  });
});

describe('Countdown-Einheiten je Sprache (T17)', () => {
  it('setzt die Einheiten der Oberflaechensprache ein', () => {
    expect(countdownUnits((k) => translate('de', k))).toEqual({
      hours: 'h',
      minutes: 'min',
      seconds: 's',
    });
  });

  it('zeigt in Arabisch arabische Einheiten — der eigentliche Befund', () => {
    // Am Fernseher stand „بعد 1h 55m": lateinische Einheiten mitten im
    // arabischen Satz.
    const ar = countdownUnits((k) => translate('ar', k));
    const out = fmtCountdown(1 * 3600_000 + 55 * 60_000, ar);
    expect(out).toBe('1س 55د');
    expect(out).not.toMatch(/[A-Za-z]/);
    // Zahl und Einheit haengen zusammen (logische Reihenfolge Zahl → Einheit);
    // der Bidi-Algorithmus dreht die Gruppen im RTL-Absatz, gelesen beginnt es
    // also mit den Stunden.
    for (const group of out.split(' ')) expect(group).toMatch(/^\d+\p{Script=Arabic}+$/u);
    // Der ganze Satz enthaelt keine lateinische Einheit mehr.
    expect(translate('ar', 'clock.timeLeft', { time: out })).not.toMatch(/[A-Za-z]/);
  });

  it.each(SUPPORTED_LOCALES)('%s hat alle drei Einheiten ohne Schluessel-Rueckfall', (locale) => {
    const u = countdownUnits((k) => translate(locale, k));
    for (const value of Object.values(u)) {
      expect(value.trim()).not.toBe('');
      expect(value).not.toContain('time.');
      expect(value.length).toBeLessThanOrEqual(4);
    }
  });

  it('nutzt in ar/fa/ur/ps keine lateinischen Einheiten', () => {
    for (const locale of ['ar', 'fa', 'ur', 'ps'] as const) {
      const u = countdownUnits((k) => translate(locale, k));
      for (const value of Object.values(u)) expect(value).not.toMatch(/[A-Za-z]/);
    }
  });
});

describe('timesFor', () => {
  it('liefert alle sechs Zeiten in aufsteigender Reihenfolge', () => {
    const t = timesFor(BERLIN, new Date(2026, 6, 28, 12, 0));
    const order = [t.fajr, t.sunrise, t.dhuhr, t.asr, t.maghrib, t.isha].map((d) => d.getTime());
    expect(order.every((v, i) => i === 0 || v > order[i - 1])).toBe(true);
  });

  it('macht Hanafi-Asr spaeter als Shafi-Asr', () => {
    const day = new Date(2026, 6, 28, 12, 0);
    const shafi = timesFor(BERLIN, day).asr.getTime();
    const hanafi = timesFor({ ...BERLIN, madhab: 'hanafi' }, day).asr.getTime();
    expect(hanafi).toBeGreaterThan(shafi);
  });

  // Ein aus dem Speicher geladener Alt-Wert darf die Uhr nicht sprengen: eine
  // unbekannte Methode landet auf der Vorgabe (13 = Diyanet), nicht auf einer
  // Ausnahme.
  it('faellt bei unbekannter Methode auf die Vorgabe zurueck statt zu werfen', () => {
    const broken = { ...BERLIN, method: 'GibtEsNicht' } as unknown as TvLocation;
    const fallback = timesFor(broken, new Date(2026, 6, 28, 12, 0));
    const diyanet = timesFor({ ...BERLIN, method: 13 }, new Date(2026, 6, 28, 12, 0));
    expect(fallback.fajr.getTime()).toBe(diyanet.fajr.getTime());
  });

  // Die angezeigte Minute ist die gerechnete Minute — der Countdown zaehlt auf
  // genau den Zeitpunkt, der in der Reihe steht (vorher trugen die Dates noch
  // Sekunden, die Anzeige rundete ab, der Countdown lief bis zu 59 s laenger).
  it('liefert auf volle Minuten gerundete Zeitpunkte', () => {
    const t = timesFor(BERLIN, new Date(2026, 6, 28, 12, 0));
    for (const d of [t.fajr, t.sunrise, t.dhuhr, t.asr, t.maghrib, t.isha]) {
      expect(d.getSeconds()).toBe(0);
      expect(d.getMilliseconds()).toBe(0);
    }
  });
});

describe('Methoden-Katalog', () => {
  // Der Kern des Audits 2026-07-29: beide Apps bieten dieselben Methoden an.
  it('deckt alle Behoerden der Handy-App in derselben Reihenfolge ab', () => {
    // Reihenfolge woertlich aus apps/mobile/src/features/settings/methods.ts
    // (Spiegelkopie: src/lib/methods.ts, geprueft in methods.parity.test.ts).
    // Diyanet steht vorn — es ist die Vorgabe beider Apps.
    expect(METHOD_IDS).toEqual([13, 3, 15, 2, 12, 22, 14, 4, 8, 16, 9, 10, 23, 7, 0, 5, 21, 19, 18, 1, 20, 17, 11]);
    for (const id of METHOD_IDS) expect(METHOD_LABELS[id]).toBeTruthy();
    expect(Object.keys(METHOD_LABELS)).toHaveLength(METHOD_IDS.length);
  });

  it('erkennt gueltige IDs und weist alles andere ab', () => {
    expect(isMethodId(13)).toBe(true);
    expect(isMethodId(7)).toBe(true); // Teheran — seit dem Behoerden-Katalog dabei
    expect(isMethodId(99)).toBe(false); // Aladhans "Custom" bringt keine Parameter mit
    expect(isMethodId('13')).toBe(false);
  });

  // Migration: gespeicherte Einstellungen aus Versionen vor dem Audit tragen
  // adhan-js-Namen. Ohne Umschreibung rechnete die Uhr still mit der Vorgabe.
  it('schreibt alte adhan-Namen auf Aladhan-IDs um', () => {
    expect(toMethodId('UmmAlQura')).toBe(4);
    expect(toMethodId('Turkey')).toBe(13);
    // Vorher Ersatzmethoden (8 bzw. 3), weil der Katalog nur 13 Methoden kannte.
    expect(toMethodId('Dubai')).toBe(16);
    expect(toMethodId('Tehran')).toBe(7);
    expect(toMethodId(undefined)).toBe(13);
    expect(toMethodId(99)).toBe(13);
    for (const id of Object.values(LEGACY_METHOD_IDS)) expect(METHOD_IDS).toContain(id);
  });
});

describe('nextPrayer', () => {
  it('ueberspringt den Sonnenaufgang (kein Pflichtgebet)', () => {
    const day = new Date(2026, 6, 28, 12, 0);
    const t = timesFor(BERLIN, day);
    // Kurz nach Fajr, aber vor Sonnenaufgang: naechstes Pflichtgebet ist Dhuhr.
    const afterFajr = new Date(t.fajr.getTime() + 60_000);
    expect(nextPrayer(BERLIN, afterFajr).key).toBe('dhuhr');
  });

  // Bewusst Makkah statt Berlin: in Berlin liegt Isha im Hochsommer NACH
  // Mitternacht, „eine Minute nach Isha" faellt dort schon auf den Folgetag und
  // das naechste Gebet ist korrekt der Fajr DIESES Kalendertages (tomorrow
  // false). Der tomorrow-Pfad ist nur pruefbar, wo Isha vor Mitternacht liegt.
  it('liefert nach Isha den Fajr von morgen mit tomorrow=true', () => {
    const day = new Date(2026, 6, 28, 12, 0);
    const t = timesFor(DEFAULT_LOCATION, day);
    expect(t.isha.getDate()).toBe(28); // Vorbedingung: Isha noch am selben Tag
    const afterIsha = new Date(t.isha.getTime() + 60_000);
    const next = nextPrayer(DEFAULT_LOCATION, afterIsha);
    expect(next.key).toBe('fajr');
    expect(next.tomorrow).toBe(true);
    expect(next.at.getTime()).toBeGreaterThan(afterIsha.getTime());
  });

  it('gibt immer eine positive Restzeit zurueck', () => {
    for (const h of [0, 5, 9, 13, 17, 21, 23]) {
      const now = new Date(2026, 6, 28, h, 30);
      expect(nextPrayer(BERLIN, now).diffMs).toBeGreaterThan(0);
    }
  });

  it('funktioniert auch mit dem Default-Standort Makkah', () => {
    expect(nextPrayer(DEFAULT_LOCATION, new Date(2026, 6, 28, 12, 0)).diffMs).toBeGreaterThan(0);
  });
});
