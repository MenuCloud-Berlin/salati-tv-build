// Koran-Text + Wort-Zeitstempel für den TV-Reader (quran.com API v4 — dieselbe
// Quelle wie die Handy-App). Pro Sure: Verse mit arabischem Wort-Text + latei-
// nischer Umschrift, eine Vers-Übersetzung, und je Vers die Rezitations-Audio-
// URL + Wort-Segmente ([wortIdx, wortNr, startMs, endMs]) fürs live-Highlighting.
import { fetchWithTimeout } from '@/lib/content';
import type { Locale } from '@/lib/locale';

import { ablegen, aufraeumen, lesen } from '@/lib/cache';

const BASE = 'https://api.quran.com/api/v4';

/**
 * Woher die zuletzt gelieferte Sure kam. Der Leser sagt es dem Nutzer — die
 * drei Faelle unterscheiden sich fuer ihn spuerbar:
 *   `netz`   alles da
 *   `ablage` zuletzt gelesene Fassung, mit Uebersetzung, ohne Rezitation
 *   `paket`  mitgelieferter Text, OHNE Uebersetzung und ohne Rezitation
 */
export type LeseQuelle = 'netz' | 'ablage' | 'paket';
let leseQuelle: LeseQuelle = 'netz';

export function letzteLeseQuelle(): LeseQuelle {
  return leseQuelle;
}

// Wort-Sync-Rezitatoren (quran.com-recitation-Id). Alafasy (7) ist Default —
// klare, verbreitete Stimme mit vollständigen Zeitstempeln.
export const READER_RECITERS: { id: number; name: string }[] = [
  { id: 7, name: 'Mishary Al-Afasy' },
  { id: 6, name: 'Mahmoud Al-Husary' },
  { id: 2, name: 'AbdulBaset AbdulSamad' },
  { id: 4, name: 'Abu Bakr Al-Shatri' },
  { id: 10, name: "Sa'ud Al-Shuraim" },
];

/**
 * Übersetzungs-Ressource je App-Sprache (quran.com `resource_id`).
 *
 * Vorher stand hier fest `27` (Bubenheim & Elyas, Deutsch) — mit der neuen
 * Mehrsprachigkeit (Audit 2026-07-28, T13) hätte ein türkischer Nutzer damit
 * eine türkische Oberfläche und darunter eine deutsche Vers-Übersetzung.
 *
 * Die IDs sind am 2026-07-28 live gegen
 * `https://api.quran.com/api/v4/resources/translations` geprüft, NICHT geraten.
 * Wo es dieselbe Ausgabe gibt, ist die Wahl identisch zu
 * `BEST_TRANSLATIONS` der Handy-App (de/en/tr/es/fr/id/ms/ur/ru/sw).
 * Für bn/fa/ps führt quran.com die Handy-Ausgabe nicht — dort steht die
 * jeweils verbreitetste vorhandene.
 *
 * `null` für Arabisch: quran.com hat KEINE arabische „Übersetzung" (der
 * Reader zeigt den arabischen Text ohnehin groß) — der Abruf entfällt dann
 * ganz, statt eine fremdsprachige Zeile darunterzusetzen.
 */
export const TRANSLATION_RESOURCES: Record<Locale, number | null> = {
  de: 27, // Frank Bubenheim & Nadeem Elyas
  en: 20, // Saheeh International
  tr: 77, // Diyanet İşleri
  ar: null, // s. o. — keine arabische Ausgabe vorhanden
  es: 83, // Sheikh Isa Garcia
  fr: 31, // Muhammad Hamidullah
  id: 33, // Indonesian Islamic Affairs Ministry
  bn: 161, // Taisirul Quran
  fa: 29, // Hussein Taji Kal Dari
  ms: 39, // Abdullah Muhammad Basmeih
  ur: 234, // Fatah Muhammad Jalandhari
  ru: 45, // Elmir Kuliev
  sw: 49, // Ali Muhsin Al-Barwani
  ps: 118, // Zakaria Abulsalam
};

export interface ReaderWord {
  ar: string;
  translit: string;
}
export type WordSegment = [number, number, number, number];
export interface ReaderVerse {
  n: number; // numberInSurah
  words: ReaderWord[];
  translation: string;
  audioUrl: string;
  segments: WordSegment[]; // [wortIdx(0-basiert), wortNr, startMs, endMs]
}

