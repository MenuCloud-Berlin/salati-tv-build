// On-Device-Gebetszeitenberechnung mit `adhan` — KEIN API-Aufruf, funktioniert
// offline. Damit läuft die TV-Gebetsuhr auch ohne Internet (kritischer Punkt
// aus dem Masterplan §12.A).
//
// GLEICHHEIT MIT DER HANDY-APP (Audit 2026-07-29, P1) — der eigentliche Zweck
// dieser Datei:
//
// Diese Datei war eine ZWEITE, eigenständige Implementierung neben
// `apps/mobile/src/features/prayer-times/calc.ts`. Sie sprach adhan-js-
// Methodennamen ("UmmAlQura"), das Handy Aladhan-Methoden-IDs (13 = Diyanet),
// und sie setzte GAR KEINE Hochbreiten-Regel — adhan-js fällt dann auf
// `MiddleOfTheNight` zurück, während das Handy oberhalb von |48|° die
// winkelbasierte Regel benutzt. Für Berlin im Sommer sind das über eine Stunde
// Unterschied bei Fadschr und Ischa; auf demselben Sofa zeigten Fernseher und
// Handy verschiedene Zeiten.
//
// Die Rechenkette ist deshalb jetzt Schritt für Schritt aus `calc.ts`
// übernommen: Methoden-Parameter aus dem Behörden-Katalog (`lib/methods.ts`,
// Spiegelkopie der Handy-Datei), Madhab, Hochbreiten-Regel über
// `Math.abs(lat)`, Polarkreis-Auflösung, Asr-Kappung und das Minuten-Runden
// inklusive Dhuhr-Aufrundung. Belegt wird die Gleichheit durch die Tabelle in
// `prayerTimes.parity.test.ts` (6 Städte × 4 Termine, Sollwerte aus der
// Handy-App erzeugt).
//
// EIN struktureller Unterschied bleibt und ist keine Abweichung im Ergebnis:
// das Handy liefert "HH:MM"-Zeichenketten (Aladhan-Format), der Fernseher
// braucht `Date`-Objekte für Countdown und „nächstes Gebet". Die Dates sind
// deshalb bereits auf die angezeigte Minute gerundet — `fmtTime()` gibt damit
// exakt dieselbe Zeichenkette aus wie die Handy-App, und der Countdown zählt
// auf die ANGEZEIGTE Minute statt auf einen um Sekunden abweichenden Rohwert.
import {
  CalculationMethod,
  CalculationParameters,
  Coordinates,
  HighLatitudeRule,
  Madhab,
  PolarCircleResolution,
  PrayerTimes,
  Rounding,
} from 'adhan';

import { DEFAULT_METHOD_ID, PRAYER_METHODS, methodById } from '@/lib/methods';

