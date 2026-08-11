/**
 * Mehrsprachigkeit am gerenderten Bildschirm (Audit 2026-07-28, T13).
 *
 * Der Paritaets-Test in `src/lib/i18n.test.ts` prueft die Sprachdateien; hier
 * geht es um die andere Haelfte: Kommt die eingestellte Sprache tatsaechlich
 * auf jedem Bildschirm an, und bleibt der Bildschirm dabei bedienbar?
 * Letzteres ist wichtig, weil die Uebersetzung jeden Screen angefasst hat —
 * ein verlorener Fokus-Anker waere derselbe Fehler wie am 2026-07-24
 * (Fernbedienung ohne Ziel) und wuerde sonst erst am Geraet auffallen.
 */
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ClockScreen } from '@/screens/ClockScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { PairingScreen } from '@/screens/PairingScreen';
import { QuizScreen } from '@/screens/QuizScreen';
import { RadioScreen } from '@/screens/RadioScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { VideosScreen } from '@/screens/VideosScreen';
import { translate } from '@/lib/i18n';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/locale';
import { setLanguage } from '@/lib/settings';

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

const pending = () => new Promise<never>(() => {});
jest.mock('@/lib/content', () => ({
  ...jest.requireActual('@/lib/content'),
  fetchVideos: jest.fn(pending),
}));
jest.mock('@/lib/quranAudio', () => ({
  ...jest.requireActual('@/lib/quranAudio'),
  fetchRadios: jest.fn(pending),
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

afterEach(() => setLanguage('de'));

describe('Sprache kommt auf dem Bildschirm an', () => {
  // Je Sprache ein eigener Testfall (statt einer Schleife mit mehreren
  // render()-Aufrufen im selben Fall): RTL raeumt zwischen Testfaellen selbst
  // auf, mehrere Renderer in einem Fall erzeugen ueberlappende act()-Bereiche.
  it.each(['de', 'tr', 'ar', 'ru'] as Locale[])(
    'Home-Hub zeigt die Kacheln auf %s',
    async (locale) => {
      setLanguage(locale);
      const r = await render(<HomeScreen navigate={jest.fn()} />);
      expect(r.getByText(translate(locale, 'home.tagline'))).toBeTruthy();
      expect(r.getByText(translate(locale, 'home.clock'))).toBeTruthy();
      expect(r.getByText(translate(locale, 'home.settingsHint'))).toBeTruthy();
    },
  );

  it('Einstellungen zeigen die Sprachwahl immer in der Eigenbezeichnung', async () => {
    setLanguage('ar');
    const r = await render(<SettingsScreen />);
    // Sprache ist der ERSTE Bereich und beim Oeffnen sichtbar — bewusst so,
    // damit sie findet, wer die Oberflaeche gerade nicht lesen kann.
    expect(r.getAllByText(translate('ar', 'settings.language')).length).toBeGreaterThan(0);
    // … die Sprachnamen selbst bewusst NICHT uebersetzt.
    expect(r.getByText('Deutsch')).toBeTruthy();
    expect(r.getByText('Русский')).toBeTruthy();
    expect(r.getByText('العربية')).toBeTruthy();

    // Das Zeitformat liegt seit der Gliederung im Bereich „Gebetszeiten"
    // (Befund D4). Der Weg dorthin ist Teil der Zusage — deshalb wird er hier
    // mitgegangen, statt die Erwartung zu streichen.
    await fireEvent.press(r.getByText(translate('ar', 'settings.sections.prayer')));
    expect(r.getByText(translate('ar', 'settings.timeFormat'))).toBeTruthy();
  });

  it('Kopplungs-Bildschirm setzt den Namen der Handy-Aktion in Schritt 2 ein', async () => {
    setLanguage('tr');
    const r = await render(<PairingScreen />);
    const step2 = translate('tr', 'pairing.step2', { action: translate('tr', 'pairing.action') });
    expect(step2).not.toContain('{action}');
    expect(r.getByText(step2)).toBeTruthy();
    expect(r.getByText(translate('tr', 'pairing.restart'))).toBeTruthy();
  });

  it('Quiz zaehlt die Fragen in der eingestellten Sprache', async () => {
    setLanguage('ru');
    const r = await render(<QuizScreen />);
    expect(r.getByText(translate('ru', 'quiz.progress', { i: 1, n: 10 }))).toBeTruthy();
  });

  // Audit 2026-07-28 (T15): bis heute war NUR die Quiz-Oberflaeche uebersetzt.
  // Die Frage darunter kam fest deutsch aus der Datei — auf einem arabischen
  // Fernseher stand ueber vier arabischen Bedienelementen ein deutscher Satz.
  it('Quiz stellt die FRAGE selbst in der eingestellten Sprache', async () => {
    setLanguage('ar');
    const r = await render(<QuizScreen />);
    const shown = walk(r.toJSON() as unknown as JsonNode)
      .flatMap((n) => (n.children ?? []).filter((c): c is string => typeof c === 'string'))
      .join(' ');
    // Kein lateinischer Fliesstext mehr: Ziffern, Interpunktion und der
    // Prozent-/Klammerkram duerfen bleiben, Woerter nicht.
    expect(shown).toMatch(/[؀-ۿ]/);
    expect(shown).not.toMatch(/\b(Wie|Welche|Welcher|Wer|Was|Koran|Sure)\b/);
  });

  // T16: dieselbe Luecke in der Standort-Liste.
  it('Einstellungen zeigen die Staedte in der eingestellten Sprache', async () => {
    setLanguage('ar');
    const r = await render(<SettingsScreen />);
    // Staedte liegen im Bereich „Standort" (Gliederung 2026-08-08).
    await fireEvent.press(r.getAllByText(translate('ar', 'settings.location'))[0]);
    expect(r.getByText('برلين')).toBeTruthy(); // Berlin
    expect(r.getByText('القاهرة')).toBeTruthy(); // Kairo
    expect(r.queryByText('Kairo')).toBeNull();
  });

  it('Gebetsuhr beschriftet den Standort in der eingestellten Sprache', async () => {
    setLanguage('ru');
    const r = await render(<ClockScreen />);
    expect(r.getByText('Берлин')).toBeTruthy();
  });

  it('Gebetsuhr zeigt den Countdown ohne lateinische Einheiten (T17)', async () => {
    // Der Befund am Geraet war „بعد 1h 55m" — arabischer Satz, lateinische
    // Einheiten. Geprueft wird der GERENDERTE Text, nicht nur der Formatierer.
    setLanguage('ar');
    const r = await render(<ClockScreen />);
    const pill = r.getByText(/^بعد /);
    const text = pill.props.children as string;
    expect(text).not.toMatch(/[A-Za-z]/);
    // Zahl und Einheit stehen zusammen, Gruppen durch ein Leerzeichen getrennt
    // (logisch Zahl → Einheit; Bidi dreht die Gruppen im RTL-Absatz).
    expect(text.replace('بعد ', '')).toMatch(/^\d+\p{Script=Arabic}+ \d+\p{Script=Arabic}+$/u);
  });

  it('Lade-/Fehlerflaeche nutzt die Handy-Formulierungen', async () => {
    setLanguage('fr');
    const r = await render(<VideosScreen />);
    expect(r.getByText(translate('fr', 'common.loading'))).toBeTruthy();
    expect(r.getByText(translate('fr', 'common.retry'))).toBeTruthy();
  });
});

describe('RTL (ar/ur/fa/ps)', () => {
  // `contentContainerStyle` muss mit: das Kachel-Raster des Home-Hubs haengt
  // am ScrollView-Inhalt, nicht am ScrollView selbst.
  function flexDirections(node: JsonNode[]): string[] {
    const out: string[] = [];
    for (const n of node) {
      for (const key of ['style', 'contentContainerStyle'] as const) {
        const style = n.props[key] as unknown;
        for (const s of Array.isArray(style) ? style : [style]) {
          const dir = (s as { flexDirection?: string } | null)?.flexDirection;
          if (dir) out.push(dir);
        }
      }
    }
    return out;
  }

  it('nutzt im deutschen Layout normale Reihen', async () => {
    setLanguage('de');
    const dirs = flexDirections(walk((await render(<HomeScreen navigate={jest.fn()} />)).toJSON() as unknown as JsonNode));
    expect(dirs).toContain('row');
    expect(dirs).not.toContain('row-reverse');
  });

  it('dreht Reihen und Raster im arabischen Layout um', async () => {
    setLanguage('ar');
    const dirs = flexDirections(walk((await render(<HomeScreen navigate={jest.fn()} />)).toJSON() as unknown as JsonNode));
    expect(dirs).toContain('row-reverse');
    expect(dirs).not.toContain('row');
  });

  it('setzt den Buchstabenabstand im RTL-Layout auf 0 (zerreisst sonst Ligaturen)', async () => {
    setLanguage('ar');
    const s = await render(<SettingsScreen />);
    const title = s.getByText(translate('ar', 'settings.title'));
    const styles = (Array.isArray(title.props.style) ? title.props.style : [title.props.style]) as {
      letterSpacing?: number;
    }[];
    expect(styles.some((x) => x?.letterSpacing === 0)).toBe(true);
  });
});

describe('Uebersetzung hat keinen Fokus-Anker zerstoert', () => {
  // Gleiche Regel wie in screens/focus.test.tsx, hier zusaetzlich in einer
  // NICHT-deutschen Sprache: mindestens ein fokussierbares Element und genau
  // ein Initialfokus.
  async function expectUsable(ui: ReactElement) {
    const nodes = walk((await render(ui)).toJSON() as unknown as JsonNode);
    expect(nodes.filter((n) => n.props.focusable === true).length).toBeGreaterThan(0);
    expect(nodes.filter((n) => n.props.hasTVPreferredFocus === true)).toHaveLength(1);
  }

  it.each([
    ['Home', () => <HomeScreen navigate={jest.fn()} />],
    ['Einstellungen', () => <SettingsScreen />],
    ['Pairing', () => <PairingScreen />],
    ['Quiz', () => <QuizScreen />],
    ['Videos (Ladezustand)', () => <VideosScreen />],
    ['Radio (Ladezustand)', () => <RadioScreen />],
  ] as const)('%s bleibt auf Arabisch bedienbar', async (_l, make) => {
    setLanguage('ar');
    await expectUsable(make());
  });

  it('kennt alle 14 Sprachen als gueltige Einstellung', () => {
    for (const l of SUPPORTED_LOCALES) {
      setLanguage(l);
      expect(translate(l, 'common.retry')).not.toBe('common.retry');
    }
  });
});