interface WordsResp {
  verses: {
    verse_number: number;
    words: { char_type_name: string; text_uthmani?: string; text?: string; transliteration: { text: string | null } }[];
  }[];
}
interface TransResp {
  /** `verse_key` ("2:255") kommt nur mit `fields=verse_key` mit — s. Zuordnung
   *  in `fetchSurahReader`. */
  translations: { text: string; verse_key?: string }[];
}
interface SegResp {
  audio_files: { verse_key: string; url: string; segments?: WordSegment[] }[];
}

function resolveAudio(url: string): string {
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return `https://verses.quran.com/${url}`;
}

/**
 * quran.com liefert Übersetzungen als HTML-Fragment. Reines Tag-Entfernen
 * genügt NICHT: Fußnoten stehen als `<sup foot_note="12345">1</sup>`, die
 * Ziffer ist Textinhalt und blieb stehen. Am Fernseher las sich Saheeh
 * International dadurch als „[All] praise is [due] to Allāh, Lord1 of the
 * worlds" (Bildschirmbefund Audit 2026-07-29). Der Untertitel-Look des Readers
 * hat keinen Platz für Fußnoten — sie fliegen ganz raus, statt als nackte
 * Ziffer im Satz zu kleben.
 *
 * Die Handy-App ist davon nicht betroffen: sie zeigt Übersetzungen über einen
 * eigenen HTML-Renderer.
 */
