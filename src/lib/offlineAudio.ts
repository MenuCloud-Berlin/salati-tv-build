import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Rezitationen auf dem Fernseher speichern — eine Sure je Datei.
 *
 * WARUM DAS HIER EINFACHER IST ALS IN DER HANDY-APP: Die Handy-App laedt fuer
 * Offline-Audio die VERS-Schnipsel (bei Al-Baqara 286 Dateien) — sie braucht
 * sie fuer die Vers-Wiederholung beim Auswendiglernen. Der Fernseher spielt
 * dagegen die Voll-Suren-Datei von mp3quran.net: eine URL, eine Datei, eine
 * ganze Rezitation. Fuer „zurueckgelehnt zuhoeren" ist das genau richtig, und
 * offline heisst hier deshalb: EIN Download je Sure.
 *
 * WAS GESPEICHERT WIRD: die Datei im Dokumentverzeichnis der App (bei einer
 * Deinstallation also weg, kein verwaister Ballast auf dem Geraet), plus ein
 * Verzeichnis in AsyncStorage mit Groesse und Zeitpunkt. Das Verzeichnis ist
 * die WAHRHEIT fuer die Anzeige; ob die Datei wirklich liegt, wird beim
 * Abspielen geprueft — ein von aussen geloeschter Speicher soll nicht zu einer
 * stummen Wiedergabe fuehren.
 *
 * KEINE AUTOMATIK: Es wird nichts im Hintergrund geladen. Ein Fernseher haengt
 * oft an einem Anschluss, den sich mehrere teilen; eine App, die von selbst
 * hunderte Megabyte zieht, ist ein schlechter Gast. Der Nutzer entscheidet je
 * Sure.
 */

const INDEX_KEY = 'salati-tv-offline-audio-v1';
const ORDNER = `${FileSystem.documentDirectory ?? ''}rezitationen/`;

export interface GespeicherteSure {
  /**
   * Kennung der AUFNAHME, nicht des Rezitators: `<rezitator>-<moshaf>` (s.
   * `parseReciters`). Hafs und Warsh desselben Rezitators sind verschiedene
   * Aufnahmen und muessen sich getrennt speichern und loeschen lassen.
   */
  reciterId: string;
  surah: number;
  /** Anzeigename des Rezitators — damit die Speicherliste ohne Netz lesbar ist. */
  reciterName: string;
  bytes: number;
  /** Zeitpunkt des Downloads (ms). */
  t: number;
}

type Index = Record<string, GespeicherteSure>;

function schluessel(reciterId: string, surah: number): string {
  return `${reciterId}|${surah}`;
}

/**
 * Dateiname. Die Kennung wird auf harmlose Zeichen beschraenkt: sie kommt aus
 * einer fremden API, und ein `/` darin ergaebe einen Pfad in ein Verzeichnis,
 * das es nicht gibt (der Download schluege fehl, ohne dass man saehe warum).
 */
