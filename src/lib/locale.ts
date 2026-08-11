import { NativeModules, Platform } from 'react-native';

import { appleEinstellungen } from '@/lib/appleEinstellungen';

/**
 * Sprachliste der TV-App — bewusst IDENTISCH zur Handy-App
 * (`apps/mobile/src/lib/locale-detect.ts`), damit ein Nutzer auf beiden
 * Geraeten dieselbe Sprache und dieselbe Terminologie vorfindet.
 *
 * Audit 2026-07-28 (T13): die TV-App hatte gar keine Mehrsprachigkeit —
 * saemtliche Beschriftungen waren fest deutsch, waehrend die Handy-App
 * 14 Sprachen spricht.
 */
export type Locale =
  | 'de'
  | 'en'
  | 'tr'
  | 'ar'
  | 'es'
  | 'fr'
  | 'id'
  | 'bn'
  | 'fa'
  | 'ms'
  | 'ur'
  | 'ru'
  | 'sw'
  | 'ps';

export const SUPPORTED_LOCALES: Locale[] = [
  'de',
  'en',
  'tr',
  'ar',
  'es',
  'fr',
  'id',
  'bn',
  'fa',
  'ms',
  'ur',
  'ru',
  'sw',
  'ps',
];

/** Eigenbezeichnung der Sprache — steht in JEDER Sprachdatei gleich da und
 *  gehoert deshalb in den Code, nicht in die 14 JSON-Dateien. Eine Sprachwahl,
 *  die die Sprachen in der Fremdsprache benennt, ist genau fuer den unbrauchbar,
 *  der die aktuelle Sprache nicht lesen kann. */
export const LOCALE_ENDONYMS: Record<Locale, string> = {
  de: 'Deutsch',
  en: 'English',
  tr: 'Türkçe',
  ar: 'العربية',
  es: 'Español',
  fr: 'Français',
  id: 'Bahasa Indonesia',
  bn: 'বাংলা',
  fa: 'فارسی',
  ms: 'Bahasa Melayu',
  ur: 'اردو',
  ru: 'Русский',
  sw: 'Kiswahili',
  ps: 'پښتو',
};

/** BCP-47-Tag fuer `toLocaleDateString` (Datumszeile der Gebetsuhr). */
export const DATE_LOCALE_TAGS: Record<Locale, string> = {
  de: 'de-DE',
  en: 'en-US',
  tr: 'tr-TR',
  ar: 'ar-SA',
  es: 'es-ES',
  fr: 'fr-FR',
  id: 'id-ID',
  bn: 'bn-BD',
  fa: 'fa-IR',
  ms: 'ms-MY',
  ur: 'ur-PK',
  ru: 'ru-RU',
  sw: 'sw-KE',
  ps: 'ps-AF',
};

// ar/ur/fa/ps sind rechtslaeufige Schriftsysteme — gleiche Menge wie in der
// Handy-App (`isRtlLanguageCode`).
const RTL_LANGUAGE_CODES = new Set<string>(['ar', 'ur', 'fa', 'ps']);

export function isRtlLocale(locale: Locale): boolean {
  return RTL_LANGUAGE_CODES.has(locale);
}

/**
 * Geraete-Sprache erraten.
 *
 * Die Handy-App nimmt dafuer `expo-localization`. Hier bewusst NICHT: das waere
 * ein weiteres natives Modul allein fuer einen Sprachcode, den Android ueber
 * `I18nManager.localeIdentifier` (z. B. `de_DE`) ohnehin als Konstante liefert.
 * `Intl` ist der Rueckfall fuer den Fall, dass die Konstante fehlt.
 * Nicht unterstuetzte Sprachen landen auf Englisch — wie in der Handy-App.
 */
export function detectDeviceLocale(): Locale {
  const raw = readPlatformLocale();
  const code = raw?.replace('_', '-').split('-')[0]?.toLowerCase();
  if (code && (SUPPORTED_LOCALES as string[]).includes(code)) return code as Locale;
  return 'en';
}

function readPlatformLocale(): string | null {
  try {
    const native = NativeModules?.I18nManager?.localeIdentifier as string | undefined;
    if (native) return native;
    if (Platform.OS === 'ios') {
      // Ueber `appleEinstellungen()`, nicht ueber `SettingsManager.settings`:
      // mit der neuen Architektur liegen Modul-Konstanten hinter
      // `getConstants()`, der Feldzugriff liest stumm `undefined`.
      const apple = appleEinstellungen()?.AppleLocale as string | undefined;
      if (apple) return apple;
    }
    return new Intl.DateTimeFormat().resolvedOptions().locale ?? null;
  } catch {
    // Kein Grund, den Start der App an einer Sprachvermutung scheitern zu
    // lassen — Englisch ist ein brauchbarer Rueckfall.
    return null;
  }
}
