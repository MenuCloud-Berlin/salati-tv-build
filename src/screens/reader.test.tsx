/**
 * Der Koran-Leser nach dem Ausbau vom 2026-08-08.
 *
 * Geprüft wird, was der Nutzer am Bildschirm hat — nicht, ob eine Funktion
 * aufgerufen wurde: dass die Vers-Bedienung existiert und die Fernbedienung
 * dort einen Anker findet, dass Umschrift und Übersetzung wirklich verschwinden,
 * wenn man sie abschaltet, und dass der arabische Text durch die
 * Schrift-Umschreibung läuft (ohne sie zeigt die KFGQPC-Schrift in 2.240 von
 * 6.236 Versen einen Platzhalter-Kreis).
 */
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { BackHandler } from 'react-native';

import { QuranReaderScreen, readerVerseMetrics } from '@/screens/QuranReaderScreen';
import {
  hydrateTvSettings,
  READER_SCALES,
  setLanguage,
  setQuranFont,
  setReaderOptions,
  setReaderScale,
  tvSettingsState,
} from '@/lib/settings';
import { adaptQuranText, quranFontDef } from '@/lib/quranFonts';

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

// Die Schrift gilt als geladen — sonst faellt `useQuranFont` bewusst auf die
// Systemschrift zurueck und schreibt den Text NICHT um (s. useQuranFont.ts).
jest.mock('expo-font', () => ({
  isLoaded: () => true,
  loadAsync: jest.fn(async () => {}),
}));

// Ein Vers mit genau den Zeichen, an denen sich die KFGQPC-Umschreibung zeigt:
// U+0652 (Sukun) und U+06DF. Nicht ausgedacht — die Schreibweise stammt aus
// dem Wortlaut, den api.quran.com liefert.
const VERS_ARABISCH = 'كَفَرُوا۟';
const mockVerses = [
  {
    n: 1,
    words: [{ ar: VERS_ARABISCH, translit: 'kafaruu' }],
    segments: [],
    translation: 'Die ungläubig sind',
    audioUrl: 'https://a/1.mp3',
  },
  {
    n: 2,
    words: [{ ar: 'عَلَيْهِمْ', translit: 'alayhim' }],
    segments: [],
    translation: 'über sie',
    audioUrl: 'https://a/2.mp3',
  },
];

// Der lange Vers: 90 Woerter mit Zeitstempeln, wie ihn Sure 2, Vers 282
// liefert. Er liegt in einer EIGENEN Sure, damit die Tests der Vers-Bedienung
// oben weiterhin genau zwei Verse vor sich haben.
const LANGE_WOERTER = Array.from({ length: 90 }, (_, i) => ({
  ar: 'الَّذِينَ',
  translit: `wort${i}`,
}));
const mockLangeSure = [
  {
    n: 282,
    words: LANGE_WOERTER,
    // [wortIdx, wortNr, vonMs, bisMs] — eine Sekunde je Wort.
    segments: LANGE_WOERTER.map((_, i) => [i, i + 1, i * 1000, (i + 1) * 1000]),
    translation: Array.from({ length: 300 }, (_, i) => `satzteil${i}`).join(' '),
    audioUrl: 'https://a/282.mp3',
  },
];

jest.mock('@/lib/quranText', () => ({
  ...jest.requireActual('@/lib/quranText'),
  fetchSurahReader: jest.fn(async (surah: number) => (surah === 2 ? mockLangeSure : mockVerses)),
}));

/** Öffnet den Leser: aus der Suren-Auswahl heraus Sure 1 wählen. */
async function oeffneLeser(el: ReactElement) {
  const r = await render(el);
  await fireEvent.press(r.getByText('Al-Faatiha'));
  return r;
}

