import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  AZAN_AUS,
  normalizeAzan,
  type AzanChoice,
  type AzanPerPrayer,
  type AzanPrayer,
} from '@/lib/azan';
import { detectDeviceLocale, SUPPORTED_LOCALES, type Locale } from '@/lib/locale';
import {
  DEFAULT_QURAN_FONT,
  QURAN_FONTS,
  type QuranFontId,
  type SukunStil,
} from '@/lib/quranFonts';
import { DEFAULT_THEME_ID, isThemeId, istAkzentId, type AkzentId, type ThemeId } from '@/lib/theme';
import { istHintergrundId, type HintergrundId } from '@/lib/hintergruende';

import {
  clampOffset,
  DEFAULT_CALC_EXTRAS,
  DEFAULT_LOCATION,
  isHighLatitudeSetting,
  NO_PRAYER_TIME_OFFSETS,
  toMethodId,
  type HighLatitudeSetting,
  type PrayerCalcExtras,
  type PrayerKey,
  type PrayerTimeOffsets,
  type TvLocation,
} from '@/lib/prayerTimes';

/**
 * Wartezeiten fuer das Ausblenden der Bedienhinweise, in SEKUNDEN.
 * 0 heisst „nie". Bewusst wenige, weite Stufen statt eines Schiebereglers: mit
 * der Fernbedienung ist jede Zwischenstufe ein weiterer Tastendruck, und
 * zwischen 10 und 30 Sekunden liegt der ganze Unterschied.
 */
export const AUSBLEND_ZEITEN = [0, 10, 30] as const;
export type AusblendZeit = (typeof AUSBLEND_ZEITEN)[number];

export function istAusblendZeit(v: unknown): v is AusblendZeit {
  return typeof v === 'number' && (AUSBLEND_ZEITEN as readonly number[]).includes(v);
}

// Persistente TV-Einstellungen (Standort, Madhab, Zeitformat, Sprache). Ein
// winziger Store mit useSyncExternalStore statt Context — Standort/Zeitformat
// werden von mehreren Screens (Clock, Settings) gelesen und müssen synchron
// aktualisieren. Persistenz via AsyncStorage; beim Start einmal aus dem
// Speicher geladen. Später überschreibt die Handy-Kopplung denselben Store
// (setLocation).

