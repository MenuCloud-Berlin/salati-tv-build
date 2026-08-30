import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { mitAblage } from '@/lib/cache';
import { FETCH_TIMEOUT_MS } from '@/lib/content';

/**
 * Foto- und Video-Hintergruende — der Katalog und ihr Speicher auf dem Geraet.
 *
 * WARUM (Nutzerwunsch 2026-08-30): „es fehlen noch Hintergruende … schoene
 * verschiedene, bewegt und nicht bewegt, vielleicht Stockvideos von der Kaaba".
 * Die fuenf gezeichneten Hintergruende (components/Hintergrund.tsx) sind
 * Ornament, kein Motiv. Ein Fernseher, der stundenlang im Raum steht, darf
 * auch ein Bild zeigen.
 *
 * DREI ENTSCHEIDUNGEN, die alles andere erklaeren:
 *
 * 1. NICHT IM PAKET. Ein 1080p-Foto sind rund 300 KB, ein 20-Sekunden-Video
 *    rund 6 MB. Alle Motive im APK waeren zweistellige Megabyte fuer etwas,
 *    das die meisten nie einschalten — und jede neue Aufnahme braeuchte eine
 *    neue App-Fassung. Der Katalog liegt deshalb als Index in R2, genau wie
 *    Videos, Reels und Podcasts (lib/content.ts).
 *
 * 2. EINMAL HERUNTERLADEN, NICHT DAUERND STREAMEN. Ein Hintergrund laeuft
 *    stundenlang. Als Stream waere das jeden Tag ein Vielfaches der Datei —
 *    auf einem Anschluss, den sich mehrere teilen, ein schlechter Gast (dasselbe
 *    Argument wie in lib/offlineAudio.ts). Gewaehlt wird also erst geladen,
 *    dann von der Platte gespielt; ohne Netz laeuft er trotzdem weiter.
 *
 * 3. DIE VORSCHAU IST IMMER EIN BILD. Auch zu jedem Video gehoert ein
 *    Standbild: es steht in der Auswahl, und es liegt beim Start unter dem
 *    Video, solange das noch nicht spielt. Ohne das blitzt beim Einschalten
 *    der schwarze Grund auf.
 */

const INDEX_KEY = 'salati-tv-hintergrundmedien-v1';
const ORDNER = `${FileSystem.documentDirectory ?? ''}hintergruende/`;
const R2 = 'https://pub-d0489c0572704285af79896edb72cbed.r2.dev';
const INDEX_URL = `${R2}/tv/hintergrund/index.json`;

export interface HintergrundMedium {
  /** Stabile Kennung; steht als `medium:<id>` in den Einstellungen. */
  id: string;
  /** Uebersetzungs-Schluessel des Anzeigenamens, z. B. `hintergrund.kaabaNacht`. */
  nameKey?: string;
  /** Anzeigename, falls es keinen Schluessel gibt (neues Motiv, alte App). */
  name: string;
  art: 'foto' | 'video';
  /** Adresse der Datei (Foto: JPG, Video: MP4 ohne Tonspur). */
  url: string;
  /** Standbild — Vorschau in der Auswahl und Grund unter dem Video. */
  posterUrl: string;
  bytes?: number;
  /** Nachweis: Urheber, Lizenz und Fundstelle. Steht in den Einstellungen. */
  autor?: string;
  lizenz?: string;
  quelle?: string;
}

interface GespeichertesMedium {
  id: string;
  bytes: number;
  t: number;
}

type Speicher = Record<string, GespeichertesMedium>;

let katalog: HintergrundMedium[] | null = null;
let speicher: Speicher = {};
let geladen = false;
const hoerer = new Set<() => void>();

function melden() {
  for (const h of [...hoerer]) h();
}

function abonnieren(h: () => void) {
  hoerer.add(h);
  return () => {
    hoerer.delete(h);
  };
}

/** Dateiname auf dem Geraet. Die Kennung ist bereits auf harmlose Zeichen
 *  begrenzt (s. `medienIdLesen`), sie kann also keinen Pfad aufmachen. */
function datei(m: HintergrundMedium): string {
  return `${ORDNER}${m.id}.${m.art === 'video' ? 'mp4' : 'jpg'}`;
}

