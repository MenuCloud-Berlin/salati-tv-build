// Wiedergabe des Gebetsrufs: was passiert, wenn er startet, endet, abgebrochen
// wird — und wenn ein zweiter dazukommt. Getrennt von `azan.test.ts`, weil
// hier ein Spieler-Mock mit Zustand noetig ist.

const mockSpieler: {
  volume: number;
  loop: boolean;
  play: jest.Mock;
  pause: jest.Mock;
  release: jest.Mock;
  hoerer: Map<string, () => void>;
}[] = [];

const mockCreate = jest.fn(() => {
  const p = {
    volume: 0,
    loop: true,
    play: jest.fn(),
    pause: jest.fn(),
    release: jest.fn(),
    hoerer: new Map<string, () => void>(),
    addListener(ev: string, cb: () => void) {
      this.hoerer.set(ev, cb);
      return { remove: jest.fn() };
    },
  };
  mockSpieler.push(p);
  return p;
});

// Die Fabrik wird beim IMPORT von azanRuf ausgefuehrt — also bevor die
// `const`-Deklarationen oben gelaufen sind (Babel zieht Importe nach oben).
// Deshalb hier eine Weiterleitung statt einer direkten Referenz: sie liest
// `mockCreate` erst beim Aufruf, nicht beim Erzeugen der Attrappe.
jest.mock('expo-video', () => ({ createVideoPlayer: (...a: unknown[]) => mockCreate(...(a as [])) }));

import { azanLaeuft, azanSpielen, azanStoppen } from '@/lib/azanRuf';
import { abspielen, zuruecksetzenFuerTest } from '@/lib/hintergrundAudio';

const RUF = { prayer: 'maghrib' as const, choice: 'adhan1' as const, zeit: new Date(2026, 7, 8, 20, 45) };

beforeEach(() => {
  azanStoppen();
  zuruecksetzenFuerTest();
  mockSpieler.length = 0;
  mockCreate.mockClear();
});

it('startet die Wiedergabe mit der eingestellten Lautstaerke und ohne Wiederholung', () => {
  azanSpielen(RUF, 0.6);
  expect(mockSpieler).toHaveLength(1);
  expect(mockSpieler[0].volume).toBe(0.6);
  // Ein Gebetsruf in Endlosschleife waere ein Defekt, kein Merkmal.
  expect(mockSpieler[0].loop).toBe(false);
  expect(mockSpieler[0].play).toHaveBeenCalled();
  expect(azanLaeuft()).toBe(true);
});

it('begrenzt die Lautstaerke auf 0 bis 1', () => {
  azanSpielen(RUF, 4);
  expect(mockSpieler[0].volume).toBe(1);
});

it('beendet den laufenden Ruf, bevor ein zweiter beginnt', () => {
  azanSpielen(RUF, 1);
  azanSpielen({ ...RUF, prayer: 'isha', choice: 'adhan2' }, 1);
  expect(mockSpieler).toHaveLength(2);
  // Der erste ist wirklich weg — nicht nur „nicht mehr gemeint".
  expect(mockSpieler[0].pause).toHaveBeenCalled();
  expect(mockSpieler[0].release).toHaveBeenCalled();
  expect(azanLaeuft()).toBe(true);
});

it('raeumt am Ende der Aufnahme von selbst auf', () => {
  azanSpielen(RUF, 1);
  mockSpieler[0].hoerer.get('playToEnd')?.();
  expect(azanLaeuft()).toBe(false);
  expect(mockSpieler[0].release).toHaveBeenCalled();
});

it('haelt die Uhr am Laufen, wenn der Spieler nicht startet', () => {
  mockCreate.mockImplementationOnce(() => {
    throw new Error('kein Audio-Geraet');
  });
  expect(() => azanSpielen(RUF, 1)).not.toThrow();
  expect(azanLaeuft()).toBe(false);
});

it('vertraegt ein Stoppen ohne laufenden Ruf', () => {
  expect(() => azanStoppen()).not.toThrow();
  expect(azanLaeuft()).toBe(false);
});

it('haelt eine laufende Rezitation an, wenn der Gebetsruf kommt', () => {
  // Seit 1.9.0 ueberlebt die Rezitation den Bildschirmwechsel — sie kann also
  // noch laufen, wenn die Gebetszeit erreicht ist. Zwei Stimmen uebereinander
  // waeren fuer den Nutzer schlimmer als gar kein Ruf.
  abspielen({ uri: 'https://a/sure.mp3', title: 'Al-Faatiha', loop: false, quelle: 'reciters' });
  const rezitation = mockSpieler[0];
  // Der native Spieler meldet, dass er wirklich spielt.
  (rezitation.hoerer.get('playingChange') as unknown as (e: { isPlaying: boolean }) => void)?.({
    isPlaying: true,
  });

  azanSpielen(RUF, 1);

  expect(rezitation.pause).toHaveBeenCalled();
  // Nur angehalten, NICHT freigegeben: nach dem Ruf soll der Nutzer dort
  // weiterhoeren, wo er war.
  expect(rezitation.release).not.toHaveBeenCalled();
});