function dateiname(reciterId: string, surah: number): string {
  const sicher = reciterId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${ORDNER}${sicher}-${String(surah).padStart(3, '0')}.mp3`;
}

let index: Index = {};
let geladen = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

async function schreibeIndex() {
  try {
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    /* ignorieren — die Datei liegt, nur das Verzeichnis hinkt */
  }
}

/** Laedt das Verzeichnis einmalig. Idempotent. */
export async function hydrateOfflineAudio(): Promise<void> {
  if (geladen) return;
  geladen = true;
  try {
    const roh = await AsyncStorage.getItem(INDEX_KEY);
    if (roh) index = JSON.parse(roh) as Index;
  } catch {
    index = {};
  }
  emit();
}

/** Ist die Wiedergabe auf diesem Geraet moeglich? Auf Web gibt es kein
 *  Dateisystem — dort bleibt der Knopf weg statt ins Leere zu greifen. */
export function offlineAudioMoeglich(): boolean {
  return !!FileSystem.documentDirectory;
}

export function istGespeichert(reciterId: string, surah: number): boolean {
  return index[schluessel(reciterId, surah)] !== undefined;
}

/**
 * Die Adresse, unter der die Sure abgespielt wird: die lokale Datei, wenn sie
 * gespeichert ist, sonst die Netz-Adresse.
 */
export function abspielAdresse(reciterId: string, surah: number, netzUrl: string): string {
  return istGespeichert(reciterId, surah) ? dateiname(reciterId, surah) : netzUrl;
}

export function gespeicherteListe(): GespeicherteSure[] {
  return Object.values(index).sort((a, b) => b.t - a.t);
}

export function belegung(): { anzahl: number; bytes: number } {
  const alle = Object.values(index);
  return { anzahl: alle.length, bytes: alle.reduce((s, e) => s + e.bytes, 0) };
}

/**
 * Laedt eine Sure herunter.
 *
 * `onFortschritt` bekommt 0…1 — auf dem Fernseher ist das wichtig: eine
 * Voll-Suren-Datei ist je nach Sure 1 bis 90 MB, und ein Knopf, der minutenlang
 * nur „bitte warten" sagt, sieht aus wie ein Absturz.
 *
 * Erst in eine Zwischendatei, dann umbenennen: bricht der Download ab (Netz
 * weg, Strom weg), liegt keine halbe Datei da, die spaeter als vollstaendig
 * gilt und beim Abspielen mitten im Vers endet.
 */
export async function sureHerunterladen(
  reciterId: string,
  reciterName: string,
  surah: number,
  netzUrl: string,
  onFortschritt?: (anteil: number) => void,
): Promise<void> {
  if (!offlineAudioMoeglich()) throw new Error('kein_dateisystem');
  await hydrateOfflineAudio();
  await FileSystem.makeDirectoryAsync(ORDNER, { intermediates: true }).catch(() => {});

  const ziel = dateiname(reciterId, surah);
  const zwischen = `${ziel}.teil`;
  await FileSystem.deleteAsync(zwischen, { idempotent: true }).catch(() => {});

  const auftrag = FileSystem.createDownloadResumable(netzUrl, zwischen, {}, (p) => {
    if (p.totalBytesExpectedToWrite > 0) {
      onFortschritt?.(p.totalBytesWritten / p.totalBytesExpectedToWrite);
    }
  });
  const ergebnis = await auftrag.downloadAsync();
  if (!ergebnis?.uri) throw new Error('download_fehlgeschlagen');

  const info = await FileSystem.getInfoAsync(zwischen);
  // Eine MP3 unter 100 KB ist keine Sure, sondern eine Fehlerseite — mp3quran
  // liefert bei unbekannten Pfaden HTML mit Status 200.
  if (!info.exists || (info.size ?? 0) < 100_000) {
    await FileSystem.deleteAsync(zwischen, { idempotent: true }).catch(() => {});
    throw new Error('datei_unbrauchbar');
  }

  await FileSystem.deleteAsync(ziel, { idempotent: true }).catch(() => {});
  await FileSystem.moveAsync({ from: zwischen, to: ziel });

  index = {
    ...index,
    [schluessel(reciterId, surah)]: { reciterId, surah, reciterName, bytes: info.size ?? 0, t: Date.now() },
  };
  await schreibeIndex();
  emit();
}

export async function sureLoeschen(reciterId: string, surah: number): Promise<void> {
  await hydrateOfflineAudio();
  await FileSystem.deleteAsync(dateiname(reciterId, surah), { idempotent: true }).catch(() => {});
  const rest = { ...index };
  delete rest[schluessel(reciterId, surah)];
  index = rest;
  await schreibeIndex();
  emit();
}

/** Alles loeschen — der Weg aus den Einstellungen, wenn der Speicher voll ist. */
export async function alleLoeschen(): Promise<number> {
  await hydrateOfflineAudio();
  const anzahl = Object.keys(index).length;
  await FileSystem.deleteAsync(ORDNER, { idempotent: true }).catch(() => {});
  index = {};
  await schreibeIndex();
  emit();
  return anzahl;
}

/**
 * Raeumt Eintraege auf, deren Datei nicht mehr da ist.
 *
 * Android loescht das Dokumentverzeichnis einer App nicht von selbst, aber der
 * Nutzer kann es ueber die Systemeinstellungen („Speicher leeren"). Dann stuende
 * im Verzeichnis „gespeichert", und die Wiedergabe liefe auf eine Datei, die es
 * nicht gibt — stumm, ohne Fehlermeldung.
 */
export async function verwaisteEintraegeAufraeumen(): Promise<number> {
  await hydrateOfflineAudio();
  const eintraege = Object.entries(index);
  if (eintraege.length === 0) return 0;
  const behalten: Index = {};
  let weg = 0;
  for (const [key, wert] of eintraege) {
    const info = await FileSystem.getInfoAsync(dateiname(wert.reciterId, wert.surah)).catch(() => null);
    if (info?.exists) behalten[key] = wert;
    else weg++;
  }
  if (weg > 0) {
    index = behalten;
    await schreibeIndex();
    emit();
  }
  return weg;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot() {
  return index;
}

/** Reaktiver Zugriff auf das Verzeichnis — Bildschirme aktualisieren sich,
 *  sobald ein Download fertig oder ein Eintrag geloescht ist. */
export function useOfflineAudio(): Index {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Menschenlesbare Groesse. Bewusst hier und nicht im Bildschirm: die
 *  Speicher-Anzeige gibt es an zwei Stellen. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return mb < 100 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
}
