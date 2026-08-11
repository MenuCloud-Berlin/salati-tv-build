import type { PrayerKey } from '@/lib/prayerTimes';

/**
 * Der Gebetsruf auf dem Fernseher.
 *
 * DREI AUFNAHMEN, dieselben wie in der Handy-App (`apps/mobile/assets/audio/
 * azan/`), damit im selben Haushalt derselbe Ruf erklingt. `aus` heisst: bei
 * diesem Gebet bleibt der Fernseher still.
 *
 * WARUM DER STANDARD „AUS" IST: Ein Geraet im Wohnzimmer, das von selbst laut
 * wird, ist eine Entscheidung des Nutzers, nicht des Programms. Eine
 * App-Aktualisierung darf einen Fernseher nicht dazu bringen, ploetzlich
 * mehrere Minuten lang zu rufen — womoeglich nachts zu Fadschr.
 *
 * WAS ER NICHT KANN, und warum: Der Ruf erklingt NUR, solange die App laeuft.
 * Die TV-App hat keine Benachrichtigungen und keine geplanten Alarme — anders
 * als auf dem Handy gibt es auf Android TV dafuer keinen verlaesslichen Weg
 * ohne Hintergrunddienst. Fuer eine Gebetsuhr, die ohnehin dauerhaft auf dem
 * Bildschirm steht, ist das der Normalfall; nach einem Neustart des Fernsehers
 * bleibt sie aber stumm, bis jemand die App oeffnet. Genau das sagt der
 * Hinweistext in den Einstellungen.
 */

export type AzanChoice = 'aus' | 'adhan1' | 'adhan2' | 'fajr';

export const AZAN_CHOICES: AzanChoice[] = ['aus', 'adhan1', 'adhan2', 'fajr'];

export function isAzanChoice(v: unknown): v is AzanChoice {
  return typeof v === 'string' && (AZAN_CHOICES as string[]).includes(v);
}

/**
 * `require` mit festem Literal-Pfad ist Pflicht: Metro loest Assets zur
 * Bauzeit auf, ein `require(`...${variable}`)` findet nichts.
 */
const QUELLEN = {
  adhan1: require('../../assets/audio/azan/adhan1.mp3'),
  adhan2: require('../../assets/audio/azan/adhan2.mp3'),
  fajr: require('../../assets/audio/azan/fajr.mp3'),
} as const;

/** Audioquelle einer Auswahl; `null` bei „aus". */
export function azanQuelle(choice: AzanChoice): number | null {
  return choice === 'aus' ? null : QUELLEN[choice];
}

/**
 * Anzeigename einer Aufnahme. Die REIHENFOLGE von `AZAN_CHOICES` ist die
 * Nummerierung — genau wie in der Handy-App, damit „Adhan 2" auf beiden
 * Geraeten dieselbe Aufnahme meint. Die technischen Kennungen bleiben, weil
 * sie in Dateinamen stecken; `fajr` erscheint deshalb als „Adhan 3".
 */
export function azanNummer(choice: Exclude<AzanChoice, 'aus'>): number {
  return AZAN_CHOICES.indexOf(choice);
}

/**
 * Gebete, die einen Ruf bekommen koennen. Der SONNENAUFGANG ist bewusst NICHT
 * dabei: er ist keine Gebetszeit, sondern das Ende der Fadschr-Zeit — ein Ruf
 * dazu waere sachlich falsch.
 */
export const AZAN_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type AzanPrayer = (typeof AZAN_PRAYERS)[number];

export type AzanPerPrayer = Record<AzanPrayer, AzanChoice>;

/** Alles aus — der Auslieferungszustand. */
export const AZAN_AUS: AzanPerPrayer = {
  fajr: 'aus',
  dhuhr: 'aus',
  asr: 'aus',
  maghrib: 'aus',
  isha: 'aus',
};

/**
 * Vorschlag beim EINSCHALTEN: Fadschr bekommt die Aufnahme MIT Tathwib
 * („aṣ-ṣalātu khayrun min an-nawm"), die uebrigen den kuerzeren regulaeren
 * Ruf. Wer den Schalter umlegt, hoert damit von Anfang an je Gebet den
 * liturgisch passenden Ruf, statt selbst fuenf Listen durchzugehen.
 *
 * Nur `fajr.mp3` traegt das Tathwib (gemessen: 14 statt 12 Phrasen, Phrasen 11
 * und 12 sind es) — Beleg in der Handy-App, docs/audit-2026-07-27/
 * ADHAN-LIZENZEN.md.
 */
export const AZAN_VORSCHLAG: AzanPerPrayer = {
  fajr: 'fajr',
  dhuhr: 'adhan1',
  asr: 'adhan1',
  maghrib: 'adhan1',
  isha: 'adhan1',
};

export function normalizeAzan(raw: unknown): AzanPerPrayer {
  if (!raw || typeof raw !== 'object') return AZAN_AUS;
  const r = raw as Record<string, unknown>;
  const out = { ...AZAN_AUS };
  for (const p of AZAN_PRAYERS) {
    if (isAzanChoice(r[p])) out[p] = r[p];
  }
  return out;
}

/** Ist bei mindestens einem Gebet ein Ruf gewaehlt? */
export function azanAktiv(je: AzanPerPrayer): boolean {
  return AZAN_PRAYERS.some((p) => je[p] !== 'aus');
}

/** Nur die Gebete, die einen Ruf bekommen koennen (Sonnenaufgang faellt weg). */
export function istAzanGebet(key: PrayerKey): key is AzanPrayer {
  return (AZAN_PRAYERS as readonly string[]).includes(key);
}

/**
 * Lizenzen der drei Aufnahmen.
 *
 * WARUM DAS HIER STEHT UND NICHT NUR IN EINER DATEI IM REPO: Zwei der drei
 * verlangen Namensnennung (CC BY-SA 4.0 und CC BY 3.0). Sie mitzuliefern, ohne
 * sie zu nennen, waere ein Lizenzbruch — deshalb hat die TV-App seit diesem
 * Release einen Lizenz-Bereich in den Einstellungen. Wortlaut und Quellen
 * stammen aus `apps/mobile/src/app/lizenzen.tsx`, damit beide Apps dasselbe
 * sagen.
 */
export interface AzanLizenz {
  choice: Exclude<AzanChoice, 'aus'>;
  titel: string;
  urheber: string;
  lizenz: string;
  quelle: string;
}

export const AZAN_LIZENZEN: AzanLizenz[] = [
  {
    choice: 'adhan1',
    titel: '„Beautiful adhan"',
    urheber: 'Adam-synagda',
    lizenz: 'CC0 1.0',
    quelle: 'commons.wikimedia.org/wiki/File:Beautiful_adhan.ogg',
  },
  {
    choice: 'adhan2',
    titel: '„Azan"',
    urheber: 'Andrewler',
    lizenz: 'CC BY-SA 4.0',
    quelle: 'commons.wikimedia.org/wiki/File:Azan.ogg',
  },
  {
    choice: 'fajr',
    titel: '„Eid al-Fitr Fajr azan at Malmö Mosque"',
    urheber: 'Islamic Center Malmö',
    lizenz: 'CC BY 3.0',
    quelle: 'commons.wikimedia.org/wiki/File:Eid_al-Fitr_Fajr_azan_at_Malmö_Mosque',
  },
];