export type PrayerKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export const PRAYER_KEYS: PrayerKey[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

/**
 * Aladhan-Methoden-ID — dieselbe Sprache wie die Handy-App
 * (`apps/mobile/src/features/settings/methods.ts`). Reihenfolge wörtlich von
 * dort übernommen, damit beide Apps dieselbe Liste in derselben Ordnung
 * anbieten; `METHODS.test` in der Handy-App und `prayerTimes.test.ts` hier
 * prüfen das gegeneinander.
 */
export type MethodId = number;

export const METHOD_IDS: MethodId[] = PRAYER_METHODS.map((m) => m.id);

/**
 * Anzeigenamen der Methoden. Bewusst NICHT übersetzt: es sind Eigennamen von
 * Institutionen („Diyanet İşleri Başkanlığı", „Umm al-Qura University"), die in
 * jeder Sprache so heißen — die Handy-App zeigt dieselbe Liste ebenfalls
 * unübersetzt an.
 *
 * Auf dem Fernseher steht der Kurzname: die Kacheln sind zwei Zeilen hoch, und
 * „Ministère des Habous et des Affaires Islamiques, Maroc" wäre dort abgeschnitten.
 */
export const METHOD_LABELS: Record<MethodId, string> = Object.fromEntries(
  PRAYER_METHODS.map((m) => [m.id, m.shortName]),
);

/** Vollständiger Behördenname — für die Zeile unter der aktiven Auswahl. */
export const METHOD_FULL_NAMES: Record<MethodId, string> = Object.fromEntries(
  PRAYER_METHODS.map((m) => [m.id, m.name]),
);

export function isMethodId(v: unknown): v is MethodId {
  return typeof v === 'number' && (METHOD_IDS as number[]).includes(v);
}

/**
 * Migration der Einstellungen, die VOR diesem Audit gespeichert wurden: dort
 * steht ein adhan-js-Methodenname statt einer Aladhan-ID.
 *
 * `Dubai` und `Tehran` wurden früher auf Ersatzmethoden abgebildet, weil der
 * Katalog sie nicht kannte. Seit er alle Behörden der Aladhan-API führt, zeigen
 * sie auf ihre echten IDs (16 bzw. 7) — betroffene Installationen bekommen
 * damit erstmals die Zeiten, die sie ursprünglich eingestellt hatten.
 */
export const LEGACY_METHOD_IDS: Record<string, MethodId> = {
  Karachi: 1,
  NorthAmerica: 2,
  MuslimWorldLeague: 3,
  UmmAlQura: 4,
  Egyptian: 5,
  Dubai: 16,
  Kuwait: 9,
  Qatar: 10,
  Singapore: 11,
  Turkey: 13,
  Tehran: 7,
  MoonsightingCommittee: 15,
  Other: 3,
};

/** Nimmt einen gespeicherten Wert (ID oder Alt-Name) und liefert eine gültige ID. */
export function toMethodId(value: unknown): MethodId {
  if (isMethodId(value)) return value;
  if (typeof value === 'string' && value in LEGACY_METHOD_IDS) return LEGACY_METHOD_IDS[value];
  return DEFAULT_METHOD;
}

/** Diyanet — dieselbe Vorgabe wie in der Handy-App (`DEFAULT_SETTINGS.method`). */
export const DEFAULT_METHOD: MethodId = DEFAULT_METHOD_ID;

/**
 * Hochbreiten-Regel, Werte wörtlich wie in der Handy-App
 * (`apps/mobile/src/features/settings/types.ts`).
 */
export type HighLatitudeSetting = 'auto' | 'middleOfNight' | 'seventhOfNight' | 'twilightAngle';
export const HIGH_LATITUDE_SETTINGS: HighLatitudeSetting[] = [
  'auto',
  'middleOfNight',
  'seventhOfNight',
  'twilightAngle',
];

export function isHighLatitudeSetting(v: unknown): v is HighLatitudeSetting {
  return typeof v === 'string' && (HIGH_LATITUDE_SETTINGS as string[]).includes(v);
}

/** Manuelle Minuten-Korrektur je Gebet („tune"), wie in der Handy-App. */
export interface PrayerTimeOffsets {
  fajr: number;
  sunrise: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
}

export const NO_PRAYER_TIME_OFFSETS: PrayerTimeOffsets = {
  fajr: 0,
  sunrise: 0,
  dhuhr: 0,
  asr: 0,
  maghrib: 0,
  isha: 0,
};

/** Grenzen wie in der Handy-App (`PRAYER_TIME_OFFSET_MIN/MAX`). */
export const PRAYER_TIME_OFFSET_MIN = -60;
export const PRAYER_TIME_OFFSET_MAX = 60;

export function clampOffset(minutes: number): number {
  if (!Number.isFinite(minutes)) return 0;
  return Math.min(PRAYER_TIME_OFFSET_MAX, Math.max(PRAYER_TIME_OFFSET_MIN, Math.round(minutes)));
}

export interface TvLocation {
  lat: number;
  lon: number;
  /**
   * IANA-Zeitzone des Ortes, sofern bekannt (Staedte aus `data/cities.ts`
   * tragen sie immer). Fehlt sie — GPS-Standort vom Handy, alte gespeicherte
   * Einstellung —, wird in Geraetezeit angezeigt wie bisher.
   */
  tz?: string;
  /**
   * Anzeigename. Bei einer Stadt aus `data/cities.ts` nur noch der Rückfall —
   * angezeigt wird dann der Name in der App-Sprache (`cityId`). Kommt der
   * Standort per GPS vom gekoppelten Handy, ist das hier der einzige Name.
   */
  label: string;
  /**
   * Schlüssel der Voreinstellungs-Stadt (Audit 2026-07-28, T16). Fehlt bei
   * GPS-Standorten und bei Einstellungen, die vor dem Audit gespeichert wurden.
   */
  cityId?: string;
  /** Aladhan-Methoden-ID — dieselbe Kennung wie in der Handy-App. */
  method: MethodId;
  madhab: 'shafi' | 'hanafi';
}

/**
 * Vorgabe-Standort. Bis zum Audit 2026-07-29 war das Makkah/Umm al-Qura,
 * während die Handy-App mit Berlin/Diyanet startet — zwei Apps desselben
 * Hauses zeigten auf demselben Sofa verschiedene Orte UND verschiedene
 * Methoden. Jetzt wörtlich `DEFAULT_SETTINGS.location`/`.method` der Handy-App;
 * der Fernseher-Stick wird in Deutschland verkauft, Berlin ist auch inhaltlich
 * die bessere Vorgabe als Makkah (dessen Zeiten in deutscher Zeitzone niemand
 * braucht).
 */
export const DEFAULT_LOCATION: TvLocation = {
  lat: 52.52,
  lon: 13.405,
  label: 'Berlin',
  cityId: 'berlin',
  tz: 'Europe/Berlin',
  method: DEFAULT_METHOD,
  madhab: 'shafi',
};

/**
 * Alle nutzer-einstellbaren Rechenparameter außerhalb des Ortes — gleiche
 * Aufteilung wie in der Handy-App (`PrayerCalcOptions`).
 */
export interface PrayerCalcExtras {
  highLatitude: HighLatitudeSetting;
  offsets: PrayerTimeOffsets;
}

export const DEFAULT_CALC_EXTRAS: PrayerCalcExtras = {
  highLatitude: 'auto',
  offsets: NO_PRAYER_TIME_OFFSETS,
};

/** Keine Minuten-Zuschläge — der Normalfall, s. {@link baseParams}. */
const KEINE_ZUSCHLAEGE = { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };

/**
 * Baut die adhan-js-Parameter aus dem Behörden-Katalog (`lib/methods.ts`) —
 * Zeile für Zeile wie `apps/mobile/src/features/prayer-times/calc.ts`. Die
 * Begründung der beiden Ausnahmen (13 Diyanet behält seine temkin-Zuschläge,
 * 15 Moonsighting braucht die Kurve der Bibliothek) und warum alle übrigen
 * Methoden über `Other()` statt über die adhan-js-Presets gebaut werden, steht
 * dort ausführlich.
 */
function baseParams(method: MethodId): CalculationParameters {
  if (method === 13) {
    const p = CalculationMethod.Turkey();
    p.rounding = Rounding.None;
    return p;
  }
  if (method === 15) {
    const p = CalculationMethod.MoonsightingCommittee();
    p.methodAdjustments = { ...KEINE_ZUSCHLAEGE };
    p.rounding = Rounding.None;
    return p;
  }

  const m = methodById(method) ?? methodById(DEFAULT_METHOD_ID);
  const p = CalculationMethod.Other();
  p.methodAdjustments = { ...KEINE_ZUSCHLAEGE };
  p.rounding = Rounding.None;
  if (!m) return p;

  p.fajrAngle = m.fajrAngle;
  if (m.isha.kind === 'angle') p.ishaAngle = m.isha.angle;
  else p.ishaInterval = m.isha.minutes;
  if (m.maghribAngle !== undefined) p.maghribAngle = m.maghribAngle;
  if (m.maghribMinutes !== undefined) p.methodAdjustments.maghrib = m.maghribMinutes;
  if (m.dhuhrMinutes !== undefined) p.methodAdjustments.dhuhr = m.dhuhrMinutes;
  return p;
}

/**
 * Ab dieser Breite greift überhaupt eine Hochbreiten-Regel. Anders als
 * `HighLatitudeRule.recommended()` auf den BETRAG angewandt: adhan-js prüft
 * `latitude > 48` und lässt die Südhalbkugel ungeschützt, obwohl Punta Arenas
 * (−53,2°) dasselbe Problem hat wie Berlin (+52,5°).
 */
const HOHE_BREITE_AB_GRAD = 48;

/**
 * Übersetzt die Einstellung in die adhan-js-Regel (`auto` = breitenabhängig).
 *
 * Wörtlich die Regel der Handy-App: oberhalb von |48|° winkelbasiert, darunter
 * Mitte der Nacht. NICHT auf `HighLatitudeRule.recommended()` ändern — das
 * lieferte die Siebtel-Regel und war dort die Ursache der Nutzermeldung
 * „Gebetszeiten stimmen nicht" (Berlin, Ischa 22:16). Die Begründung der
 * Auswahl steht ausführlich in `apps/mobile/src/features/prayer-times/calc.ts`.
 */
export function resolveHighLatitudeRule(
  setting: HighLatitudeSetting,
  lat: number,
): 'middleofthenight' | 'seventhofthenight' | 'twilightangle' {
  switch (setting) {
    case 'middleOfNight':
      return HighLatitudeRule.MiddleOfTheNight;
    case 'seventhOfNight':
      return HighLatitudeRule.SeventhOfTheNight;
    case 'twilightAngle':
      return HighLatitudeRule.TwilightAngle;
    case 'auto':
    default:
      return Math.abs(lat) > HOHE_BREITE_AB_GRAD
        ? HighLatitudeRule.TwilightAngle
        : HighLatitudeRule.MiddleOfTheNight;
  }
}

const MINUTE_MS = 60_000;

/**
 * Sekundengenaue Zeit auf die angezeigte Minute bringen — die Rundung, die in
 * der Handy-App `hhmm()` beim Formatieren macht. `up` nur für Dhuhr: die
 * angezeigte Minute darf nie vor dem Zenitdurchgang liegen (kaufmännisches
 * Runden könnte bis zu 29 s davor landen, in dieser Spanne ist das Gebet
 * ungültig).
 */
function snapToMinute(d: Date, mode: 'nearest' | 'up' = 'nearest'): Date {
  const ms = d.getTime();
  if (!Number.isFinite(ms)) return d;
  return new Date((mode === 'up' ? Math.ceil(ms / MINUTE_MS) : Math.round(ms / MINUTE_MS)) * MINUTE_MS);
}

/**
 * Der Asr-Zeitpunkt nach der Schattenregel existiert nicht an jedem Tag (im
 * Polarkreis im Winterhalbjahr wäre die Bedingung erst nach Sonnenuntergang
 * erfüllt, adhan-js liefert dann Werte außerhalb des Tages). Kappung auf den
 * Sonnenuntergang — identisch zur Handy-App, hält Dhuhr < Asr ≤ Maghrib ein.
 */
function asrWithinDay(times: PrayerTimes): Date {
  const ok = times.asr > times.dhuhr && times.asr <= times.sunset;
  return ok ? times.asr : times.sunset;
}

export interface DayTimes {
  fajr: Date;
  sunrise: Date;
  dhuhr: Date;
  asr: Date;
  maghrib: Date;
  isha: Date;
}

/**
 * Gebetszeiten eines Tages, auf die angezeigte Minute gerundet und mit der
 * Nutzer-Minuten-Korrektur — dieselbe Kette wie `computeTimings()` der
 * Handy-App.
 */
export function timesFor(
  loc: TvLocation,
  date: Date,
  extras: PrayerCalcExtras = DEFAULT_CALC_EXTRAS,
): DayTimes {
  const params = baseParams(toMethodId(loc.method));
  params.madhab = loc.madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  params.highLatitudeRule = resolveHighLatitudeRule(extras.highLatitude, loc.lat);
  // Innerhalb der Polarkreise gibt es Tage ohne Sonnenauf-/untergang; ohne
  // Auflösung liefert adhan-js dort `Invalid Date` und die Uhr zeigte
  // „NaN:NaN". AqrabYaum nimmt das nächstgelegene berechenbare Datum — wie in
  // der Handy-App.
  params.polarCircleResolution = PolarCircleResolution.AqrabYaum;

  const t = new PrayerTimes(new Coordinates(loc.lat, loc.lon), date, params);
  const o = extras.offsets;
  return {
    fajr: shift(snapToMinute(t.fajr), o.fajr),
    sunrise: shift(snapToMinute(t.sunrise), o.sunrise),
    dhuhr: shift(snapToMinute(t.dhuhr, 'up'), o.dhuhr),
    asr: shift(snapToMinute(asrWithinDay(t)), o.asr),
    maghrib: shift(snapToMinute(t.maghrib), o.maghrib),
    isha: shift(snapToMinute(t.isha), o.isha),
  };
}

function shift(d: Date, minutes: number): Date {
  const m = clampOffset(minutes);
  return m === 0 ? d : new Date(d.getTime() + m * MINUTE_MS);
}

export interface NextPrayer {
  key: PrayerKey;
  at: Date;
  /** Millisekunden bis zum nächsten Gebet (immer > 0). */
  diffMs: number;
  /** true, wenn das nächste Gebet erst morgen ist (nach Isha). */
  tomorrow: boolean;
}

const ADHAN_PRAYERS: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

/** Nächstes der fünf Pflichtgebete ab `now` (Sonnenaufgang zählt nicht). */
export function nextPrayer(
  loc: TvLocation,
  now: Date,
  extras: PrayerCalcExtras = DEFAULT_CALC_EXTRAS,
): NextPrayer {
  const today = timesFor(loc, now, extras);
  for (const key of ADHAN_PRAYERS) {
    const at = today[key];
    if (at.getTime() > now.getTime()) {
      return { key, at, diffMs: at.getTime() - now.getTime(), tomorrow: false };
    }
  }
  // Alle heutigen vorbei → Fajr morgen.
  const tmr = new Date(now);
  tmr.setDate(tmr.getDate() + 1);
  const at = timesFor(loc, tmr, extras).fajr;
  return { key: 'fajr', at, diffMs: at.getTime() - now.getTime(), tomorrow: true };
}

export function fmtTime(d: Date, is24h = true): string {
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  if (is24h) return `${h.toString().padStart(2, '0')}:${m}`;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

/**
 * Kurzformen der Zeiteinheiten (Audit 2026-07-28, T17).
 *
 * Vorher standen `h`/`m`/`s` fest im Code — auf dem Fernseher las sich das als
 * „بعد 1h 55m", also lateinische Einheiten mitten im arabischen Satz. Die
 * Handy-App hatte denselben Fehler; beide ziehen die Werte jetzt aus denselben
 * Locale-Schlüsseln `time.*`, deren Übereinstimmung `src/lib/i18n.test.ts`
 * gegen `apps/mobile/src/locales` prüft.
 */
export interface CountdownUnits {
  hours: string;
  minutes: string;
  seconds: string;
}

/** Locale-Schlüssel der drei Einheiten — identisch in Handy- und TV-App. */
export const COUNTDOWN_UNIT_KEYS = {
  hours: 'time.hoursShort',
  minutes: 'time.minutesShort',
  seconds: 'time.secondsShort',
} as const;

/** Baut die Einheiten aus der aktiven Sprache (`t` aus `useTranslation`). */
export function countdownUnits(t: (key: string) => string): CountdownUnits {
  return {
    hours: t(COUNTDOWN_UNIT_KEYS.hours),
    minutes: t(COUNTDOWN_UNIT_KEYS.minutes),
    seconds: t(COUNTDOWN_UNIT_KEYS.seconds),
  };
}

/**
 * Restzeit bis zum nächsten Gebet: über einer Stunde „3h 4min", darunter
 * „1min 30s".
 *
 * `units` ist bewusst ein Pflichtargument — ein Standardwert `h/m/s` hätte die
 * Übersetzung an jeder vergessenen Aufrufstelle still wieder ausgehebelt.
 *
 * Zahl und Einheit stehen ohne Trennzeichen zusammen, die Gruppen durch ein
 * Leerzeichen getrennt. Diese logische Reihenfolge (Zahl → Einheit) gilt auch
 * für ar/fa/ur/ps: der Bidi-Algorithmus stellt die Gruppen im rechtsläufigen
 * Absatz von rechts nach links, „٣س ٤د" beginnt gelesen also mit den Stunden.
 */
export function fmtCountdown(ms: number, units: CountdownUnits): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}${units.hours} ${m}${units.minutes}`;
  const s = total % 60;
  return `${m}${units.minutes} ${s.toString().padStart(2, '0')}${units.seconds}`;
}