export interface TvSettings {
  location: TvLocation;
  is24h: boolean;
  /** App-Sprache (Audit 2026-07-28, T13). Vorbelegt aus der Geraete-Sprache. */
  language: Locale;
  /**
   * Hochbreiten-Regel fuer Fadschr/Ischa (Audit 2026-07-29, P1). Die TV-App
   * setzte gar keine — adhan-js faellt dann auf „Mitte der Nacht" zurueck,
   * waehrend die Handy-App oberhalb von |48| Grad winkelbasiert rechnet. In
   * Berlin sind das im Sommer ueber eine Stunde Unterschied.
   */
  highLatitude: HighLatitudeSetting;
  /** Manuelle Minuten-Korrektur je Gebet — wie in der Handy-App. */
  offsets: PrayerTimeOffsets;
  /** Farbwelt der Oberflaeche (s. lib/theme.ts). */
  theme: ThemeId;
  /** Was hinter allen Bildschirmen liegt (s. components/Hintergrund.tsx).
   *  Gezeichnet (`ruhig`, `muster`, …) oder ein Motiv (`medium:<id>`). */
  hintergrund: HintergrundId;
  /**
   * Wie stark ein Foto- oder Video-Hintergrund abgedunkelt wird (0…1).
   *
   * Gilt NUR fuer Motive: ein Foto in voller Helligkeit macht die Uhrzeit
   * darauf unlesbar, waehrend die gezeichneten Hintergruende von sich aus
   * zurueckhaltend sind. Voreinstellung bewusst kraeftig — lieber zu ruhig als
   * unleserlich.
   */
  hintergrundDimmung: Dimmung;
  /** Foto-Hintergruende langsam wandern lassen (Systemeinstellung
   *  „Bewegung reduzieren" sticht). */
  fotoBewegung: boolean;
  /** Akzentfarbe unabhaengig von der Farbwelt (s. lib/theme.ts). */
  akzent: AkzentId;
  /** Ziffernblatt statt Ziffern auf dem Screensaver. */
  uhrStil: UhrStil;
  /** Strichstaerke der Uhrzeit. */
  uhrGewicht: UhrGewicht;
  /** Sekunden neben der Uhrzeit zeigen. */
  uhrSekunden: boolean;
  /**
   * Nach wie vielen Sekunden Ruhe die Bedienhinweise verschwinden.
   * 0 = nie (s. lib/bedienungSichtbar.ts).
   */
  bedienungAusblenden: AusblendZeit;
  /** Koran-Schrift des Lesers (Katalog wie in der Handy-App). */
  quranFont: QuranFontId;
  /** Sukun-Zeichen der KFGQPC-Schrift: Madina-Haken oder Kreis. */
  quranSukun: SukunStil;
  /**
   * Schriftgrad des Lesers als FAKTOR auf die berechnete Groesse, nicht als
   * fester dp-Wert: die Grundgroesse haengt schon an der Bildschirmhoehe
   * (s. readerStyles), ein fester Wert wuerde diese Anpassung wieder aushebeln.
   */
  readerScale: ReaderScale;
  /** Lateinische Umschrift unter dem Vers zeigen. */
  readerTranslit: boolean;
  /** Uebersetzung unter dem Vers zeigen. */
  readerTranslation: boolean;
  /**
   * Nach dem letzten Vers automatisch zur naechsten Sure weiterschalten.
   * Abschaltbar, weil ein Fernseher im Wohnzimmer sonst nach Sure 2 noch
   * stundenlang weiterlaeuft, ohne dass jemand darum gebeten hat.
   */
  readerAutoAdvance: boolean;
  /**
   * Gebetsruf je Gebet (s. lib/azan.ts). Standard: ueberall „aus" — ein
   * Fernseher, der nach einer Aktualisierung von selbst laut wird, waere ein
   * Uebergriff, kein Dienst.
   */
  azan: AzanPerPrayer;
  /** Lautstaerke des Gebetsrufs, 0,1 bis 1,0. */
  azanVolume: number;
  /** Groesse der Uhr auf dem Screensaver-Bildschirm, als Faktor (s. CLOCK_SCALES). */
  clockScale: ClockScale;
  /** Rotierenden Vers des Tages unter der Uhr zeigen (Datenquelle: Handy-App-Verspool). */
  versDesTagesAktiv: boolean;
  /** Freitags-Kennzeichnung auf dem Screensaver (rein visuell, keine eigene Zeitlogik). */
  jumuaModusAktiv: boolean;
  /** Temperatur-Anzeige auf dem Screensaver (Open-Meteo, kein Schluessel/Kosten). */
  wetterAktiv: boolean;
  loaded: boolean;
}

/** Waehlbare Schriftgrade des Lesers — dieselbe Staffelung wie die vier Stufen
 *  der Handy-App (`quranFontSize`), hier als Faktor statt als Name. */
export const READER_SCALES = [0.8, 1, 1.2, 1.45] as const;
export type ReaderScale = (typeof READER_SCALES)[number];
export const DEFAULT_READER_SCALE: ReaderScale = 1;

function isReaderScale(v: unknown): v is ReaderScale {
  return typeof v === 'number' && (READER_SCALES as readonly number[]).includes(v);
}

/**
 * Waehlbare Abdunkelungen eines Motiv-Hintergrunds.
 *
 * Vier weite Stufen statt eines Schiebereglers: mit der Fernbedienung ist jede
 * Zwischenstufe ein weiterer Tastendruck (dieselbe Ueberlegung wie bei
 * AUSBLEND_ZEITEN), und zwischen 25 % und 55 % liegt der ganze Unterschied.
 */
export const DIMMUNGEN = [0.15, 0.35, 0.55, 0.75] as const;
export type Dimmung = (typeof DIMMUNGEN)[number];
export const DEFAULT_DIMMUNG: Dimmung = 0.55;

