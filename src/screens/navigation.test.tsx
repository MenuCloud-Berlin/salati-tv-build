/**
 * Rueckweg und Sackgassen (Audit 2026-07-29).
 *
 * Die Bereiche mit INTERNEN Stufen (Rezitatoren, Koran-Leser, Video-/Audio-
 * Wiedergabe) fangen die Zurueck-Taste selbst ab und geben sie erst am
 * Wurzelblatt an den App-Root weiter. Bisher deckten die Tests nur den
 * Fokus-Anker ab — ob man aus einer Stufe auch wieder herauskommt, hing an
 * genau einem BackHandler je Screen und war ungetestet (Abdeckung
 * RecitersScreen 57 %, AudioNowPlaying 7 %).
 *
 * Geprueft wird die Kette, auf die sich `App.tsx` verlaesst: `true` = hier
 * verarbeitet, `false` = weiterreichen (der App-Root verlaesst dann den
 * Bereich). Ein Screen, der immer `true` liefert, waere eine Sackgasse.
 */
import { act, fireEvent, render } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import { AudioNowPlaying } from '@/components/AudioNowPlaying';
import { setLanguage } from '@/lib/settings';
import { PodcastsScreen } from '@/screens/PodcastsScreen';
import { RecitersScreen } from '@/screens/RecitersScreen';
import { VideosScreen } from '@/screens/VideosScreen';

// Namen mit `mock`-Praefix: nur die darf eine jest.mock-Fabrik referenzieren.
const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockState = { playing: false };
const mockListeners = new Map<string, (e: unknown) => void>();

jest.mock('expo-video', () => ({
  useVideoPlayer: (_src: unknown, setup?: (p: unknown) => void) => {
    const player = {
      play: mockPlay,
      pause: mockPause,
      replace: jest.fn(),
      addListener: (ev: string, cb: (e: unknown) => void) => {
        mockListeners.set(ev, cb);
        return { remove: jest.fn() };
      },
      get playing() {
        return mockState.playing;
      },
      currentTime: 0,
      loop: false,
    };
    setup?.(player);
    return player;
  },
  VideoView: 'VideoView',
}));
jest.mock('expo-image', () => ({ Image: 'Image' }));

const mockReciters = [
  { id: 1, name: 'Ibrahim Al-Akdar', rewaya: 'Hafs', server: 'https://s/1', surahList: [1, 2] },
];
jest.mock('@/lib/quranAudio', () => ({
  ...jest.requireActual('@/lib/quranAudio'),
  fetchReciters: jest.fn(async () => mockReciters),
  fetchRadios: jest.fn(async () => []),
}));

const mockVideos = [
  {
    episode_no: 1,
    title: 'Erste Folge',
    series_title: 'Reihe A',
    duration_sec: 90,
    video_url: 'https://v/1.mp4',
  },
];
const mockPodcasts = [
  {
    episode_no: 1,
    title: 'Erste Folge',
    series_title: 'Reihe A',
    duration_sec: 714,
    audio_url: 'https://a/1.mp3',
  },
];
jest.mock('@/lib/content', () => ({
  ...jest.requireActual('@/lib/content'),
  fetchVideos: jest.fn(async () => mockVideos),
  fetchPodcasts: jest.fn(async () => mockPodcasts),
  fetchReels: jest.fn(async () => []),
}));

/** Die zuletzt registrierten hardwareBackPress-Handler, neueste zuerst. */
let backHandlers: (() => boolean)[] = [];

beforeEach(() => {
  // Feste Oberflaechensprache — sonst haengen die erwarteten Texte an der
  // Systemsprache des Testlaeufers (detectDeviceLocale).
  setLanguage('de');
  backHandlers = [];
  mockState.playing = false;
  mockPlay.mockClear();
  mockPause.mockClear();
  mockListeners.clear();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_ev: string, cb: () => boolean) => {
    backHandlers.unshift(cb);
    return { remove: () => void (backHandlers = backHandlers.filter((h) => h !== cb)) };
  }) as unknown as typeof BackHandler.addEventListener);
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Loest die Zurueck-Taste aus und liefert, ob der Screen sie verarbeitet hat. */
async function pressBack(): Promise<boolean> {
  let handled = false;
  await act(async () => {
    handled = backHandlers[0]?.() ?? false;
  });
  return handled;
}

