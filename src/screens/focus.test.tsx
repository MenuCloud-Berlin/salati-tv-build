/**
 * DER Kern-Test der TV-App: Bedienbarkeit mit der Fernbedienung.
 *
 * Auf Android TV / Fire TV steuert das System den Fokus zwischen fokussierbaren
 * Views. Ein Bildschirm OHNE ein einziges fokussierbares Element hat keinen
 * Fokus-Anker — D-Pad und OK laufen ins Leere, der Bildschirm fuehlt sich tot
 * an. Genau das ist in diesem Projekt am 2026-07-24 am Clock-Screensaver
 * passiert (deshalb das `hasTVPreferredFocus` in App.tsx).
 *
 * Der Audit vom 2026-07-28 fand dieselbe Luecke in sieben weiteren Zustaenden
 * (Pairing-Screen komplett, Quiz-Ergebnis sowie Lade- UND Fehlerzustand aller
 * sechs Netz-Screens). Dieser Test rastert deshalb JEDEN Screen in JEDEM
 * Zustand systematisch ab, statt Einzelfaelle zu pruefen.
 */
import { act, fireEvent, render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ClockScreen } from '@/screens/ClockScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { PairingScreen } from '@/screens/PairingScreen';
import { PodcastsScreen } from '@/screens/PodcastsScreen';
import { QuizScreen } from '@/screens/QuizScreen';
import { QuranReaderScreen } from '@/screens/QuranReaderScreen';
import { RadioScreen } from '@/screens/RadioScreen';
import { RecitersScreen } from '@/screens/RecitersScreen';
import { ReelsScreen } from '@/screens/ReelsScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { VideosScreen } from '@/screens/VideosScreen';
import { zuruecksetzenFuerTest as leseZuruecksetzen } from '@/lib/leseSitzung';

jest.mock('expo-video', () => {
  // Eine Spieler-Attrappe, die ihre Zuhoerer wirklich benachrichtigt: die
  // Wiedergabe-Anzeige des Lesers haengt seit 2026-08-30 am gemeinsamen
  // Spieler (lib/hintergrundAudio.ts) und nicht mehr an einem eigenen Zustand
  // des Bildschirms. Eine stumme Attrappe zeigte „pausiert", obwohl spielt.
  const bau = () => {
    const hoerer: Record<string, ((e: unknown) => void)[]> = {};
    const rufe = (name: string, e: unknown) => (hoerer[name] ?? []).forEach((cb) => cb(e));
    const p = {
      playing: false,
      currentTime: 0,
      loop: false,
      volume: 1,
      addListener: (name: string, cb: (e: unknown) => void) => {
        (hoerer[name] ??= []).push(cb);
        return { remove: jest.fn() };
      },
      play: jest.fn(() => {
        p.playing = true;
        rufe('playingChange', { isPlaying: true });
      }),
      pause: jest.fn(() => {
        p.playing = false;
        rufe('playingChange', { isPlaying: false });
      }),
      release: jest.fn(),
      replace: jest.fn(),
      seekBy: jest.fn(),
    };
    return p;
  };
  return { createVideoPlayer: () => bau(), useVideoPlayer: () => bau(), VideoView: 'VideoView' };
});
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('react-native-qrcode-svg', () => 'QRCode');

// Netz-Abrufe: nie echte Requests im Test. Ein Promise, das nie aufloest,
// haelt die Screens im LADEZUSTAND fest — genau dem Zustand, der bis zum
// 2026-07-28 keinen Fokus-Anker hatte.
const pending = () => new Promise<never>(() => {});
jest.mock('@/lib/content', () => ({
  ...jest.requireActual('@/lib/content'),
  fetchVideos: jest.fn(pending),
  fetchReels: jest.fn(pending),
  fetchPodcasts: jest.fn(pending),
}));
jest.mock('@/lib/quranAudio', () => ({
  ...jest.requireActual('@/lib/quranAudio'),
  fetchReciters: jest.fn(pending),
  fetchRadios: jest.fn(pending),
}));
jest.mock('@/lib/quranText', () => ({
  ...jest.requireActual('@/lib/quranText'),
  fetchSurahReader: jest.fn(pending),
}));

interface JsonNode {
  type: string;
  props: Record<string, unknown>;
  children: (JsonNode | string)[] | null;
}

function walk(node: JsonNode | string | null, out: JsonNode[] = []): JsonNode[] {
  if (!node || typeof node === 'string') return out;
  out.push(node);
  for (const c of node.children ?? []) walk(c, out);
  return out;
}