export function medienSpeicherMoeglich(): boolean {
  return !!FileSystem.documentDirectory;
}

/** Laedt das Verzeichnis der gespeicherten Motive einmalig. */
export async function hydrateHintergrundMedien(): Promise<void> {
  if (geladen) return;
  geladen = true;
  try {
    const roh = await AsyncStorage.getItem(INDEX_KEY);
    if (roh) speicher = JSON.parse(roh) as Speicher;
  } catch {
    speicher = {};
  }
  melden();
}

async function schreibeSpeicher() {
  try {
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(speicher));
  } catch {
    /* ignorieren — die Datei liegt, nur das Verzeichnis hinkt */
  }
}

function pruefeKatalog(roh: unknown): HintergrundMedium[] {
  if (!Array.isArray(roh)) return [];
  const raus: HintergrundMedium[] = [];
  for (const e of roh) {
    if (!e || typeof e !== 'object') continue;
    const m = e as Record<string, unknown>;
    // Jede Kennung wird auf dasselbe Muster geprueft wie beim Lesen aus den
    // Einstellungen: ein Index aus dem Netz darf keinen Dateipfad bestimmen.
    if (typeof m.id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(m.id)) continue;
    if (m.art !== 'foto' && m.art !== 'video') continue;
    if (typeof m.url !== 'string' || !m.url.startsWith('https://')) continue;
    if (typeof m.posterUrl !== 'string' || !m.posterUrl.startsWith('https://')) continue;
    raus.push({
      id: m.id,
      art: m.art,
      url: m.url,
      posterUrl: m.posterUrl,
      name: typeof m.name === 'string' ? m.name : m.id,
      nameKey: typeof m.nameKey === 'string' ? m.nameKey : undefined,
      bytes: typeof m.bytes === 'number' ? m.bytes : undefined,
      autor: typeof m.autor === 'string' ? m.autor : undefined,
      lizenz: typeof m.lizenz === 'string' ? m.lizenz : undefined,
      quelle: typeof m.quelle === 'string' ? m.quelle : undefined,
    });
  }
  return raus;
}

/**
 * Holt den Katalog (Netz zuerst, sonst Ablage — dasselbe Muster wie jede
 * andere Liste der App, s. lib/cache.ts).
 */