function istDimmung(v: unknown): v is Dimmung {
  return typeof v === 'number' && (DIMMUNGEN as readonly number[]).includes(v);
}

/** Ziffern oder Ziffernblatt. */
export const UHR_STILE = ['digital', 'analog'] as const;
export type UhrStil = (typeof UHR_STILE)[number];

function istUhrStil(v: unknown): v is UhrStil {
  return typeof v === 'string' && (UHR_STILE as readonly string[]).includes(v);
}

/** Strichstaerke der Uhrzeit. Die Werte sind die tatsaechlichen
 *  Schriftschnitte — so steht die Zuordnung an EINER Stelle. */
export const UHR_GEWICHTE = ['leicht', 'normal', 'kraeftig'] as const;
export type UhrGewicht = (typeof UHR_GEWICHTE)[number];
export const UHR_GEWICHT_WERTE: Record<UhrGewicht, '200' | '400' | '700'> = {
  leicht: '200',
  normal: '400',
  kraeftig: '700',
};

function istUhrGewicht(v: unknown): v is UhrGewicht {
  return typeof v === 'string' && (UHR_GEWICHTE as readonly string[]).includes(v);
}

/** Waehlbare Groessen der Screensaver-Uhr — gleiches Stufen-Prinzip wie READER_SCALES. */
export const CLOCK_SCALES = [0.8, 1, 1.25, 1.5] as const;
export type ClockScale = (typeof CLOCK_SCALES)[number];
export const DEFAULT_CLOCK_SCALE: ClockScale = 1;

function isClockScale(v: unknown): v is ClockScale {
  return typeof v === 'number' && (CLOCK_SCALES as readonly number[]).includes(v);
}

function isQuranFontId(v: unknown): v is QuranFontId {
  return typeof v === 'string' && QURAN_FONTS.some((f) => f.id === v);
}

const KEY = 'salati-tv-settings-v1';

function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (SUPPORTED_LOCALES as string[]).includes(v);
}

let state: TvSettings = {
  location: DEFAULT_LOCATION,
  is24h: true,
  // Die Geraete-Sprache ist die beste Vermutung, solange nichts gespeichert
  // ist — sonst startet ein Fernseher in Kairo auf Deutsch.
  language: detectDeviceLocale(),
  highLatitude: DEFAULT_CALC_EXTRAS.highLatitude,
  offsets: NO_PRAYER_TIME_OFFSETS,
  theme: DEFAULT_THEME_ID,
  // Voreinstellung bleibt die ruhige Flaeche: wer den Fernseher als Uhr
  // laufen laesst, soll nicht ungefragt ein Muster bekommen.
  hintergrund: 'ruhig',
  hintergrundDimmung: DEFAULT_DIMMUNG,
  fotoBewegung: true,
  akzent: 'thema',
  uhrStil: 'digital',
  uhrGewicht: 'leicht',
  uhrSekunden: true,
  // Voreinstellung: nichts verschwindet. Wer die App kennt, schaltet es
  // ein; wer sie nicht kennt, soll die Bedienung nicht suchen muessen.
  bedienungAusblenden: 0,
  quranFont: DEFAULT_QURAN_FONT,
  quranSukun: 'madina',
  readerScale: DEFAULT_READER_SCALE,
  readerTranslit: true,
  readerTranslation: true,
  readerAutoAdvance: true,
  azan: AZAN_AUS,
  azanVolume: 1,
  clockScale: DEFAULT_CLOCK_SCALE,
  // Neue Bildschirminhalte bewusst opt-in, wie hintergrund/bedienungAusblenden
  // oben: niemand soll nach einem Update ungefragt neue Inhalte auf dem
  // Wohnzimmer-Fernseher sehen.
  versDesTagesAktiv: false,
  jumuaModusAktiv: false,
  wetterAktiv: false,
  loaded: false,
};

