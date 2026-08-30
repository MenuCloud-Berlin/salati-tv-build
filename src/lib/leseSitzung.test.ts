/**
 * Die Lesung, die den Bildschirm ueberlebt.
 *
 * Der Nutzerbefund vom 2026-08-30 lautete: „im Hintergrund Koran hoeren und
 * vorne die Gebetsuhr" ging nicht — nur das Radio lief weiter. Der Grund war,
 * dass die Weiterschaltung von Vers zu Vers im Lese-BILDSCHIRM hing. Hier wird
 * deshalb genau das geprueft, was ohne Bildschirm geschehen muss: der naechste
 * Vers, das Wiederholen und der Uebergang auf die naechste Sure.
 */
import type { ReaderVerse } from '@/lib/quranText';

const mockAbspielen = jest.fn();
const mockVonVorn = jest.fn();
const mockBeenden = jest.fn();
let mockStueck: { quelle: string } | null = { quelle: 'quran' };

jest.mock('@/lib/hintergrundAudio', () => ({
  abspielen: (...a: unknown[]) => mockAbspielen(...a),
  vonVorn: () => mockVonVorn(),
  beenden: () => mockBeenden(),
  zustandLesen: () => ({ stueck: mockStueck, spielt: true, status: 'readyToPlay' }),
}));

const mockFetch = jest.fn();
jest.mock('@/lib/quranText', () => ({
  ...jest.requireActual('@/lib/quranText'),
  fetchSurahReader: (...a: unknown[]) => mockFetch(...a),
}));

import {
  leseStand,
  nochmalVersuchen,
  sureOeffnen,
  versSpringen,
  wiederholenUmschalten,
  zuruecksetzenFuerTest,
} from '@/lib/leseSitzung';
import { setReaderOptions, hydrateTvSettings } from '@/lib/settings';

function verse(anzahl: number, sure: number): ReaderVerse[] {
  return Array.from({ length: anzahl }, (_, i) => ({
    n: i + 1,
    words: [{ ar: 'ا', translit: 'a' }],
    translation: `Vers ${i + 1}`,
    audioUrl: `https://a/${sure}-${i + 1}.mp3`,
    segments: [],
  }));
}

/** Der Ende-Rueckruf, den die Sitzung dem Spieler mitgegeben hat. */
function versEnde(): () => void {
  const letzte = mockAbspielen.mock.calls.at(-1);
  return (letzte?.[1] as { beiEnde: () => void }).beiEnde;
}

beforeEach(async () => {
  zuruecksetzenFuerTest();
  mockAbspielen.mockClear();
  mockVonVorn.mockClear();
  mockBeenden.mockClear();
  mockStueck = { quelle: 'quran' };
  await hydrateTvSettings();
  setReaderOptions({ readerAutoAdvance: true });
  mockFetch.mockImplementation(async (sure: number) => verse(3, sure));
});

it('spielt nach dem Oeffnen den ersten Vers', async () => {
  sureOeffnen(2, 'de');
  await Promise.resolve();
  await Promise.resolve();
  expect(leseStand().verses).toHaveLength(3);
  expect(mockAbspielen.mock.calls[0][0]).toMatchObject({ uri: 'https://a/2-1.mp3', quelle: 'quran' });
});

it('schaltet ohne Bildschirm auf den naechsten Vers weiter', async () => {
  sureOeffnen(2, 'de');
  await Promise.resolve();
  await Promise.resolve();
  versEnde()();
  expect(leseStand().idx).toBe(1);
  expect(mockAbspielen.mock.calls.at(-1)![0]).toMatchObject({ uri: 'https://a/2-2.mp3' });
});

it('wiederholt denselben Vers, wenn „Wiederholen" an ist', async () => {
  sureOeffnen(2, 'de');
  await Promise.resolve();
  await Promise.resolve();
  wiederholenUmschalten();
  versEnde()();
  expect(mockVonVorn).toHaveBeenCalledTimes(1);
  expect(leseStand().idx).toBe(0);
});

it('geht am Surenende auf die naechste Sure — aber nur mit Auto-Weiter', async () => {
  setReaderOptions({ readerAutoAdvance: false });
  sureOeffnen(2, 'de');
  await Promise.resolve();
  await Promise.resolve();
  versSpringen(2);
  const ende = versEnde();
  ende();
  expect(leseStand().surah).toBe(2);

  setReaderOptions({ readerAutoAdvance: true });
  ende();
  await Promise.resolve();
  await Promise.resolve();
  expect(leseStand().surah).toBe(3);
  expect(leseStand().idx).toBe(0);
});

it('laesst das Versende liegen, wenn inzwischen das Radio laeuft', async () => {
  sureOeffnen(2, 'de');
  await Promise.resolve();
  await Promise.resolve();
  const ende = versEnde();
  mockStueck = { quelle: 'radio' };
  ende();
  expect(leseStand().idx).toBe(0);
  expect(mockAbspielen).toHaveBeenCalledTimes(1);
});

it('faengt dieselbe Sure nicht von vorn an — Rueckkehr aus der Uhr', async () => {
  sureOeffnen(2, 'de');
  await Promise.resolve();
  await Promise.resolve();
  versSpringen(1);
  mockAbspielen.mockClear();
  sureOeffnen(2, 'de');
  expect(mockAbspielen).not.toHaveBeenCalled();
  expect(leseStand().idx).toBe(1);
});

it('meldet einen Ladefehler und laesst ihn wiederholen', async () => {
  mockFetch.mockImplementationOnce(async () => {
    throw new Error('kein Netz');
  });
  sureOeffnen(5, 'de');
  await Promise.resolve();
  await Promise.resolve();
  expect(leseStand().fehler).toBe(true);

  nochmalVersuchen();
  await Promise.resolve();
  await Promise.resolve();
  expect(leseStand().fehler).toBe(false);
  expect(leseStand().verses).toHaveLength(3);
});
