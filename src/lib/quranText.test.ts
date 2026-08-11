import { SUPPORTED_LOCALES } from '@/lib/locale';
import { leeren } from '@/lib/cache';
import {
  activeWordIndex,
  fetchSurahReader,
  letzteLeseQuelle,
  TRANSLATION_RESOURCES,
  type WordSegment,
} from '@/lib/quranText';

describe('activeWordIndex', () => {
  const segs: WordSegment[] = [
    [0, 1, 0, 500],
    [1, 2, 500, 900],
    [2, 3, 900, 1400],
  ];

  it('findet das Wort zur aktuellen Wiedergabeposition', () => {
    expect(activeWordIndex(segs, 0)).toBe(0);
    expect(activeWordIndex(segs, 499)).toBe(0);
    expect(activeWordIndex(segs, 500)).toBe(1); // Intervall ist [start, end)
    expect(activeWordIndex(segs, 1399)).toBe(2);
  });

  it('liefert -1 ausserhalb aller Segmente (kein Wort hervorheben)', () => {
    expect(activeWordIndex(segs, 1400)).toBe(-1);
    expect(activeWordIndex(segs, -1)).toBe(-1);
    expect(activeWordIndex([], 100)).toBe(-1);
  });
});

describe('fetchSurahReader', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const words = {
    verses: [
      {
        verse_number: 1,
        words: [
          { char_type_name: 'word', text_uthmani: 'بِسْمِ', transliteration: { text: 'bis'} },
          { char_type_name: 'word', text_uthmani: 'ٱللَّهِ', transliteration: { text: null } },
          { char_type_name: 'end', text_uthmani: '١', transliteration: { text: null } },
        ],
      },
      {
        verse_number: 2,
        words: [{ char_type_name: 'word', text_uthmani: 'ٱلْحَمْدُ', transliteration: { text: 'al' } }],
      },
    ],
  };

  function mockRoutes(over: { trans?: unknown; seg?: unknown; transOk?: boolean; segOk?: boolean } = {}) {
    globalThis.fetch = jest.fn(async (url: string) => {
      if (url.includes('/verses/by_chapter/')) return { ok: true, json: async () => words };
      if (url.includes('/quran/translations/'))
        return {
          ok: over.transOk ?? true,
          json: async () => over.trans ?? { translations: [{ text: '<i>Im Namen</i>  Gottes' }, { text: 'Lob' }] },
        };
      return {
        ok: over.segOk ?? true,
        json: async () =>
          over.seg ?? {
            audio_files: [
              { verse_key: '1:1', url: 'Alafasy/mp3/001001.mp3', segments: [[0, 1, 0, 500]] },
              { verse_key: '1:2', url: '//cdn.test/001002.mp3' },
            ],
          },
      };
    }) as unknown as typeof fetch;
  }

  it('filtert Nicht-Woerter (Versnummern) heraus und ersetzt fehlende Umschrift', async () => {
    mockRoutes();
    const verses = await fetchSurahReader(1, 7);
    expect(verses[0].words).toEqual([
      { ar: 'بِسْمِ', translit: 'bis' },
      { ar: 'ٱللَّهِ', translit: '' },
    ]);
  });

  it('entfernt HTML aus der Uebersetzung und normalisiert Leerraum', async () => {
    mockRoutes();
    const verses = await fetchSurahReader(1, 7);
    expect(verses[0].translation).toBe('Im Namen Gottes');
  });

  // Bildschirmbefund Audit 2026-07-29: Saheeh International stand am Fernseher
  // als „Lord1 of the worlds" da. quran.com liefert Fussnoten als
  // `<sup foot_note=...>1</sup>` — beim reinen Tag-Entfernen blieb die Ziffer
  // mitten im Satz stehen.
  it('entfernt Fussnoten-Ziffern statt sie an das Wort zu kleben', async () => {
    mockRoutes({
      trans: {
        translations: [
          { text: 'praise is due to Allah, Lord<sup foot_note=12345>1</sup> of the worlds' },
          { text: 'Lob' },
        ],
      },
    });
    const verses = await fetchSurahReader(1, 7);
    expect(verses[0].translation).toBe('praise is due to Allah, Lord of the worlds');
    expect(verses[0].translation).not.toMatch(/\d/);
  });

  // Faellt die Fussnote am Satzende weg, darf kein Leerzeichen vor dem Punkt
  // stehen bleiben.
  it('laesst nach dem Entfernen kein Leerzeichen vor Satzzeichen zurueck', async () => {
    mockRoutes({
      trans: { translations: [{ text: 'the worlds <sup foot_note=1>2</sup>.' }, { text: 'Lob' }] },
    });
    const verses = await fetchSurahReader(1, 7);
    expect(verses[0].translation).toBe('the worlds.');
  });

  it('macht relative und protokollrelative Audio-URLs absolut', async () => {
    mockRoutes();
    const verses = await fetchSurahReader(1, 7);
    expect(verses[0].audioUrl).toBe('https://verses.quran.com/Alafasy/mp3/001001.mp3');
    expect(verses[1].audioUrl).toBe('https://cdn.test/001002.mp3');
  });

  // Uebersetzung und Segmente sind optionale Beigaben: faellt einer der beiden
  // Endpunkte aus, muss der Leser trotzdem den arabischen Text zeigen — sonst
  // waere der ganze Screen wegen einer Nebensache im Fehlerzustand.
  it('liefert Verse auch, wenn Uebersetzung UND Segmente ausfallen', async () => {
    mockRoutes({ transOk: false, segOk: false });
    const verses = await fetchSurahReader(1, 7);
    expect(verses).toHaveLength(2);
    expect(verses[0].translation).toBe('');
    expect(verses[0].audioUrl).toBe('');
    expect(verses[0].segments).toEqual([]);
  });

  /**
   * Seit 1.6.0 liegt der vollstaendige Korantext im Paket
   * (`data/quranText.generated.json`). Ohne Netz UND ohne Ablage faellt der
   * Leser deshalb nicht mehr aus, sondern zeigt den Vers — ohne Uebersetzung
   * und ohne Rezitation, weil beides nicht gebuendelt ist.
   */
  it('liefert ohne Netz und ohne Ablage den gebuendelten Text', async () => {
    await leeren();
    globalThis.fetch = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch;

    const verses = await fetchSurahReader(1, 7);
    expect(letzteLeseQuelle()).toBe('paket');
    expect(verses).toHaveLength(7);
    // Erstes Wort der Basmala, Wort fuer Wort mit Umschrift.
    expect(verses[0].words[0].ar).toBe('بِسْمِ');
    expect(verses[0].words[0].translit).toBe("bis'mi");
    // Was NICHT im Paket liegt, ist auch nicht da — und wird nicht erfunden.
    expect(verses[0].translation).toBe('');
    expect(verses[0].audioUrl).toBe('');
    expect(verses[0].segments).toEqual([]);
  });

  it('meldet `netz` als Quelle, solange der Abruf gelingt', async () => {
    await leeren();
    mockRoutes();
    await fetchSurahReader(1, 7);
    expect(letzteLeseQuelle()).toBe('netz');
  });

  it('bevorzugt die Ablage vor dem Paket — sie hat die Uebersetzung', async () => {
    await leeren();
    mockRoutes();
    await fetchSurahReader(1, 7); // fuellt die Ablage

    globalThis.fetch = jest.fn(async () => {
      throw new Error('kein netz');
    }) as unknown as typeof fetch;
    const verses = await fetchSurahReader(1, 7);
    expect(letzteLeseQuelle()).toBe('ablage');
    expect(verses[0].translation).not.toBe('');
  });

  it('haelt alle 114 Suren mit der richtigen Verszahl im Paket', async () => {
    await leeren();
    globalThis.fetch = jest.fn(async () => {
      throw new Error('kein netz');
    }) as unknown as typeof fetch;
    // Stichproben ueber den ganzen Bestand: laengste Sure, kuerzeste, letzte.
    expect(await fetchSurahReader(2, 7)).toHaveLength(286);
    expect(await fetchSurahReader(108, 7)).toHaveLength(3);
    expect(await fetchSurahReader(114, 7)).toHaveLength(6);
  });

  // Audit 2026-07-28 (T11) — vorher wurde die Uebersetzung ueber den
  // LISTENINDEX zugeordnet (`translations[i]`). Kaeme die Liste unvollstaendig
  // von vorne oder in anderer Reihenfolge, staende unter jedem Vers
  // stillschweigend die Uebersetzung eines anderen. Jetzt ueber `verse_key`.
  it('ordnet Uebersetzungen ueber verse_key zu, nicht ueber die Position', async () => {
    mockRoutes({
      trans: {
        translations: [
          // Absichtlich VERDREHT und mit fehlendem erstem Eintrag: bei
          // Index-Zuordnung landete „zu Vers 2" unter Vers 1.
          { verse_key: '1:2', text: 'zu Vers 2' },
        ],
      },
    });
    const verses = await fetchSurahReader(1, 7);
    expect(verses[0].translation).toBe('');
    expect(verses[1].translation).toBe('zu Vers 2');
  });

  it('fordert verse_key explizit an (ohne fields liefert quran.com ihn nicht)', async () => {
    mockRoutes();
    await fetchSurahReader(1, 7);
    const urls = (globalThis.fetch as unknown as jest.Mock).mock.calls.map((c) => String(c[0]));
    const transUrl = urls.find((u) => u.includes('/quran/translations/'))!;
    expect(transUrl).toContain('fields=verse_key');
  });

  it('nutzt die uebergebene Uebersetzungs-Ressource der App-Sprache', async () => {
    mockRoutes();
    await fetchSurahReader(1, 7, TRANSLATION_RESOURCES.tr);
    const urls = (globalThis.fetch as unknown as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes(`/quran/translations/${TRANSLATION_RESOURCES.tr}?`))).toBe(true);
  });

  // Arabisch: quran.com hat keine arabische Uebersetzungs-Ausgabe. Statt einer
  // fremdsprachigen Zeile unter dem arabischen Text faellt der Abruf ganz weg.
  it('ueberspringt den Uebersetzungs-Abruf, wenn keine Ressource gesetzt ist', async () => {
    mockRoutes();
    const verses = await fetchSurahReader(1, 7, null);
    const urls = (globalThis.fetch as unknown as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/quran/translations/'))).toBe(false);
    expect(verses[0].translation).toBe('');
    expect(verses[0].words).toHaveLength(2); // Text kommt trotzdem
  });

  // Rueckfall auf die Position, wenn KEIN verse_key mitkommt — sonst waere eine
  // aeltere API-Antwort schlagartig ganz ohne Uebersetzung.
  it('faellt auf die Reihenfolge zurueck, wenn die Antwort keinen verse_key hat', async () => {
    mockRoutes({ trans: { translations: [{ text: 'nur eine' }] } });
    const verses = await fetchSurahReader(1, 7);
    expect(verses[0].translation).toBe('nur eine');
    expect(verses[1].translation).toBe('');
  });

  it('hat fuer jede der 14 App-Sprachen einen Eintrag', () => {
    for (const l of SUPPORTED_LOCALES) {
      expect(l in TRANSLATION_RESOURCES).toBe(true);
    }
    // Nur Arabisch darf `null` sein (s. Kommentar in quranText.ts).
    const nulls = SUPPORTED_LOCALES.filter((l) => TRANSLATION_RESOURCES[l] === null);
    expect(nulls).toEqual(['ar']);
  });
});