/**
 * Normalisiert einen gespeicherten Standort. Einstellungen aus Versionen vor
 * dem Audit 2026-07-29 tragen im Feld `method` einen adhan-js-NAMEN
 * („UmmAlQura") statt der Aladhan-ID — ohne diese Umschreibung faende
 * `baseParams()` die Methode nicht und rechnete still mit MWL weiter.
 */
export function normalizeLocation(raw: unknown): TvLocation {
  if (!raw || typeof raw !== 'object') return DEFAULT_LOCATION;
  const l = raw as Partial<TvLocation> & { method?: unknown };
  if (typeof l.lat !== 'number' || typeof l.lon !== 'number') return DEFAULT_LOCATION;
  return {
    lat: l.lat,
    lon: l.lon,
    label: typeof l.label === 'string' ? l.label : DEFAULT_LOCATION.label,
    cityId: typeof l.cityId === 'string' ? l.cityId : undefined,
    method: toMethodId(l.method),
    madhab: l.madhab === 'hanafi' ? 'hanafi' : 'shafi',
    // Zeitzone: gespeichert, sonst aus der Stadt nachgetragen. Einstellungen
    // aus Versionen vor 1.6.0 kennen das Feld nicht — ohne diesen Nachtrag
    // laesen sie ihre Zeiten weiter in der Zone des Fernsehers ab, obwohl die
    // Stadt eine eigene hat.
    tz: typeof l.tz === 'string' ? l.tz : zoneZurStadt(l.cityId),
  };
}

/** IANA-Zone einer Voreinstellungs-Stadt. Bewusst ein spaeter Import (im
 *  Funktionskoerper): `data/cities.ts` importiert Typen aus dieser Datei, ein
 *  Import oben schloesse den Kreis. */
function zoneZurStadt(cityId: unknown): string | undefined {
  if (typeof cityId !== 'string') return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- spaeter Import bricht den Kreis zu data/cities.ts
    const { CITIES } = require('@/data/cities') as { CITIES: { id: string; tz: string }[] };
    return CITIES.find((c) => c.id === cityId)?.tz;
  } catch {
    return undefined;
  }
}

/**
 * Lautstaerke des Gebetsrufs auf 0,1 bis 1,0 begrenzen.
 *
 * Die UNTERGRENZE ist Absicht: 0 waere ein Ruf, der aussieht als sei er an, und
 * stumm bleibt — wer ihn nicht hoeren will, stellt das Gebet auf „aus".
 */
export const AZAN_VOLUME_MIN = 0.1;
export function clampAzanVolume(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 1;
  return Math.max(AZAN_VOLUME_MIN, Math.min(1, Math.round(v * 10) / 10));
}

function normalizeOffsets(raw: unknown): PrayerTimeOffsets {
  if (!raw || typeof raw !== 'object') return NO_PRAYER_TIME_OFFSETS;
  const r = raw as Record<string, unknown>;
  const out = { ...NO_PRAYER_TIME_OFFSETS };
  for (const key of Object.keys(out) as (keyof PrayerTimeOffsets)[]) {
    const v = r[key];
    if (typeof v === 'number') out[key] = clampOffset(v);
  }
  return out;
}
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  AsyncStorage.setItem(
    KEY,
    JSON.stringify({
      location: state.location,
      is24h: state.is24h,
      language: state.language,
      highLatitude: state.highLatitude,
      offsets: state.offsets,
      theme: state.theme,
      hintergrund: state.hintergrund,
      hintergrundDimmung: state.hintergrundDimmung,
      fotoBewegung: state.fotoBewegung,
      akzent: state.akzent,
      uhrStil: state.uhrStil,
      uhrGewicht: state.uhrGewicht,
      uhrSekunden: state.uhrSekunden,
      bedienungAusblenden: state.bedienungAusblenden,
      quranFont: state.quranFont,
      quranSukun: state.quranSukun,
      readerScale: state.readerScale,
      readerTranslit: state.readerTranslit,
      readerTranslation: state.readerTranslation,
      readerAutoAdvance: state.readerAutoAdvance,
      azan: state.azan,
      azanVolume: state.azanVolume,
      clockScale: state.clockScale,
      versDesTagesAktiv: state.versDesTagesAktiv,
      jumuaModusAktiv: state.jumuaModusAktiv,
      wetterAktiv: state.wetterAktiv,
    }),
  ).catch(() => {});
}

