// Rotierender "Vers des Tages" fuer den Screensaver (ClockScreen). Nutzt
// denselben kuratierten Pool wie die Handy-App-Erinnerung
// (apps/mobile/src/features/verseOfDay/pool.ts) — hier als eigenstaendige
// Kopie, weil TV und Handy getrennte Codebasen ohne gemeinsames Paket sind
// (Daten teilen, kein Laufzeit-Import ueber App-Grenzen). NUR Verse (kein
// Hadith-Teil des Pools) — das deckt den User-Wunsch "zufaelliger Vers" ab,
// ohne die separate Hadith-API-Anbindung der Handy-App mitzuziehen.
//
// Text kommt LIVE von api.alquran.cloud (derselbe kostenlose Host wie bei der
// Handy-App, s. verseOfDay/content.ts) — keine eigene Uebersetzung erfunden.
import { fetchWithTimeout } from '@/lib/content';

export interface VerseRef {
  surah: number;
  ayah: number;
}

// Gleiche Auswahl wie VERSE_OF_DAY_POOL (nur die 'verse'-Eintraege), s.
// apps/mobile/src/features/verseOfDay/pool.ts fuer die Begruendung der Wahl.
export const VERS_POOL: VerseRef[] = [
  { surah: 2, ayah: 255 }, // Ayat al-Kursi
  { surah: 112, ayah: 1 }, // Al-Ikhlas
  { surah: 113, ayah: 1 }, // Al-Falaq
  { surah: 114, ayah: 1 }, // An-Nas
  { surah: 2, ayah: 153 }, // Geduld + Gebet
  { surah: 94, ayah: 5 }, // "Mit der Not kommt Erleichterung"
  { surah: 14, ayah: 7 }, // Dankbarkeit
  { surah: 65, ayah: 3 }, // Vertrauen auf Allah
  { surah: 3, ayah: 139 }, // "Verzage nicht, sei nicht traurig"
  { surah: 13, ayah: 28 }, // Ruhe im Gedenken Allahs
];

/** Identisch zu pool.ts::dayOfYear — Kalendertag, DST-sicher (nur Datumsfelder,
 *  keine Zeitstempel-Differenz). */
export function tagDesJahres(date: Date): number {
  const utcDatum = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const utcJahresstart = Date.UTC(date.getFullYear(), 0, 1);
  return Math.floor((utcDatum - utcJahresstart) / 86400000) + 1;
}

export function versDesTages(date: Date, pool: VerseRef[] = VERS_POOL): VerseRef {
  return pool[tagDesJahres(date) % pool.length];
}

// alquran.cloud-Editionskennung je Sprache — nur die selbst live geprueften
// (de per curl bestaetigt 2026-08-22). Fuer alle anderen Sprachen bewusst
// Englisch als Rueckfall statt geratener Editions-IDs, die ungeprueft falsch
// sein koennten.
const UEBERSETZUNGS_EDITION: Record<string, string> = {
  de: 'de.bubenheim',
  en: 'en.sahih',
};

export interface VersDesTagesInhalt {
  arabisch: string;
  uebersetzung: string;
  quelle: string;
}

async function ladeAyah(surah: number, ayah: number, edition: string): Promise<string> {
  const r = await fetchWithTimeout(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/${edition}`);
  if (!r.ok) throw new Error(`ayah_${r.status}`);
  const j = (await r.json()) as { data?: { text: string; surah: { englishName: string } } };
  if (!j.data) throw new Error('ayah_leer');
  return j.data.text;
}

export async function ladeVersDesTages(date: Date, sprache: string): Promise<VersDesTagesInhalt> {
  const ref = versDesTages(date);
  const edition = UEBERSETZUNGS_EDITION[sprache] ?? UEBERSETZUNGS_EDITION.en;
  const [arabisch, uebersetzung] = await Promise.all([
    ladeAyah(ref.surah, ref.ayah, 'quran-uthmani'),
    ladeAyah(ref.surah, ref.ayah, edition),
  ]);
  return { arabisch, uebersetzung, quelle: `${ref.surah}:${ref.ayah}` };
}
