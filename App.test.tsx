/**
 * Navigation und Fernbedienungs-Verhalten des App-Roots.
 *
 * Kernfragen: Kommt man von jedem Screen wieder heraus? Hat der Default-Screen
 * (die Gebetsuhr) einen Fokus-Anker, damit die OK-Taste ueberhaupt ankommt?
 * Letzteres ist der Regressionsschutz fuer den Geraetetest-Fund vom
 * 2026-07-24, bei dem die Uhr ohne Initialfokus die App unbedienbar machte.
 */
import { act, fireEvent, render } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import App from './App';

jest.mock('expo-video', () => ({
  useVideoPlayer: () => ({
    play: jest.fn(),
    pause: jest.fn(),
    replace: jest.fn(),
    addListener: () => ({ remove: jest.fn() }),
    playing: false,
    currentTime: 0,
    loop: false,
  }),
  VideoView: 'VideoView',
}));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('@/lib/pairing', () => ({
  startPairing: jest.fn(async () => {}),
  stopPairing: jest.fn(),
  rotateToken: jest.fn(),
  onPairCommand: jest.fn(() => () => {}),
  pairPayload: jest.fn(() => null),
  broadcast: jest.fn(),
  pairingState: jest.fn(() => ({ status: 'off', host: null, port: null, token: null, clients: 0 })),
  usePairingState: jest.fn(() => ({ status: 'off', host: null, port: null, token: null, clients: 0 })),
}));

/**
 * Simuliert die Zurueck-Taste der Fernbedienung. React Native ruft die
 * registrierten `hardwareBackPress`-Handler in UMGEKEHRTER Registrierungs-
 * reihenfolge auf (zuletzt montierter Screen zuerst) und stoppt beim ersten,
 * der `true` liefert — genau das bildet diese Schleife nach. Nur noch aktive
 * Registrierungen zaehlen, deshalb werden entfernte Handler ausgefiltert.
 */
async function pressBack(): Promise<boolean> {
  const calls = (BackHandler.addEventListener as jest.Mock).mock.calls;
  const handlers = calls
    .map((c, i) => ({ type: c[0], fn: c[1], i }))
    .filter((h) => h.type === 'hardwareBackPress' && !removed.has(h.i));
  let handled = false;
  await act(async () => {
    for (let i = handlers.length - 1; i >= 0; i--) {
      if (handlers[i].fn() === true) {
        handled = true;
        return;
      }
    }
  });
  return handled;
}

const removed = new Set<number>();

beforeEach(() => {
  removed.clear();
  let seq = 0;
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((..._a: unknown[]) => {
    const id = seq++;
    return { remove: () => void removed.add(id) };
  }) as unknown as typeof BackHandler.addEventListener);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Start und Fokus', () => {
  it('startet auf der Gebetsuhr — MIT fokussierbarem Wrapper (Fund 2026-07-24)', async () => {
    const r = await render(<App />);
    expect(r.getByText('OK öffnet das Menü')).toBeTruthy();
    const anchors = r.root!.queryAll((n) => n.props.hasTVPreferredFocus === true);
    expect(anchors.length).toBe(1);
  });

  it('OK auf der Uhr oeffnet den Home-Hub', async () => {
    const r = await render(<App />);
    const clockWrapper = r.root!.queryAll((n) => n.props.focusable === true)[0];
    await fireEvent.press(clockWrapper);
    expect(r.getByText('SALATI')).toBeTruthy();
    expect(r.getByText('Gebetszeiten · Koran · Lernen')).toBeTruthy();
  });
});

describe('Fernbedienung vom Handy (T14)', () => {
  /** Der von App.tsx bei `onPairCommand` registrierte Callback. */
  function pairCommand(): (cmd: { t: string; [k: string]: unknown }) => void {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { onPairCommand } = require('@/lib/pairing') as { onPairCommand: jest.Mock };
    const calls = onPairCommand.mock.calls;
    return calls[calls.length - 1][0] as (cmd: { t: string; [k: string]: unknown }) => void;
  }

  it('erreicht jeden Bildschirm der SCREENS-Liste', async () => {
    // Der Befund war, dass das Handy nur 6 von 11 Bildschirmen ansteuern
    // konnte. Hier wird der Weg selbst geprueft: jeder Name aus SCREENS muss
    // am App-Root ankommen und einen Screen rendern.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SCREENS } = require('@/lib/nav') as typeof import('@/lib/nav');
    const r = await render(<App />);
    const send = pairCommand();
    for (const screen of SCREENS) {
      await act(async () => send({ t: 'nav', screen }));
      // Jeder Screen braucht einen Fokus-Anker, sonst ist die Fernbedienung
      // am Ziel tot (Geraetetest-Fund 2026-07-24).
      expect(r.root!.queryAll((n) => n.props.focusable === true).length).toBeGreaterThan(0);
    }
  });

  it('ignoriert einen unbekannten Bildschirm, statt schwarz zu werden', async () => {
    const r = await render(<App />);
    const send = pairCommand();
    await act(async () => send({ t: 'nav', screen: 'settings' }));
    // Merkmal der Einstellungen ist die Bereichsspalte (Gliederung 2026-08-08).
    // „Darstellung" steht NUR dort — anders als „Einstellungen", das auch die
    // Home-Kachel traegt.
    expect(r.getByText('Darstellung')).toBeTruthy();
    // Neueres Handy an aelterem Fernseher: der Name existiert hier nicht.
    await act(async () => send({ t: 'nav', screen: 'hifz' }));
    expect(r.getByText('Darstellung')).toBeTruthy();
  });
});

describe('Zurueck-Kette', () => {
  it('Screen -> Home -> Uhr, und auf der Uhr gibt App.tsx das Zurueck ab', async () => {
    const r = await render(<App />);
    await fireEvent.press(r.root!.queryAll((n) => n.props.focusable === true)[0]); // Uhr -> Home
    await fireEvent.press(r.getByText('Einstellungen')); // Home -> Einstellungen
    expect(r.getByText('Darstellung')).toBeTruthy();

    expect(await pressBack()).toBe(true); // Einstellungen -> Home
    expect(r.getByText('SALATI')).toBeTruthy();

    expect(await pressBack()).toBe(true); // Home -> Uhr
    expect(r.getByText('OK öffnet das Menü')).toBeTruthy();

    // Auf der Uhr KEIN true: die App darf sich vom System schliessen lassen,
    // statt den Nutzer auf der Uhr gefangen zu halten.
    expect(await pressBack()).toBe(false);
  });

  it('fuehrt aus jedem Home-Eintrag wieder zurueck zum Hub', async () => {
    const r = await render(<App />);
    await fireEvent.press(r.root!.queryAll((n) => n.props.focusable === true)[0]);
    for (const tile of ['Quiz', 'Verbinden', 'Einstellungen']) {
      await fireEvent.press(r.getByText(tile));
      expect(await pressBack()).toBe(true);
      expect(r.getByText('SALATI')).toBeTruthy();
    }
  });
});