let hydrated = false;
/** Laedt die gespeicherten Einstellungen einmalig. Exportiert, damit der Store
 *  auch ausserhalb von React geprueft/vorgewaermt werden kann (gleiches Muster
 *  wie `pairingState()` in lib/pairing.ts). */
export async function hydrateTvSettings(): Promise<void> {
  return hydrate();
}

/** Aktueller Einstellungs-Zustand ausserhalb von React. */
export function tvSettingsState(): TvSettings {
  return state;
}

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TvSettings>;
      state = {
        location: normalizeLocation(parsed.location),
        is24h: parsed.is24h ?? true,
        highLatitude: isHighLatitudeSetting(parsed.highLatitude)
          ? parsed.highLatitude
          : DEFAULT_CALC_EXTRAS.highLatitude,
        offsets: normalizeOffsets(parsed.offsets),
        // Gespeicherte Sprache nur uebernehmen, wenn sie noch unterstuetzt wird
        // — sonst bliebe nach einem Umbau der Sprachliste eine tote Locale
        // stehen und die App zeigte ueberall nur noch Schluessel.
        language: isLocale(parsed.language) ? parsed.language : state.language,
        // Jeder Darstellungswert wird EINZELN geprueft. Ein unbekannter Wert
        // (aeltere Installation, umbenanntes Thema) faellt auf den Standard
        // zurueck, statt `undefined` in jede Farbe des Baums zu tragen.
        theme: isThemeId(parsed.theme) ? parsed.theme : DEFAULT_THEME_ID,
        hintergrund: istHintergrundId(parsed.hintergrund) ? parsed.hintergrund : 'ruhig',
        hintergrundDimmung: istDimmung(parsed.hintergrundDimmung)
          ? parsed.hintergrundDimmung
          : DEFAULT_DIMMUNG,
        fotoBewegung: parsed.fotoBewegung ?? true,
        akzent: istAkzentId(parsed.akzent) ? parsed.akzent : 'thema',
        uhrStil: istUhrStil(parsed.uhrStil) ? parsed.uhrStil : 'digital',
        uhrGewicht: istUhrGewicht(parsed.uhrGewicht) ? parsed.uhrGewicht : 'leicht',
        uhrSekunden: parsed.uhrSekunden ?? true,
        bedienungAusblenden: istAusblendZeit(parsed.bedienungAusblenden)
          ? parsed.bedienungAusblenden
          : 0,
        quranFont: isQuranFontId(parsed.quranFont) ? parsed.quranFont : DEFAULT_QURAN_FONT,
        quranSukun: parsed.quranSukun === 'kreis' ? 'kreis' : 'madina',
        readerScale: isReaderScale(parsed.readerScale) ? parsed.readerScale : DEFAULT_READER_SCALE,
        readerTranslit: parsed.readerTranslit ?? true,
        readerTranslation: parsed.readerTranslation ?? true,
        readerAutoAdvance: parsed.readerAutoAdvance ?? true,
        azan: normalizeAzan(parsed.azan),
        azanVolume: clampAzanVolume(parsed.azanVolume),
        clockScale: isClockScale(parsed.clockScale) ? parsed.clockScale : DEFAULT_CLOCK_SCALE,
        versDesTagesAktiv: parsed.versDesTagesAktiv ?? false,
        jumuaModusAktiv: parsed.jumuaModusAktiv ?? false,
        wetterAktiv: parsed.wetterAktiv ?? false,
        loaded: true,
      };
    } else {
      state = { ...state, loaded: true };
    }
  } catch {
    state = { ...state, loaded: true };
  }
  emit();
}

export function setLocation(location: TvLocation) {
  state = { ...state, location };
  persist();
  emit();
}

export function setIs24h(is24h: boolean) {
  state = { ...state, is24h };
  persist();
  emit();
}