describe('Rezitatoren: jede Stufe hat einen Rueckweg', () => {
  it('play -> Suren -> Rezitatoren -> weiterreichen an den App-Root', async () => {
    const r = await render(<RecitersScreen />);
    expect(r.getByText('Ibrahim Al-Akdar')).toBeTruthy();

    // Rezitator -> Suren-Liste
    await fireEvent.press(r.getByText('Ibrahim Al-Akdar'));
    expect(r.getByText('Al-Faatiha')).toBeTruthy();

    // Sure -> Wiedergabe
    await fireEvent.press(r.getByText('Al-Faatiha'));
    expect(r.getByText('1. Al-Faatiha')).toBeTruthy();

    // Zurueck: Wiedergabe -> Suren
    expect(await pressBack()).toBe(true);
    expect(r.getByText('Al-Faatiha')).toBeTruthy();
    // Zurueck: Suren -> Rezitatoren
    expect(await pressBack()).toBe(true);
    expect(r.getByText('Ibrahim Al-Akdar')).toBeTruthy();
    // Am Wurzelblatt NICHT mehr selbst verarbeiten — sonst kaeme man aus dem
    // Bereich nie heraus (Sackgasse).
    expect(await pressBack()).toBe(false);
  });
});

describe('Videos: Wiedergabe und Rueckweg', () => {
  it('startet die Wiedergabe und kehrt mit Zurueck zur Liste', async () => {
    const r = await render(<VideosScreen />);
    expect(r.getByText('Reihe A')).toBeTruthy();
    await fireEvent.press(r.getByText('Erste Folge'));
    expect(r.queryByText('Reihe A')).toBeNull(); // Vollbild-Player
    expect(await pressBack()).toBe(true);
    expect(r.getByText('Reihe A')).toBeTruthy();
    expect(await pressBack()).toBe(false); // Liste -> App-Root
  });

  it('meldet die Dauer einzeilig (die Karte hat dafuer nur eine Zeile)', async () => {
    const r = await render(<VideosScreen />);
    expect(r.getByText('1:30').props.numberOfLines).toBe(1);
  });
});

describe('Podcasts: Wiedergabe und Rueckweg', () => {
  it('spielt eine Folge und kehrt mit Zurueck zur Liste', async () => {
    const r = await render(<PodcastsScreen />);
    await fireEvent.press(r.getByText('Erste Folge'));
    expect(mockPlay).toHaveBeenCalled();
    expect(await pressBack()).toBe(true);
    expect(r.getByText('Reihe A')).toBeTruthy();
  });

  // Bildschirmbefund Audit 2026-07-29: „Episode 1 · 11:54" brach auf der
  // schmalen Karte um und lief unten aus der Karte heraus.
  it('gibt der Folgenzeile zwei Zeilen', async () => {
    const r = await render(<PodcastsScreen />);
    expect(r.getByText(/11:54/).props.numberOfLines).toBe(2);
  });
});

describe('Audio-Wiedergabe (Rezitation/Radio/Podcast)', () => {
  it('startet von selbst und schaltet mit OK auf Pause', async () => {
    const r = await render(<AudioNowPlaying uri="https://a/1.mp3" title="Titel" subtitle="Unter" />);
    expect(mockPlay).toHaveBeenCalled();
    // Solange der Player laedt, steht dort ein Ladekringel und kein Symbol.
    mockState.playing = true;
    await act(async () => {
      mockListeners.get('statusChange')?.({ status: 'readyToPlay' });
      mockListeners.get('playingChange')?.({ isPlaying: true });
    });
    await fireEvent.press(r.getByText('❚❚'));
    expect(mockPause).toHaveBeenCalled();
  });

  it('meldet einen Abspielfehler im Klartext statt still stehenzubleiben', async () => {
    const r = await render(<AudioNowPlaying uri="https://a/1.mp3" title="Titel" />);
    await act(async () => {
      mockListeners.get('statusChange')?.({ status: 'error' });
    });
    expect(r.getByText('Wiedergabe fehlgeschlagen — Verbindung prüfen.')).toBeTruthy();
  });

  it('zeigt den Kicker der jeweiligen Quelle', async () => {
    const radio = await render(<AudioNowPlaying uri="u" title="T" loop />);
    expect(radio.getByText('Koran-Radio')).toBeTruthy();
    const rezitation = await render(<AudioNowPlaying uri="u" title="T" />);
    expect(rezitation.getByText('Rezitation')).toBeTruthy();
  });
});