/** Fokussierbar im Sinne von react-native-tvos: Pressable rendert eine Host-View
 *  mit `focusable: true`; `hasTVPreferredFocus` markiert den Initialfokus. */
async function focusReport(ui: ReactElement) {
  const r = await render(ui);
  const nodes = walk(r.toJSON() as unknown as JsonNode);
  return {
    focusable: nodes.filter((n) => n.props.focusable === true).length,
    preferred: nodes.filter((n) => n.props.hasTVPreferredFocus === true).length,
  };
}

/** Mindestens ein fokussierbares Element UND genau ein Initialfokus. Ohne
 *  Initialfokus startet der Screen auf manchen Android-TV-Firmwares ganz ohne
 *  Fokus — der Fund vom 2026-07-24. */
async function expectRemoteUsable(ui: ReactElement) {
  const r = await focusReport(ui);
  expect(r.focusable).toBeGreaterThan(0);
  expect(r.preferred).toBe(1);
}

// Die Lesung lebt modulweit (lib/leseSitzung.ts): ohne Ruecksetzen uebersaenge
// der Leser im naechsten Test die Suren-Auswahl.
beforeEach(() => leseZuruecksetzen());

describe('Fernbedienbarkeit: jeder Screen hat einen Fokus-Anker', () => {
  it('Home-Hub', async () => {
    await expectRemoteUsable(<HomeScreen navigate={jest.fn()} />);
  });

  it('Einstellungen', async () => {
    await expectRemoteUsable(<SettingsScreen />);
  });

  // Der Clock-Screen ist bewusst reine Anzeige; den Fokus-Anker setzt App.tsx
  // als umschliessendes Pressable. Hier wird festgehalten, dass er ALLEIN
  // keinen haette — damit der Wrapper in App.tsx nicht unbemerkt wegfaellt.
  it('Gebetsuhr allein hat keinen Anker — App.tsx muss ihn liefern', async () => {
    const r = await focusReport(<ClockScreen />);
    expect(r.focusable).toBe(0);
  });

  it('Pairing (war komplett ohne fokussierbares Element)', async () => {
    await expectRemoteUsable(<PairingScreen />);
  });

  it('Quiz (Frage-Ansicht)', async () => {
    await expectRemoteUsable(<QuizScreen />);
  });

  describe.each([
    ['Videos', () => <VideosScreen />],
    ['Reels', () => <ReelsScreen />],
    ['Podcasts', () => <PodcastsScreen />],
    ['Radio', () => <RadioScreen />],
    ['Rezitatoren', () => <RecitersScreen />],
  ] as const)('%s im Ladezustand', (_label, make) => {
    it('hat einen Fokus-Anker', async () => {
      await expectRemoteUsable(make());
    });
  });

  it('Koran-Leser: Suren-Auswahl UND Ladezustand haben einen Anker', async () => {
    const r = await render(<QuranReaderScreen />);
    const picker = walk(r.toJSON() as unknown as JsonNode);
    expect(picker.filter((n) => n.props.focusable === true).length).toBeGreaterThan(0);
    // Sure waehlen -> Reader mit haengendem Abruf (Ladezustand).
    await fireEvent.press(r.getByText('Al-Faatiha'));
    const reader = walk(r.toJSON() as unknown as JsonNode);
    expect(reader.filter((n) => n.props.focusable === true).length).toBeGreaterThan(0);
    expect(reader.filter((n) => n.props.hasTVPreferredFocus === true)).toHaveLength(1);
  });

  // Der Ergebnis-Bildschirm des Quiz hatte bis zum 2026-07-28 kein einziges
  // fokussierbares Element — nur den Text „Zurueck zum Menue mit der
  // Zurueck-Taste". Jetzt haelt „Nochmal spielen" den Fokus.
  it('Quiz-Ergebnis hat einen Fokus-Anker', async () => {
    const r = await render(<QuizScreen />);
    jest.useFakeTimers();
    try {
      for (let i = 0; i < 10; i++) {
        const options = r.root!.queryAll((n) => n.props.focusable === true);
        await fireEvent.press(options[0]);
        await act(async () => {
          jest.advanceTimersByTime(1500);
        });
      }
    } finally {
      jest.useRealTimers();
    }
    expect(r.getByText('Nochmal spielen')).toBeTruthy();
    const nodes = walk(r.toJSON() as unknown as JsonNode);
    expect(nodes.filter((n) => n.props.hasTVPreferredFocus === true)).toHaveLength(1);
  });
});

