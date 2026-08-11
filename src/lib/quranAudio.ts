// Rezitatoren & Koran-Radio kommen von mp3quran.net (kostenlos, ohne API-Key) —
// dieselbe Quelle wie in der Handy-App (features/quran/radio.ts). Fürs TV nutzen
// wir bewusst die VOLL-SUREN-Dateien der Rezitatoren (ein mp3 je Sure) statt der
// Vers-für-Vers-Schnipsel von alquran.cloud: eine URL = eine ganze Rezitation,
// ideal für einen Lehnzurück-Player ohne Queue-Logik.

import { fetchWithTimeout } from '@/lib/content';

import { ablegen, lesen } from '@/lib/cache';

const API = 'https://www.mp3quran.net/api/v3';

/** Kam die zuletzt gelieferte Liste NICHT aus dem Netz? s. content.ts. */
const ausAblageQuelle = new Map<string, boolean>();

export function kamAusAblage(bereich: string): boolean {
  return ausAblageQuelle.get(bereich) === true;
}

/**
 * Netz zuerst, dann die Ablage, dann der mitgelieferte Stand.
 *
 * Die dritte Stufe ist fuer den Fernseher, der frisch eingerichtet wird und nie
 * Netz hatte: ohne sie waeren Rezitatoren und Radio dort schlicht leer. Der
 * Stand ist vom 2026-08-08; abspielen laesst sich davon ohne Verbindung
 * natuerlich nichts — die Liste ist dann eine Vorschau auf das, was da ist.
 *
 * `require` im Funktionskoerper: 179 KB, die beim Start niemand braucht.
 */
async function mitAblageUndPaket<T>(
  key: string,
  bereich: string,
  laden: () => Promise<T>,
  ausPaket: () => T,
): Promise<T> {
  try {
    const daten = await laden();
    void ablegen(key, daten);
    ausAblageQuelle.set(bereich, false);
    return daten;
  } catch (fehler) {
    const abgelegt = await lesen<T>(key);
    if (abgelegt !== null) {
      ausAblageQuelle.set(bereich, true);
      return abgelegt;
    }
    const paket = ausPaket();
    if (Array.isArray(paket) ? paket.length > 0 : paket != null) {
      ausAblageQuelle.set(bereich, true);
      return paket;
    }
    throw fehler;
  }
}

interface Mp3QuranPaket {
  reciters: ReciterApi[];
  radios: { id?: number; name?: string; url?: string }[];
}

function paket(): Mp3QuranPaket {
  try {
     
    return require('@/data/mp3quran.snapshot.json') as Mp3QuranPaket;
  } catch {
    return { reciters: [], radios: [] };
  }
}

export interface Reciter {
  id: string;
  name: string;
  rewaya: string;
  server: string; // endet mit '/'
  surahList: number[];
}

export interface RadioStation {
  id: number;
  name: string;
  url: string;
}

interface ReciterApi {
  id: number;
  name: string;
  moshaf?: { id: number; name: string; server: string; surah_list: string }[];
}

/** Rezitatoren (nur Moshaf mit gültigem Server). Jeder Moshaf = eine Riwāya/Aufnahme;
 *  wir listen sie einzeln, damit z. B. Hafs- und Warsh-Aufnahmen wählbar bleiben. */
export function parseReciters(list: ReciterApi[]): Reciter[] {
  const out: Reciter[] = [];
  for (const r of list) {
    for (const m of r.moshaf ?? []) {
      if (!m.server || !m.server.startsWith('https://')) continue;
      const surahList = m.surah_list
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 114);
      if (surahList.length === 0) continue;
      out.push({
        id: `${r.id}-${m.id}`,
        name: r.name.replace(/\s+/g, ' ').trim(),
        rewaya: m.name.replace(/\s+/g, ' ').trim(),
        server: m.server.endsWith('/') ? m.server : `${m.server}/`,
        surahList,
      });
    }
  }
  return out;
}

export async function fetchReciters(lang = 'eng'): Promise<Reciter[]> {
  // Abgelegt wird die FERTIGE Liste, nicht die Antwort: `parseReciters` wirft
  // unbrauchbare Eintraege weg, und eine spaetere Version tut das womoeglich
  // anders — die Ablage soll den heutigen Stand des Parsers nicht konservieren.
  return mitAblageUndPaket(
    `reciters:${lang}`,
    'reciters',
    async () => {
      const r = await fetchWithTimeout(`${API}/reciters?language=${lang}`);
      if (!r.ok) throw new Error(`reciters_${r.status}`);
      const j = (await r.json()) as { reciters?: ReciterApi[] };
      return parseReciters(j.reciters ?? []);
    },
    () => parseReciters(paket().reciters),
  );
}

/** Voll-Suren-Audio-URL: server + 3-stellige Sure + .mp3 (mp3quran-Konvention). */
export function surahAudioUrl(server: string, surah: number): string {
  return `${server}${String(surah).padStart(3, '0')}.mp3`;
}

interface RadioApi {
  radios?: { id?: number; name?: string; url?: string }[];
}

export function parseRadios(j: RadioApi): RadioStation[] {
  return (j.radios ?? [])
    .filter(
      (r): r is { id: number; name: string; url: string } =>
        typeof r.id === 'number' &&
        typeof r.name === 'string' &&
        r.name.trim() !== '' &&
        typeof r.url === 'string' &&
        r.url.startsWith('https://'),
    )
    .map((r) => ({ id: r.id, name: r.name.replace(/\s+/g, ' ').trim(), url: r.url }));
}

export async function fetchRadios(lang = 'eng'): Promise<RadioStation[]> {
  return mitAblageUndPaket(
    `radios:${lang}`,
    'radios',
    async () => {
      const r = await fetchWithTimeout(`${API}/radios?language=${lang}`);
      if (!r.ok) throw new Error(`radios_${r.status}`);
      return parseRadios((await r.json()) as RadioApi);
    },
    () => parseRadios(paket() as RadioApi),
  );
}