function stripHtml(s: string): string {
  return s
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

/**
 * Lädt eine komplette Sure (Text + Umschrift + Übersetzung + Segmente).
 *
 * `translationResource` ist die quran.com-Ressource der App-Sprache
 * (`TRANSLATION_RESOURCES`); `null` überspringt den Übersetzungs-Abruf ganz.
 */
export async function fetchSurahReader(
  surah: number,
  recitationId: number,
  translationResource: number | null = TRANSLATION_RESOURCES.de,
): Promise<ReaderVerse[]> {
  // Der Schluessel traegt die Uebersetzung mit: dieselbe Sure auf Tuerkisch ist
  // ein anderer Inhalt, und ohne sie im Schluessel zeigte der Leser nach einem
  // Sprachwechsel ohne Netz die Uebersetzung der vorigen Sprache.
  const key = `sure:${surah}:${recitationId}:${translationResource ?? 'ohne'}`;
  try {
    const daten = await ladeSureAusDemNetz(surah, recitationId, translationResource);
    void ablegen(key, daten);
    leseQuelle = 'netz';
    // Nur die zuletzt gelesenen Suren behalten — 114 Suren mal Uebersetzung
    // waeren mehrere Megabyte. Laeuft nebenher; ein Fehler dabei darf das Lesen
    // nicht stoeren (s. `aufraeumen`).
    void aufraeumen('sure:', 25);
    return daten;
  } catch (fehler) {
    // 1. Wahl ohne Netz: die zuletzt gelesene Fassung — sie hat die
    //    Uebersetzung dabei.
    const abgelegt = await lesen<ReaderVerse[]>(key);
    if (abgelegt && abgelegt.length > 0) {
      leseQuelle = 'ablage';
      return abgelegt;
    }
    // 2. Wahl: der gebuendelte Text. Kein Netz, nie geladen — und trotzdem
    //    steht der Vers da. Ohne Uebersetzung und ohne Rezitation, das sagt der
    //    Bildschirm auch.
    const ausPaket = sureAusPaket(surah);
    if (ausPaket.length > 0) {
      leseQuelle = 'paket';
      return ausPaket;
    }
    throw fehler;
  }
}

/**
 * Die Sure aus dem mitgelieferten Text (`data/quranText.generated.json`,
 * 6.236 Verse, Wort fuer Wort mit Umschrift).
 *
 * `require` im Funktionskoerper und NICHT als Import oben: die Datei ist
 * 2,4 MB. Als Modul-Import wuerde sie beim App-Start ausgewertet — auf einem
 * Fire-TV-Stick sind das mehrere hundert Millisekunden, bevor die Uhr steht,
 * und die braucht den Korantext nie. So wird sie erst beim ersten Blick in den
 * Leser gelesen.
 */
function sureAusPaket(surah: number): ReaderVerse[] {
  try {
     
    const paket = require('@/data/quranText.generated.json') as {
      suren: Record<string, [string, string][][]>;
    };
    const verse = paket.suren?.[String(surah)];
    if (!Array.isArray(verse)) return [];
    return verse.map((woerter, i) => ({
      n: i + 1,
      words: woerter.map(([ar, translit]) => ({ ar, translit })),
      // Beides kommt aus dem Netz: die Uebersetzung haengt an der Sprache, die
      // Zeitstempel nuetzen ohne den Audio-Stream nichts.
      translation: '',
      audioUrl: '',
      segments: [],
    }));
  } catch {
    return [];
  }
}

/** Der eigentliche Abruf — getrennt, damit die Ablage ihn einfach umschliessen
 *  kann und die Zuordnungs-Logik unten unveraendert bleibt. */
async function ladeSureAusDemNetz(
  surah: number,
  recitationId: number,
  translationResource: number | null,
): Promise<ReaderVerse[]> {
  const [wordsR, transR, segR] = await Promise.all([
    fetchWithTimeout(`${BASE}/verses/by_chapter/${surah}?words=true&word_fields=text_uthmani,transliteration&per_page=300`),
    // `fields=verse_key` ist Pflicht für die Zuordnung unten (s. dort).
    translationResource === null
      ? Promise.resolve(null)
      : fetchWithTimeout(
          `${BASE}/quran/translations/${translationResource}?chapter_number=${surah}&fields=verse_key`,
        ),
    fetchWithTimeout(`${BASE}/recitations/${recitationId}/by_chapter/${surah}?fields=segments&per_page=300`),
  ]);
  if (!wordsR.ok) throw new Error(`words_${wordsR.status}`);
  const wordsJson = (await wordsR.json()) as WordsResp;
  const transJson = transR?.ok ? ((await transR.json()) as TransResp) : { translations: [] };
  const segJson = segR.ok ? ((await segR.json()) as SegResp) : { audio_files: [] };

  const segByVerse: Record<number, { audioUrl: string; segments: WordSegment[] }> = {};
  for (const f of segJson.audio_files) {
    const n = Number(f.verse_key.split(':')[1]);
    if (Number.isFinite(n) && f.url) segByVerse[n] = { audioUrl: resolveAudio(f.url), segments: f.segments ?? [] };
  }

  // Audit 2026-07-28 (T11): die Übersetzung wurde über den LISTENINDEX
  // zugeordnet (`translations[i]`). Käme die Liste unvollständig von vorne
  // (oder in anderer Reihenfolge), stünde unter jedem Vers stillschweigend die
  // Übersetzung eines anderen — ein Fehler, den niemand am Bildschirm bemerkt,
  // weil er wie ein normaler Text aussieht. Jetzt über die Versnummer aus
  // `verse_key` ("18:5" → 5).
  const transByVerse: Record<number, string> = {};
  for (const tr of transJson.translations) {
    const n = Number(tr.verse_key?.split(':')[1]);
    if (Number.isFinite(n)) transByVerse[n] = stripHtml(tr.text);
  }
  // Rückfall auf die Reihenfolge NUR, wenn kein einziger `verse_key` mitkam
  // (ältere API-Antwort): dann ist die Positionszuordnung besser als gar keine
  // Übersetzung — aber sie greift nachweisbar nur in diesem Fall.
  const byIndex = Object.keys(transByVerse).length === 0;

  return wordsJson.verses.map((v, i) => {
    const words: ReaderWord[] = v.words
      .filter((w) => w.char_type_name === 'word')
      .map((w) => ({ ar: w.text_uthmani ?? w.text ?? '', translit: w.transliteration.text ?? '' }));
    const seg = segByVerse[v.verse_number];
    const translation = byIndex
      ? transJson.translations[i]
        ? stripHtml(transJson.translations[i].text)
        : ''
      : (transByVerse[v.verse_number] ?? '');
    return {
      n: v.verse_number,
      words,
      translation,
      audioUrl: seg?.audioUrl ?? '',
      segments: seg?.segments ?? [],
    };
  });
}

/** Aktiver Wort-Index im Vers für die aktuelle Wiedergabeposition (ms). */
export function activeWordIndex(segments: WordSegment[], positionMs: number): number {
  const s = segments.find((sg) => positionMs >= sg[2] && positionMs < sg[3]);
  return s ? s[0] : -1;
}