describe('Fernbedienbarkeit im FEHLERzustand', () => {
  // Fehlgeschlagene Abrufe: der Screen zeigt die Fehlermeldung. Bis zum
  // 2026-07-28 war das ein Text ohne fokussierbares Element UND ohne jede
  // Moeglichkeit, es erneut zu versuchen — der Fehler war endgueltig.
  const reject = () => Promise.reject(new Error('offline'));

  function expectErrorStateUsable(r: Awaited<ReturnType<typeof render>>) {
    expect(r.getByText('Erneut versuchen')).toBeTruthy();
    const nodes = walk(r.toJSON() as unknown as JsonNode);
    expect(nodes.filter((n) => n.props.focusable === true).length).toBeGreaterThan(0);
    expect(nodes.filter((n) => n.props.hasTVPreferredFocus === true)).toHaveLength(1);
  }

  it.each([
    ['Videos', '@/lib/content', 'fetchVideos', () => <VideosScreen />],
    ['Reels', '@/lib/content', 'fetchReels', () => <ReelsScreen />],
    ['Podcasts', '@/lib/content', 'fetchPodcasts', () => <PodcastsScreen />],
    ['Radio', '@/lib/quranAudio', 'fetchRadios', () => <RadioScreen />],
    ['Rezitatoren', '@/lib/quranAudio', 'fetchReciters', () => <RecitersScreen />],
  ] as const)('%s zeigt Fehler MIT Fokus-Anker und Wiederholen', async (_l, mod, fn, make) => {
    const m = jest.requireMock(mod) as Record<string, jest.Mock>;
    m[fn].mockImplementationOnce(reject);
    const r = await render(make());
    expectErrorStateUsable(r);
  });

  // Der Koran-Leser startet in der Suren-Auswahl; der Netz-Abruf laeuft erst
  // nach der Auswahl. Deshalb hier erst eine Sure waehlen.
  it('Koran-Leser zeigt Fehler MIT Fokus-Anker und Wiederholen', async () => {
    const m = jest.requireMock('@/lib/quranText') as Record<string, jest.Mock>;
    m.fetchSurahReader.mockImplementationOnce(reject);
    const r = await render(<QuranReaderScreen />);
    await fireEvent.press(r.getByText('Al-Faatiha'));
    expectErrorStateUsable(r);
  });
});

/**
 * Bildschirmbefund Audit 2026-07-29: im Quiz blieb die selbst gewaehlte FALSCHE
 * Antwort golden statt rot. Ursache war die Stil-Reihenfolge in `FocusCard` —
 * der Fokus-Stil stand HINTER dem uebergebenen `style` und uebermalte jede
 * Zustandsfarbe. Die Karte, auf die man gerade geantwortet hat, ist immer die
 * fokussierte; die Rueckmeldung war damit systematisch unsichtbar.
 */
describe('Fokus-Stil darf Zustandsfarben nicht uebermalen', () => {
  function flatBorder(node: JsonNode | undefined): string | undefined {
    const style = node?.props.style as unknown;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { StyleSheet } = require('react-native') as typeof import('react-native');
    return (StyleSheet.flatten(style as never) as { borderColor?: string } | undefined)?.borderColor;
  }

  it('markiert die falsch beantwortete (und fokussierte) Karte rot', async () => {
    const r = await render(<QuizScreen />);
    const options = r.root!.queryAll((n) => n.props.focusable === true);
    // Die richtige Antwort steht nach dem Mischen an einer beliebigen Stelle —
    // gesucht ist eine FALSCHE. Ueber die Rueckmeldung ermittelt: erst die
    // erste Karte fokussieren und antworten, dann die Farben pruefen.
    await fireEvent(options[0], 'focus');
    await fireEvent.press(options[0]);
    const nodes = walk(r.toJSON() as unknown as JsonNode);
    const cards = nodes.filter((n) => n.props.focusable === true);
    const borders = cards.map(flatBorder);
    // Genau eine Karte ist gruen (die richtige). Ist die erste Karte die
    // richtige, ist sie gruen — sonst muss sie rot sein.
    expect(borders.filter((b) => b === '#2E9E4F')).toHaveLength(1);
    expect(borders[0] === '#2E9E4F' || borders[0] === '#D64545').toBe(true);
    // Gold (Fokusfarbe) darf nach der Antwort auf keiner der vier Karten mehr
    // die Zustandsfarbe verdraengen.
    expect(borders[0]).not.toBe('#d4af37');
  });
});
