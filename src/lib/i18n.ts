import ar from '@/locales/ar.json';
import bn from '@/locales/bn.json';
import de from '@/locales/de.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fa from '@/locales/fa.json';
import fr from '@/locales/fr.json';
import id from '@/locales/id.json';
import ms from '@/locales/ms.json';
import ps from '@/locales/ps.json';
import ru from '@/locales/ru.json';
import sw from '@/locales/sw.json';
import tr from '@/locales/tr.json';
import ur from '@/locales/ur.json';

import { isRtlLocale, type Locale } from '@/lib/locale';
import { useTvSettings } from '@/lib/settings';

/**
 * Uebersetzungsschicht der TV-App (Audit 2026-07-28, T13).
 *
 * Aufbau nach dem Muster der Handy-App (`apps/mobile/src/lib/translate.ts`):
 * gepunktete Schluessel, Fallback-Kette Sprache → Englisch → Deutsch → Schluessel,
 * reine Funktion ohne Store-Abhaengigkeit plus ein Hook, der an die persistierte
 * Spracheinstellung gebunden ist.
 *
 * EIN bewusster Unterschied: die Handy-App laedt 12 der 14 Sprachdateien per
 * `import()` nach, weil dort alle Locales zusammen 3 MB im immer geladenen
 * Chunk belegten. Die TV-Woerterbuecher haben 83 Schluessel und liegen bei
 * ~3 KB je Sprache — alle 14 zusammen sind kleiner als eine einzelne
 * Handy-Sprachdatei. Statisches Buendeln spart hier also nichts Messbares,
 * vermeidet aber einen sichtbaren Sprachumschlag beim App-Start auf dem
 * Fernseher (der Nutzer sieht sonst kurz Deutsch, bevor die Datei da ist) und
 * haelt die Uebersetzung offline verfuegbar.
 */
const DICTIONARIES: Record<Locale, unknown> = {
  de,
  en,
  tr,
  ar,
  es,
  fr,
  id,
  bn,
  fa,
  ms,
  ur,
  ru,
  sw,
  ps,
};

/** Werte fuer Platzhalter der Form `{name}` im uebersetzten Text. */
export type TranslationParams = Record<string, string | number>;

function lookup(dict: unknown, segments: string[]): string | undefined {
  let cur: unknown = dict;
  for (const seg of segments) {
    if (cur && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

/**
 * Loest einen gepunkteten Schluessel gegen das Woerterbuch der Sprache auf.
 * Fallback-Kette wie in der Handy-App: Sprache → Englisch → Deutsch → der
 * Schluessel selbst (nie ein leerer String, damit eine Luecke am Bildschirm
 * sichtbar wird statt still zu verschwinden).
 *
 * `params` ersetzt Platzhalter `{name}`. Ein Platzhalter ohne passenden Wert
 * bleibt absichtlich stehen — auch das faellt bei einer Luecke sofort auf.
 */
export function translate(locale: Locale, key: string, params?: TranslationParams): string {
  const segments = key.split('.');
  const raw =
    lookup(DICTIONARIES[locale], segments) ??
    lookup(DICTIONARIES.en, segments) ??
    lookup(DICTIONARIES.de, segments) ??
    key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * Uebersetzungs-Hook, gebunden an die persistierte Spracheinstellung.
 * `rtl` liegt gleich mit dabei, weil praktisch jeder Aufrufer, der Text setzt,
 * auch die Schreibrichtung braucht (ar/ur/fa/ps).
 */
export function useTranslation(): {
  locale: Locale;
  rtl: boolean;
  t: (key: string, params?: TranslationParams) => string;
} {
  const { language } = useTvSettings();
  return {
    locale: language,
    rtl: isRtlLocale(language),
    t: (key: string, params?: TranslationParams) => translate(language, key, params),
  };
}
