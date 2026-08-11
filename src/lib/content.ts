// Inhalte der TV-App kommen aus denselben öffentlichen Cloudflare-R2-Indizes
// wie die Handy-App (egress-frei, kein Neu-Hosting). Reine `fetch`-Aufrufe,
// kein Client nötig. Muster wie fetchVideoIndex/fetchPodcastIndex der Handy-App.

import { mitAblage } from '@/lib/cache';

const R2 = 'https://pub-d0489c0572704285af79896edb72cbed.r2.dev';

/**
 * Wurde der zuletzt gelieferte Inhalt aus der Ablage geholt (= kein Netz)?
 *
 * Bewusst ein Modul-Wert und kein Rueckgabewert: die Abruf-Funktionen liefern
 * seit jeher die reine Liste, und alle Aufrufer haengen daran. Der Bildschirm
 * fragt nach dem Laden einmal nach — mehr braucht die Anzeige nicht.
 */
const ausAblage = new Map<string, boolean>();

export function kamAusAblage(bereich: string): boolean {
  return ausAblage.get(bereich) === true;
}

export interface VideoEntry {
  episode_no: number;
  title: string;
  description?: string;
  series?: string;
  series_title?: string;
  duration_sec?: number;
  video_url: string;
  kind?: string;
}

export interface ReelEntry {
  id: string;
  episode_no: number;
  index: number;
  title: string;
  series?: string;
  series_title?: string;
  duration_sec?: number;
  video_url: string;
}

export interface PodcastEntry {
  episode_no: number;
  title: string;
  description?: string;
  series?: string;
  series_title?: string;
  duration_sec?: number;
  audio_url: string;
  cover_url?: string;
}

/** Audit 2026-07-28: KEIN Netz-Abruf der TV-App hatte einen Timeout. Ein TV in
 *  einem WLAN mit Captive Portal / totem Uplink laesst `fetch` beliebig lange
 *  offen — die Screens blieben dann dauerhaft im Spinner haengen (und der hatte
 *  bis heute nicht einmal ein fokussierbares Element). 12 s ist grosszuegig
 *  genug fuer langsame DSL-Anschluesse und kurz genug, um den Fehlerzustand
 *  mit „Erneut versuchen" sichtbar zu machen. */
export const FETCH_TIMEOUT_MS = 12_000;

/**
 * Der HTTP-Zwischenspeicher der Netzschicht ist ABGESCHALTET — ueber den
 * KOPFEINTRAG, nicht ueber die `cache`-Option (2026-08-08).
 *
 * Bis hierher liefen die Abrufe ohne Angabe, und OkHttp — die Netzschicht von
 * React Native auf Android — bediente sie bei Bedarf still aus seinem eigenen
 * Zwischenspeicher. Am Emulator sah das genau so aus wie ein Treffer in unserer
 * Ablage: die Rezitatoren-Liste erschien ohne Netz, aber der Hinweis „ohne
 * Netz" blieb aus — der Abruf war ja formal GELUNGEN.
 *
 * WARUM DER KOPFEINTRAG UND NICHT `cache: 'no-store'`: React Natives `fetch`
 * ist ein Aufsatz auf XMLHttpRequest und wertet die `cache`-Option GAR NICHT
 * aus. Sie zu setzen sieht richtig aus und tut nichts — genau daran ist der
 * erste Anlauf gescheitert (die Liste kam weiter aus OkHttps Speicher).
 * `Cache-Control` als Kopfeintrag reicht RN dagegen durch, und OkHttp haelt
 * sich daran. Die Option bleibt zusaetzlich stehen: auf Web wertet sie der
 * Browser aus.
 *
 * Zwei Zwischenspeicher fuer dieselbe Sache sind einer zu viel; der unsichtbare,
 * unbegrenzte ist aus. Die App hat eine eigene, in der Groesse begrenzte Ablage
 * mit ehrlicher Anzeige (lib/cache.ts).
 */
export async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      cache: 'no-store',
      ...init,
      headers: { 'Cache-Control': 'no-store', ...(init?.headers ?? {}) },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetchWithTimeout(url);
  if (!r.ok) throw new Error(`fetch_${r.status}`);
  return (await r.json()) as T;
}

// Podcast-Folgen liegen NICHT auf R2, sondern im öffentlichen Supabase-Storage-
// Bucket `podcasts` (gleiche Quelle wie die Handy-App, reiner fetch, kein Client).
const PODCAST_INDEX =
  'https://oulyzhselufekxekkqjp.supabase.co/storage/v1/object/public/podcasts/index.json';

export async function fetchPodcasts(): Promise<PodcastEntry[]> {
  const r = await mitAblage('podcasts', () => getJson<{ episodes: PodcastEntry[] }>(PODCAST_INDEX));
  ausAblage.set('podcasts', r.ausAblage);
  return (r.daten.episodes ?? []).sort((a, b) => a.episode_no - b.episode_no);
}

/** Alle Lern-/Grammatik-Videos (Episoden + Tabellen), gruppiert nach series_title. */
export async function fetchVideos(): Promise<VideoEntry[]> {
  const r = await mitAblage('videos', () => getJson<{ episodes: VideoEntry[] }>(`${R2}/videos/index.json`));
  ausAblage.set('videos', r.ausAblage);
  return r.daten.episodes ?? [];
}

export async function fetchReels(): Promise<ReelEntry[]> {
  const r = await mitAblage('reels', () => getJson<{ reels: ReelEntry[] }>(`${R2}/reels/index.json`));
  ausAblage.set('reels', r.ausAblage);
  return r.daten.reels ?? [];
}

export interface Section<T> {
  key: string;
  title: string;
  items: T[];
}

/** In Reihen nach `series_title` gruppieren (Erst-Auftritts-Reihenfolge) — für
 *  das 10-Fuß-Reihen-Layout (wie Netflix/YouTube-TV). */
export function groupBySeries<T extends { series?: string; series_title?: string }>(
  items: T[],
): Section<T>[] {
  const order: string[] = [];
  const map = new Map<string, Section<T>>();
  for (const it of items) {
    const key = it.series || '__';
    let sec = map.get(key);
    if (!sec) {
      sec = { key, title: it.series_title || 'Videos', items: [] };
      map.set(key, sec);
      order.push(key);
    }
    sec.items.push(it);
  }
  return order.map((k) => map.get(k)!);
}

export function fmtDuration(sec?: number): string {
  if (!sec || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
