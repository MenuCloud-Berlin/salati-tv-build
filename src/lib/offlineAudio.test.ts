/**
 * Gespeicherte Rezitationen. Geprüft wird, worauf sich der Nutzer verlässt:
 * dass eine gespeicherte Sure wirklich von der Platte kommt, dass ein
 * abgebrochener Download NICHTS Halbes hinterlässt, und dass ein Eintrag ohne
 * Datei nicht als „gespeichert" stehen bleibt — der führte sonst zu einer
 * stummen Wiedergabe ohne jede Fehlermeldung.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import {
  abspielAdresse,
  alleLoeschen,
  belegung,
  formatBytes,
  gespeicherteListe,
  hydrateOfflineAudio,
  istGespeichert,
  sureHerunterladen,
  sureLoeschen,
  verwaisteEintraegeAufraeumen,
} from '@/lib/offlineAudio';

const NETZ = 'https://server.test/001.mp3';

// Namen mit `mock`-Praefix: nur die duerfen in einer jest.mock-Fabrik stehen
// (gleiche Regel wie in screens/navigation.test.tsx).
/** Dateien, die auf der Attrappen-Platte liegen: Pfad → Groesse. */
let mockPlatte = new Map<string, number>();
/** Was der naechste Download schreibt; 0 = Download schlaegt fehl. */
let mockGroesse = 5_000_000;

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  makeDirectoryAsync: jest.fn(async () => {}),
  deleteAsync: jest.fn(async (uri: string) => {
    mockPlatte.delete(uri);
  }),
  moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    const g = mockPlatte.get(from);
    if (g === undefined) throw new Error('nicht da');
    mockPlatte.delete(from);
    mockPlatte.set(to, g);
  }),
  getInfoAsync: jest.fn(async (uri: string) => {
    const g = mockPlatte.get(uri);
    return g === undefined ? { exists: false } : { exists: true, size: g };
  }),
  createDownloadResumable: jest.fn(
    (_url: string, ziel: string, _opts: unknown, cb?: (p: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void) => ({
      downloadAsync: async () => {
        if (mockGroesse === 0) throw new Error('netz weg');
        cb?.({ totalBytesWritten: mockGroesse / 2, totalBytesExpectedToWrite: mockGroesse });
        cb?.({ totalBytesWritten: mockGroesse, totalBytesExpectedToWrite: mockGroesse });
        mockPlatte.set(ziel, mockGroesse);
        return { uri: ziel };
      },
    }),
  ),
}));

beforeEach(async () => {
  mockPlatte = new Map();
  mockGroesse = 5_000_000;
  await AsyncStorage.clear();
  await alleLoeschen(); // setzt auch das Verzeichnis im Speicher zurueck
  jest.clearAllMocks();
});

describe('Herunterladen', () => {
  it('legt die Datei ab und merkt sie sich', async () => {
    await sureHerunterladen('12-1', 'Alafasy', 1, NETZ);
    expect(istGespeichert('12-1', 1)).toBe(true);
    expect(belegung()).toEqual({ anzahl: 1, bytes: 5_000_000 });
    expect(gespeicherteListe()[0].reciterName).toBe('Alafasy');
  });

  it('meldet den Fortschritt', async () => {
    const schritte: number[] = [];
    await sureHerunterladen('12-1', 'Alafasy', 1, NETZ, (a) => schritte.push(a));
    expect(schritte).toEqual([0.5, 1]);
  });

  it('spielt danach die lokale Datei statt der Netz-Adresse', async () => {
    expect(abspielAdresse('12-1', 1, NETZ)).toBe(NETZ);
    await sureHerunterladen('12-1', 'Alafasy', 1, NETZ);
    expect(abspielAdresse('12-1', 1, NETZ)).toBe('file:///doc/rezitationen/12-1-001.mp3');
  });

  it('haelt Hafs und Warsh desselben Rezitators auseinander', async () => {
    // Die Kennung ist die AUFNAHME, nicht der Rezitator — sonst ueberschriebe
    // die zweite Riwaya die erste.
    await sureHerunterladen('12-1', 'Alafasy', 1, NETZ);
    await sureHerunterladen('12-2', 'Alafasy', 1, NETZ);
    expect(belegung().anzahl).toBe(2);
    expect(abspielAdresse('12-1', 1, NETZ)).not.toBe(abspielAdresse('12-2', 1, NETZ));
  });

  it('macht aus einer fremden Kennung keinen Pfad', async () => {
    // Die Kennung kommt aus einer fremden API. Ein `/` darin ergaebe einen
    // Pfad in ein Verzeichnis, das es nicht gibt.
    await sureHerunterladen('a/b:c', 'X', 2, NETZ);
    expect(abspielAdresse('a/b:c', 2, NETZ)).toBe('file:///doc/rezitationen/a_b_c-002.mp3');
  });

  it('hinterlaesst bei einem Abbruch nichts Halbes', async () => {
    mockGroesse = 0; // Netz bricht weg
    await expect(sureHerunterladen('12-1', 'Alafasy', 1, NETZ)).rejects.toThrow();
    expect(istGespeichert('12-1', 1)).toBe(false);
    expect([...mockPlatte.keys()]).toEqual([]);
  });

  it('verwirft eine zu kleine Datei, statt sie als Sure auszugeben', async () => {
    // mp3quran liefert bei unbekannten Pfaden HTML mit Status 200. Ohne diese
    // Pruefung staende „gespeichert" an einer Fehlerseite.
    mockGroesse = 4_000;
    await expect(sureHerunterladen('12-1', 'Alafasy', 1, NETZ)).rejects.toThrow('datei_unbrauchbar');
    expect(istGespeichert('12-1', 1)).toBe(false);
    expect([...mockPlatte.keys()]).toEqual([]);
  });
});