beforeEach(async () => {
  // Feste Oberflaechensprache — sonst haengen die erwarteten Texte an der
  // Systemsprache des Testlaeufers (detectDeviceLocale).
  setLanguage('de');
  await hydrateTvSettings();
  // Bekannter Ausgangsstand je Test: der Store lebt modulweit und traegt sonst
  // die Wahl des vorigen Tests weiter.
  setQuranFont('kfgqpc');
  setReaderScale(1);
  setReaderOptions({ readerTranslit: true, readerTranslation: true, readerAutoAdvance: true });
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_ev: string, cb: () => boolean) => ({
    remove: () => void cb,
  })) as unknown as typeof BackHandler.addEventListener);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Suren-Auswahl', () => {
  it('zeigt nur den gewählten Zwanziger-Block statt aller 114 Suren', async () => {
    const r = await render(<QuranReaderScreen />);
    // Block 1–20 ist vorgewählt: Sure 1 ist da, Sure 21 nicht.
    expect(r.getByText('Al-Faatiha')).toBeTruthy();
    expect(r.queryByText('Al-Anbiyaa')).toBeNull();

    // Ohne diese Sprungleiste waeren es bis Sure 100 rund 25 Mal DPAD_DOWN.
    await fireEvent.press(r.getByText('21–40'));
    expect(r.getByText('Al-Anbiyaa')).toBeTruthy();
    expect(r.queryByText('Al-Faatiha')).toBeNull();
  });

  it('bietet Sprungziele über den gesamten Koran an', async () => {
    const r = await render(<QuranReaderScreen />);
    for (const label of ['1–20', '21–40', '41–60', '61–80', '81–100', '101–114']) {
      expect(r.getByText(label)).toBeTruthy();
    }
  });
});