export function setLanguage(language: Locale) {
  state = { ...state, language };
  persist();
  emit();
}

export function setHighLatitude(highLatitude: HighLatitudeSetting) {
  state = { ...state, highLatitude };
  persist();
  emit();
}

/** Verschiebt die Korrektur EINES Gebets um `delta` Minuten (begrenzt auf ±60). */
export function adjustOffset(prayer: PrayerKey, delta: number) {
  const offsets = { ...state.offsets, [prayer]: clampOffset(state.offsets[prayer] + delta) };
  state = { ...state, offsets };
  persist();
  emit();
}

export function resetOffsets() {
  state = { ...state, offsets: NO_PRAYER_TIME_OFFSETS };
  persist();
  emit();
}

export function setTheme(theme: ThemeId) {
  state = { ...state, theme };
  persist();
  emit();
}

export function setHintergrund(hintergrund: HintergrundId) {
  state = { ...state, hintergrund };
  persist();
  emit();
}

export function setHintergrundDimmung(hintergrundDimmung: Dimmung) {
  state = { ...state, hintergrundDimmung };
  persist();
  emit();
}

export function setFotoBewegung(fotoBewegung: boolean) {
  state = { ...state, fotoBewegung };
  persist();
  emit();
}

export function setAkzent(akzent: AkzentId) {
  state = { ...state, akzent };
  persist();
  emit();
}

export function setUhrStil(uhrStil: UhrStil) {
  state = { ...state, uhrStil };
  persist();
  emit();
}

export function setUhrGewicht(uhrGewicht: UhrGewicht) {
  state = { ...state, uhrGewicht };
  persist();
  emit();
}

export function setUhrSekunden(uhrSekunden: boolean) {
  state = { ...state, uhrSekunden };
  persist();
  emit();
}

export function setBedienungAusblenden(bedienungAusblenden: AusblendZeit) {
  state = { ...state, bedienungAusblenden };
  persist();
  emit();
}

export function setQuranFont(quranFont: QuranFontId) {
  state = { ...state, quranFont };
  persist();
  emit();
}

export function setQuranSukun(quranSukun: SukunStil) {
  state = { ...state, quranSukun };
  persist();
  emit();
}

export function setReaderScale(readerScale: ReaderScale) {
  state = { ...state, readerScale };
  persist();
  emit();
}

/** Die drei Ein/Aus-Schalter des Lesers. Ein gemeinsamer Typ statt drei
 *  einzelner Setter: sie unterscheiden sich nur im Feldnamen, und so kann
 *  keiner vergessen werden, wenn ein vierter dazukommt. */
export type ReaderOption = 'readerTranslit' | 'readerTranslation' | 'readerAutoAdvance';

/** Schaltet einen der Leser-Schalter um (Bedienung am Fernseher). */
export function toggleReaderOption(key: ReaderOption) {
  state = { ...state, [key]: !state[key] };
  persist();
  emit();
}

/**
 * Setzt Leser-Schalter auf einen BESTIMMTEN Wert statt sie umzuschalten.
 *
 * Gebraucht, wo ein Ausgangszustand hergestellt werden muss statt eines
 * Wechsels — `toggleReaderOption` haengt vom vorherigen Stand ab und ist damit
 * fuer „stelle sicher, dass aus" das falsche Werkzeug.
 */
export function setReaderOptions(werte: Partial<Record<ReaderOption, boolean>>) {
  state = { ...state, ...werte };
  persist();
  emit();
}

/** Waehlt die Aufnahme fuer EIN Gebet (oder schaltet es mit „aus" stumm). */
export function setAzanChoice(prayer: AzanPrayer, choice: AzanChoice) {
  state = { ...state, azan: { ...state.azan, [prayer]: choice } };
  persist();
  emit();
}

/** Setzt alle fuenf Gebete auf einmal — fuer „alles aus" und den Vorschlag. */
export function setAzanAlle(azan: AzanPerPrayer) {
  state = { ...state, azan };
  persist();
  emit();
}

