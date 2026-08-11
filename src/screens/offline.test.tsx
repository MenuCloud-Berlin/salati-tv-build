/**
 * Sagt der Bildschirm wirklich, dass er aus dem Speicher liefert?
 *
 * Am Emulator zeigte die Rezitatoren-Liste ohne Netz zwar Inhalte (die Ablage
 * tat also ihre Arbeit), aber der Hinweis „ohne Netz" blieb aus. Ein
 * Zwischenspeicher, den man nicht ansieht, ist die schlechtere Hälfte der
 * Sache: wer nicht weiß, dass er Gespeichertes sieht, hält eine fehlende neue
 * Folge für einen Fehler der App.
 */
import { render } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import { leeren } from '@/lib/cache';
import { fetchReciters } from '@/lib/quranAudio';
import { translate } from '@/lib/i18n';
import { hydrateTvSettings, setLanguage } from '@/lib/settings';
import { RecitersScreen } from '@/screens/RecitersScreen';

jest.mock('expo-video', () => ({
  useVideoPlayer: () => ({
    play: jest.fn(),
    pause: jest.fn(),
    replace: jest.fn(),
    addListener: () => ({ remove: jest.fn() }),
    playing: false,
    currentTime: 0,
  }),
}));

const RECITER = {
  reciters: [{ id: 1, name: 'Ibrahim Al-Akdar', moshaf: [{ name: 'Hafs', server: 'https://s/1/', surah_list: '1,2' }] }],
};

beforeEach(async () => {
  setLanguage('de');
  await hydrateTvSettings();
  await leeren();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_e: string, cb: () => boolean) => ({
    remove: () => void cb,
  })) as unknown as typeof BackHandler.addEventListener);
});

afterEach(() => {
  jest.restoreAllMocks();
});

function netzAntwortet(payload: unknown) {
  globalThis.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => payload })) as unknown as typeof fetch;
}
describe('Rezitatoren ohne Netz', () => {
  it('zeigt keinen Hinweis, solange das Netz antwortet', async () => {
    netzAntwortet(RECITER);
    const r = await render(<RecitersScreen />);
    expect(r.getByText('Ibrahim Al-Akdar')).toBeTruthy();
    expect(r.queryByText(translate('de', 'common.offlineList'))).toBeNull();
  });

  it('liefert aus der Ablage UND sagt es, wenn das Netz ausfällt', async () => {
    // 1. Mit Netz fuellen.
    netzAntwortet(RECITER);
    await fetchReciters();

    // 2. Netz weg.
    globalThis.fetch = jest.fn(async () => {
      throw new Error('kein netz');
    }) as unknown as typeof fetch;

    const r = await render(<RecitersScreen />);
    // Der Inhalt ist da …
    expect(r.getByText('Ibrahim Al-Akdar')).toBeTruthy();
    // … und der Bildschirm sagt, woher er kommt.
    expect(r.getByText(translate('de', 'common.offlineList'))).toBeTruthy();
  });
});