describe('Leser', () => {
  it('schreibt den arabischen Text in die Kodierung der gewählten Schrift um', async () => {
    setQuranFont('kfgqpc');
    const r = await oeffneLeser(<QuranReaderScreen />);
    const erwartet = adaptQuranText(VERS_ARABISCH, quranFontDef('kfgqpc'), 'madina');
    // Die Umschreibung aendert den Text wirklich — sonst pruefte der Test nichts.
    expect(erwartet).not.toBe(VERS_ARABISCH);
    expect(r.getByText(erwartet)).toBeTruthy();
  });

  it('lässt den Text unangetastet, wenn die Schrift die Unicode-Schreibweise erwartet', async () => {
    setQuranFont('amiri-quran');
    const r = await oeffneLeser(<QuranReaderScreen />);
    expect(r.getByText(VERS_ARABISCH)).toBeTruthy();
  });

  // Bewusst zwei Tests statt eines mit zwei `render`-Aufrufen: die
  // Testbibliothek fuehrt EINEN aktiven Baum, ein zweiter Aufbau im selben Test
  // liess die nachfolgenden Tests nichts mehr finden.
  it('zeigt Umschrift und Übersetzung, solange sie eingeschaltet sind', async () => {
    const r = await oeffneLeser(<QuranReaderScreen />);
    expect(r.getByText('kafaruu')).toBeTruthy();
    expect(r.getByText('Die ungläubig sind')).toBeTruthy();
  });

  it('blendet Umschrift und Übersetzung aus, wenn sie abgeschaltet sind', async () => {
    setReaderOptions({ readerTranslit: false, readerTranslation: false });
    const r = await oeffneLeser(<QuranReaderScreen />);
    expect(r.queryByText('kafaruu')).toBeNull();
    expect(r.queryByText('Die ungläubig sind')).toBeNull();
    // Der Vers selbst bleibt — abgeschaltet werden nur die Begleitzeilen.
    // Erwartung aus `adaptQuranText` abgeleitet statt arabisch abgetippt: eine
    // von Hand geschriebene Zeichenkette kann sich in der Reihenfolge der
    // Vokalzeichen unterscheiden, ohne dass man es sieht.
    const vers = adaptQuranText(VERS_ARABISCH, quranFontDef('kfgqpc'), 'madina');
    expect(r.getByText(vers)).toBeTruthy();
  });

  it('bringt eine Vers-Bedienung mit genau einem Fokus-Anker mit', async () => {
    const r = await oeffneLeser(<QuranReaderScreen />);
    // ⏮ ⏯ ⏭ ↻ — vor dem Ausbau gab es NUR Play/Pause auf der ganzen Fläche.
    for (const glyph of ['⏮', '⏭', '↻']) expect(r.getByText(glyph)).toBeTruthy();
    // Der Leser startet spielend, die Taste zeigt also Pause.
    expect(r.getByText('❚❚')).toBeTruthy();

    // Genau ein Anker: zwei liessen den Fokus auf Android TV springen.
    const anker = r.root!.queryAll((n) => n.props.hasTVPreferredFocus === true);
    expect(anker.length).toBe(1);
  });

  it('schaltet mit ⏭ und ⏮ den Vers weiter und wieder zurück', async () => {
    const r = await oeffneLeser(<QuranReaderScreen />);
    expect(r.getByText('kafaruu')).toBeTruthy();

    await fireEvent.press(r.getByText('⏭'));
    expect(r.getByText('alayhim')).toBeTruthy();

    await fireEvent.press(r.getByText('⏮'));
    expect(r.getByText('kafaruu')).toBeTruthy();
  });

  it('läuft am Anfang und Ende der Sure nicht aus der Liste heraus', async () => {
    const r = await oeffneLeser(<QuranReaderScreen />);
    // Vor dem ersten Vers gibt es nichts — der Leser bleibt stehen statt
    // auf einen undefinierten Vers zu zeigen (und dann leer zu rendern).
    await fireEvent.press(r.getByText('⏮'));
    expect(r.getByText('kafaruu')).toBeTruthy();

    await fireEvent.press(r.getByText('⏭'));
    await fireEvent.press(r.getByText('⏭'));
    expect(r.getByText('alayhim')).toBeTruthy();
  });

  it('meldet die Wiederholung erst, wenn sie eingeschaltet ist', async () => {
    const r = await oeffneLeser(<QuranReaderScreen />);
    expect(r.queryByText(/wiederholt/)).toBeNull();
    await fireEvent.press(r.getByText('↻'));
    expect(r.getByText(/wiederholt/)).toBeTruthy();
  });

  it('teilt einen langen Vers in Abschnitte, statt ihn über den Rand laufen zu lassen', async () => {
    // Der Nutzerbefund vom 2026-08-16: „bei langen Versen ist der Text viel zu
    // viel für den Bildschirm". Bis 1.9.0 lag der ganze Vers in einer Flaeche
    // ohne Hoehenbegrenzung — er schob Umschrift und Übersetzung auf die
    // Bedienleiste und wurde oben und unten abgeschnitten.
    const r = await render(<QuranReaderScreen />);
    await fireEvent.press(r.getByText('Al-Baqara'));

    // Ohne Messung weiss der Leser nicht, wie viel Platz er hat: er zeigt dann
    // alles in einem Stueck. Genau das ist der Zustand vor `onLayout`.
    expect(r.queryByText(/Abschnitt/)).toBeNull();

    // Jetzt die Buehne messen, wie es das echte Bild tut: 1660 × 640.
    await fireEvent(r.getByTestId('reader-buehne'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 1660, height: 640 } },
    });

    expect(r.getByText(/Abschnitt 1 \/ \d+/)).toBeTruthy();
    // Das erste Wort steht am Bildschirm, das letzte NICHT — es gehoert in
    // einen spaeteren Abschnitt. Geprueft an der Umschriftzeile: sie traegt
    // genau die Woerter des sichtbaren Abschnitts.
    expect(r.getByText(/^wort0 /)).toBeTruthy();
    expect(r.queryByText(/wort89/)).toBeNull();
  });

  it('blättert mit ⏭ erst durch den langen Vers und dann zum nächsten', async () => {
    const r = await render(<QuranReaderScreen />);
    await fireEvent.press(r.getByText('Al-Baqara'));
    await fireEvent(r.getByTestId('reader-buehne'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 1660, height: 640 } },
    });

    const erster = r.getByText(/Abschnitt 1 \/ (\d+)/).props.children.join('');
    const gesamt = Number(/Abschnitt 1 \/ (\d+)/.exec(erster)![1]);
    expect(gesamt).toBeGreaterThan(1);

    // Ohne diese Bedienung waere der Rest eines Verses ohne Zeitstempel (der
    // mitgelieferte Text hat keine) fuer immer unsichtbar.
    await fireEvent.press(r.getByText('⏭'));
    expect(r.getByText(new RegExp(`Abschnitt 2 / ${gesamt}`))).toBeTruthy();

    await fireEvent.press(r.getByText('⏮'));
    expect(r.getByText(new RegExp(`Abschnitt 1 / ${gesamt}`))).toBeTruthy();
  });

  it('kürzt die Übersetzung eines langen Verses nicht weg, sondern verteilt sie mit', async () => {
    const r = await render(<QuranReaderScreen />);
    await fireEvent.press(r.getByText('Al-Baqara'));
    await fireEvent(r.getByTestId('reader-buehne'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 1660, height: 640 } },
    });

    // Der erste Abschnitt zeigt den Anfang der Übersetzung ...
    expect(r.getByText(/^satzteil0 /)).toBeTruthy();
    // ... und der letzte Abschnitt das Ende. Vorher stand dort `numberOfLines={4}`
    // und alles ab der fünften Zeile war weg — ohne jeden Hinweis darauf.
    let sicherung = 0;
    while (r.queryByText(/satzteil299/) === null && sicherung < 40) {
      await fireEvent.press(r.getByText('⏭'));
      sicherung += 1;
    }
    expect(r.getByText(/satzteil299/)).toBeTruthy();
  });

  it('schaltet Umschrift und Übersetzung am Lesebildschirm selbst um', async () => {
    // Der Nutzerbefund: die Schalter gab es nur in den Einstellungen — zwei
    // Bildschirme entfernt, und beim Zurueckkommen war die Sure weg.
    const r = await oeffneLeser(<QuranReaderScreen />);
    expect(r.getByText('kafaruu')).toBeTruthy();

    await fireEvent.press(r.getByText('Umschrift'));
    expect(r.queryByText('kafaruu')).toBeNull();
    // Und wirklich gespeichert, nicht nur ausgeblendet.
    expect(tvSettingsState().readerTranslit).toBe(false);

    await fireEvent.press(r.getByText('Übersetzung'));
    expect(r.queryByText('Die ungläubig sind')).toBeNull();
    expect(tvSettingsState().readerTranslation).toBe(false);

    await fireEvent.press(r.getByText('Umschrift'));
    expect(r.getByText('kafaruu')).toBeTruthy();
  });

  it('vergrößert den Vers wirklich mit dem eingestellten Schriftgrad', () => {
    // Direkt an der reinen Funktion geprueft statt am gerenderten Bildschirm:
    // dort haengt die Groesse zusaetzlich an der Fenstergroesse des Testlaeufers.
    // Geprueft wird ueber die ganze Staffelung und auf drei Panelhoehen, weil
    // eine zu enge Deckelung zwei Stufen auf denselben Wert klemmen wuerde —
    // die Einstellung waere dann sichtbar vorhanden und ohne Wirkung.
    for (const h of [540, 720, 1080]) {
      const groessen = READER_SCALES.map((sc) => readerVerseMetrics(h, sc).fontSize);
      for (let i = 1; i < groessen.length; i++) {
        expect(groessen[i]).toBeGreaterThan(groessen[i - 1]);
      }
      // Die Zeilenhoehe muss mitwachsen, sonst schneiden die gestapelten
      // Koran-Zeichen oben ab (derselbe Fehlertyp wie bei den Schrift-Metriken).
      for (const sc of READER_SCALES) {
        const m = readerVerseMetrics(h, sc);
        expect(m.lineHeight).toBeGreaterThan(m.fontSize);
      }
    }
  });
});