export function setAzanVolume(v: number) {
  state = { ...state, azanVolume: clampAzanVolume(v) };
  persist();
  emit();
}

export function setClockScale(clockScale: ClockScale) {
  state = { ...state, clockScale };
  persist();
  emit();
}

export function setVersDesTagesAktiv(aktiv: boolean) {
  state = { ...state, versDesTagesAktiv: aktiv };
  persist();
  emit();
}

export function setJumuaModusAktiv(aktiv: boolean) {
  state = { ...state, jumuaModusAktiv: aktiv };
  persist();
  emit();
}

export function setWetterAktiv(aktiv: boolean) {
  state = { ...state, wetterAktiv: aktiv };
  persist();
  emit();
}

/**
 * Rechenparameter vom gekoppelten Handy uebernehmen (Nachricht
 * `{ t: 'einstellungen', ... }`, siehe lib/pairing.ts).
 *
 * Bis 1.2.0 uebertrug die Kopplung nur Navigations- und Quiz-Kommandos: der
 * Fernseher zeigte dieselben Gebetszeiten wie das Handy nur, wenn der Nutzer
 * Ort, Methode, Madhab, Hochbreiten-Regel und Minuten-Korrektur auf BEIDEN
 * Geraeten von Hand gleich eingestellt hatte. Genau das war der offene Punkt
 * aus `docs/audit-2026-07-27/HANDY-TV-ABGLEICH.md`.
 *
 * Jedes Feld wird einzeln geprueft und einzeln uebernommen — eine unvollstaendige
 * oder aeltere Handy-Version darf den TV-Stand nicht beschaedigen. Rueckgabe:
 * die Namen der tatsaechlich uebernommenen Felder (fuer die Rueckmeldung ans
 * Handy und fuer den Test).
 */
export function applyRemoteSettings(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return [];
  const p = raw as Record<string, unknown>;
  const uebernommen: string[] = [];
  let next = state;

  if (p.location && typeof p.location === 'object') {
    const l = p.location as Record<string, unknown>;
    // normalizeLocation faellt bei fehlenden Koordinaten auf Berlin zurueck —
    // das waere hier ein stiller Ortswechsel. Deshalb vorher pruefen.
    if (typeof l.lat === 'number' && typeof l.lon === 'number') {
      // `normalizeLocation` traegt die Zone aus `cityId` nach, wenn das Handy
      // keine mitschickt. Ein GPS-Standort ohne Stadt hat weiterhin keine —
      // dann bleibt es bei der Geraetezeit, wie vorher.
      next = { ...next, location: normalizeLocation(l) };
      uebernommen.push('location');
    }
  }
  if (typeof p.is24h === 'boolean') {
    next = { ...next, is24h: p.is24h };
    uebernommen.push('is24h');
  }
  if (isHighLatitudeSetting(p.highLatitude)) {
    next = { ...next, highLatitude: p.highLatitude };
    uebernommen.push('highLatitude');
  }
  if (p.offsets && typeof p.offsets === 'object') {
    next = { ...next, offsets: normalizeOffsets(p.offsets) };
    uebernommen.push('offsets');
  }
  if (uebernommen.length === 0) return [];
  state = next;
  persist();
  emit();
  return uebernommen;
}

/**
 * Die Rechenparameter ausserhalb des Ortes, gebuendelt — der EINZIGE Weg, aus
 * den Einstellungen die Berechnungs-Optionen zu bauen (gleiche Absicht wie
 * `calcOptionsFromSettings()` in der Handy-App): Uhr, Countdown und jeder
 * spaetere Aufrufer sehen damit garantiert dieselben Zeiten.
 */
export function calcExtras(s: Pick<TvSettings, 'highLatitude' | 'offsets'>): PrayerCalcExtras {
  return { highLatitude: s.highLatitude, offsets: s.offsets };
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return state;
}

/** Reaktiver Zugriff auf die TV-Einstellungen; lädt beim ersten Gebrauch aus dem Speicher. */
export function useTvSettings(): TvSettings {
  useEffect(() => {
    void hydrate();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