export async function fetchHintergrundMedien(): Promise<HintergrundMedium[]> {
  const { daten: liste } = await mitAblage('hintergrundmedien', async () => {
    const steuerung = new AbortController();
    const wecker = setTimeout(() => steuerung.abort(), FETCH_TIMEOUT_MS);
    try {
      const antwort = await fetch(INDEX_URL, {
        signal: steuerung.signal,
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
      return pruefeKatalog(await antwort.json());
    } finally {
      clearTimeout(wecker);
    }
  });
  katalog = liste;
  melden();
  return liste;
}

/** Der zuletzt geholte Katalog — `null`, solange nie geholt wurde. */
export function medienKatalog(): HintergrundMedium[] | null {
  return katalog;
}

export function mediumZuId(id: string | null): HintergrundMedium | null {
  if (!id) return null;
  return katalog?.find((m) => m.id === id) ?? null;
}

export function istGespeichert(id: string): boolean {
  return speicher[id] !== undefined;
}

/**
 * Die Adresse zum Abspielen: die lokale Datei, wenn sie da ist — sonst `null`.
 *
 * BEWUSST kein Rueckfall auf die Netzadresse: ein Hintergrund laeuft
 * stundenlang, ein Stream als „Rueckfall" waere genau der Dauerverbrauch, den
 * das Herunterladen vermeidet. Solange nichts gespeichert ist, zeigt der
 * Hintergrund sein Standbild (das ist klein und kommt aus dem Bildspeicher).
 */
export function abspielAdresse(m: HintergrundMedium): string | null {
  return istGespeichert(m.id) ? datei(m) : null;
}

/**
 * Laedt ein Motiv auf das Geraet. `onFortschritt` bekommt 0…1.
 *
 * Erst in eine Zwischendatei, dann umbenennen — bricht der Download ab, liegt
 * keine halbe Datei da, die spaeter als vollstaendig gilt (gleiche Vorsicht
 * wie in lib/offlineAudio.ts).
 */
export async function mediumHerunterladen(
  m: HintergrundMedium,
  onFortschritt?: (anteil: number) => void,
): Promise<void> {
  if (!medienSpeicherMoeglich()) throw new Error('kein_dateisystem');
  await hydrateHintergrundMedien();
  await FileSystem.makeDirectoryAsync(ORDNER, { intermediates: true }).catch(() => {});

  const ziel = datei(m);
  const zwischen = `${ziel}.teil`;
  await FileSystem.deleteAsync(zwischen, { idempotent: true }).catch(() => {});

  const auftrag = FileSystem.createDownloadResumable(m.url, zwischen, {}, (p) => {
    if (p.totalBytesExpectedToWrite > 0) {
      onFortschritt?.(p.totalBytesWritten / p.totalBytesExpectedToWrite);
    }
  });
  const ergebnis = await auftrag.downloadAsync();
  if (!ergebnis?.uri) throw new Error('download_fehlgeschlagen');

  const info = await FileSystem.getInfoAsync(zwischen);
  // Unter 20 KB ist kein Bild und erst recht kein Video, sondern eine
  // Fehlerseite mit Status 200.
  if (!info.exists || (info.size ?? 0) < 20_000) {
    await FileSystem.deleteAsync(zwischen, { idempotent: true }).catch(() => {});
    throw new Error('datei_unbrauchbar');
  }
  await FileSystem.deleteAsync(ziel, { idempotent: true }).catch(() => {});
  await FileSystem.moveAsync({ from: zwischen, to: ziel });

  speicher = { ...speicher, [m.id]: { id: m.id, bytes: info.size ?? 0, t: Date.now() } };
  await schreibeSpeicher();
  melden();
}

export async function mediumLoeschen(m: HintergrundMedium): Promise<void> {
  await hydrateHintergrundMedien();
  await FileSystem.deleteAsync(datei(m), { idempotent: true }).catch(() => {});
  const rest = { ...speicher };
  delete rest[m.id];
  speicher = rest;
  await schreibeSpeicher();
  melden();
}

/** Belegung der Hintergrund-Motive — steht neben der der Rezitationen. */
export function medienBelegung(): { anzahl: number; bytes: number } {
  const alle = Object.values(speicher);
  return { anzahl: alle.length, bytes: alle.reduce((s, e) => s + e.bytes, 0) };
}

/**
 * Raeumt Eintraege auf, deren Datei nicht mehr da ist (Systemeinstellung
 * „Speicher leeren" loescht die Dateien, nicht das Verzeichnis).
 */
export async function verwaisteMedienAufraeumen(): Promise<number> {
  await hydrateHintergrundMedien();
  if (!medienSpeicherMoeglich()) return 0;
  let weg = 0;
  const rest: Speicher = {};
  for (const [id, e] of Object.entries(speicher)) {
    const m = katalog?.find((x) => x.id === id);
    // Ohne Katalog laesst sich der Dateiname nicht bilden — dann lieber
    // stehen lassen als raten.
    const pfad = m ? datei(m) : null;
    if (!pfad) {
      rest[id] = e;
      continue;
    }
    const info = await FileSystem.getInfoAsync(pfad).catch(() => null);
    if (info?.exists) rest[id] = e;
    else weg++;
  }
  if (weg > 0) {
    speicher = rest;
    await schreibeSpeicher();
    melden();
  }
  return weg;
}

interface MedienStand {
  katalog: HintergrundMedium[] | null;
  speicher: Speicher;
}

let stand: MedienStand = { katalog: null, speicher: {} };

function lesen(): MedienStand {
  // Ein neues Objekt NUR, wenn sich wirklich etwas geaendert hat:
  // `useSyncExternalStore` vergleicht mit `Object.is` und liefe sonst in eine
  // Endlosschleife.
  if (stand.katalog !== katalog || stand.speicher !== speicher) {
    stand = { katalog, speicher };
  }
  return stand;
}

/** Reaktiver Zugriff auf Katalog und Speicherstand. */
export function useHintergrundMedien(): MedienStand {
  return useSyncExternalStore(abonnieren, lesen, lesen);
}

/** Nur fuer Tests. */
export function zuruecksetzenFuerTest(): void {
  katalog = null;
  speicher = {};
  geladen = false;
  stand = { katalog: null, speicher: {} };
  hoerer.clear();
}