describe('Startziel', () => {
  it('faengt mit vorgegebener Sure beim Lesen an statt bei der Auswahl', async () => {
    // Ohne das kam die Bildschirmfoto-Automatik nur bis zur Surenliste — auf der
    // Store-Seite stand deshalb unter „Den Koran am Fernseher lesen" eine Liste
    // von Namen (Befund 2026-08-16).
    const r = await render(<QuranReaderScreen startSurah={2} />);
    expect(r.queryByText('Al-Faatiha')).toBeNull(); // keine Auswahl
    expect(r.getByText(/Al-Baqara/)).toBeTruthy();
  });

  it('bleibt ohne Vorgabe bei der Auswahl', async () => {
    const r = await render(<QuranReaderScreen />);
    expect(r.getByText('Al-Faatiha')).toBeTruthy();
  });
});

it('haelt die Woerter mit einem RAND auseinander, nicht mit einem Leerzeichen', async () => {
  // Auf tvOS verschluckt die Textzeile das abschliessende Leerzeichen — der
  // ganze Vers lief dort in einem Zug zusammen, waehrend er auf Android
  // Luecken hatte (Bildschirmfoto fuer den App Store, 2026-08-16). Ein Rand
  // haengt an keiner Textregel.
  const r = await render(<QuranReaderScreen startSurah={1} />);
  const vers = adaptQuranText(VERS_ARABISCH, quranFontDef('kfgqpc'), 'madina');
  const wort = r.getByText(vers);
  const stil = Array.isArray(wort.props.style) ? Object.assign({}, ...wort.props.style.filter(Boolean)) : wort.props.style;
  expect(stil.marginHorizontal).toBeGreaterThan(0);
});