describe('Loeschen', () => {
  it('entfernt Datei und Eintrag', async () => {
    await sureHerunterladen('12-1', 'Alafasy', 1, NETZ);
    await sureLoeschen('12-1', 1);
    expect(istGespeichert('12-1', 1)).toBe(false);
    expect([...mockPlatte.keys()]).toEqual([]);
    expect(abspielAdresse('12-1', 1, NETZ)).toBe(NETZ);
  });

  it('raeumt mit „alle loeschen" komplett auf', async () => {
    await sureHerunterladen('12-1', 'A', 1, NETZ);
    await sureHerunterladen('12-1', 'A', 2, NETZ);
    expect(await alleLoeschen()).toBe(2);
    expect(belegung()).toEqual({ anzahl: 0, bytes: 0 });
  });
});

describe('Verwaiste Eintraege', () => {
  it('verwirft Eintraege, deren Datei fehlt — und behaelt die uebrigen', async () => {
    await sureHerunterladen('12-1', 'A', 1, NETZ);
    await sureHerunterladen('12-1', 'A', 2, NETZ);
    // „Speicher leeren" ueber die Systemeinstellungen: Datei weg, Eintrag bleibt.
    mockPlatte.delete('file:///doc/rezitationen/12-1-001.mp3');

    expect(await verwaisteEintraegeAufraeumen()).toBe(1);
    expect(istGespeichert('12-1', 1)).toBe(false);
    expect(istGespeichert('12-1', 2)).toBe(true);
  });

  it('tut nichts, solange alle Dateien liegen', async () => {
    await sureHerunterladen('12-1', 'A', 1, NETZ);
    expect(await verwaisteEintraegeAufraeumen()).toBe(0);
    expect(istGespeichert('12-1', 1)).toBe(true);
  });
});

describe('Verzeichnis ueberlebt den Neustart', () => {
  it('schreibt alles Noetige in den Speicher', async () => {
    await sureHerunterladen('12-1', 'Alafasy', 3, NETZ);
    const roh = await AsyncStorage.getItem('salati-tv-offline-audio-v1');
    expect(roh).not.toBeNull();
    const gelesen = JSON.parse(roh!) as Record<string, { reciterName: string; bytes: number; surah: number }>;
    // Der Anzeigename muss mit: die Speicherliste soll auch ohne Netz lesbar
    // sein, und den Rezitator kennt die App dann nicht mehr.
    expect(gelesen['12-1|3']).toMatchObject({ reciterName: 'Alafasy', surah: 3, bytes: 5_000_000 });
  });

  it('liest einen vorhandenen Stand beim Start wieder ein', async () => {
    // Ein neuer App-Start: frische Modul-Registry, und der Speicher ist VOR dem
    // ersten Zugriff schon gefuellt. `jest.resetModules()` gibt auch dem
    // AsyncStorage-Mock eine neue, leere Instanz — deshalb wird beides aus
    // DERSELBEN Registry geholt und erst danach gefuellt.
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Neustart nachstellen: braucht die frische Registry
    const modul = require('@react-native-async-storage/async-storage') as
      | typeof AsyncStorage
      | { default: typeof AsyncStorage };
    // Der Mock wird je nach Aufloesung als Modul ODER als `default` geliefert.
    const frischerSpeicher = 'setItem' in modul ? modul : modul.default;
    await frischerSpeicher.setItem(
      'salati-tv-offline-audio-v1',
      JSON.stringify({ '9-2|18': { reciterId: '9-2', surah: 18, reciterName: 'Sudais', bytes: 42, t: 1 } }),
    );
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- s. oben
    const frisch = require('@/lib/offlineAudio') as typeof import('@/lib/offlineAudio');
    expect(frisch.istGespeichert('9-2', 18)).toBe(false); // noch nicht geladen
    await frisch.hydrateOfflineAudio();
    expect(frisch.istGespeichert('9-2', 18)).toBe(true);
    expect(frisch.gespeicherteListe()[0].reciterName).toBe('Sudais');
  });
});

describe('formatBytes', () => {
  it.each([
    [512, '512 B'],
    [2048, '2 KB'],
    [5_000_000, '4.8 MB'],
    [150_000_000, '143 MB'],
  ])('%i → %s', (bytes, erwartet) => {
    expect(formatBytes(bytes)).toBe(erwartet);
  });
});

describe('Verfuegbarkeit', () => {
  it('haelt das Verzeichnis nach hydrate bereit', async () => {
    await hydrateOfflineAudio();
    expect(Array.isArray(gespeicherteListe())).toBe(true);
  });

  it('meldet FileSystem als vorhanden', () => {
    expect(FileSystem.documentDirectory).toBe('file:///doc/');
  });
});
