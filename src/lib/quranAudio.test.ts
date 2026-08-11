import { parseRadios, parseReciters, surahAudioUrl } from '@/lib/quranAudio';

describe('parseReciters', () => {
  const base = {
    id: 1,
    name: '  Mishary   Alafasy ',
    moshaf: [{ id: 2, name: '  Hafs  A Asim ', server: 'https://server.test/a', surah_list: '1,2,3' }],
  };

  it('normalisiert Namen und haengt einen fehlenden Schraegstrich an den Server', () => {
    const [r] = parseReciters([base]);
    expect(r).toEqual({
      id: '1-2',
      name: 'Mishary Alafasy',
      rewaya: 'Hafs A Asim',
      server: 'https://server.test/a/',
      surahList: [1, 2, 3],
    });
  });

  it('listet mehrere Moshaf-Aufnahmen desselben Rezitators einzeln', () => {
    const out = parseReciters([
      {
        ...base,
        moshaf: [
          { id: 2, name: 'Hafs', server: 'https://s/a/', surah_list: '1' },
          { id: 3, name: 'Warsh', server: 'https://s/b/', surah_list: '1' },
        ],
      },
    ]);
    expect(out.map((r) => r.rewaya)).toEqual(['Hafs', 'Warsh']);
  });

  // Schutz gegen kaputte API-Eintraege: die Screens rendern die Liste direkt.
  it('verwirft Eintraege ohne https-Server', () => {
    expect(
      parseReciters([{ ...base, moshaf: [{ id: 2, name: 'x', server: 'http://unsicher', surah_list: '1' }] }]),
    ).toEqual([]);
    expect(parseReciters([{ ...base, moshaf: [{ id: 2, name: 'x', server: '', surah_list: '1' }] }])).toEqual([]);
  });

  it('verwirft Eintraege ohne gueltige Suren-Nummern', () => {
    expect(
      parseReciters([{ ...base, moshaf: [{ id: 2, name: 'x', server: 'https://s/', surah_list: 'abc' }] }]),
    ).toEqual([]);
  });

  it('filtert Suren-Nummern ausserhalb von 1..114 heraus', () => {
    const [r] = parseReciters([
      { ...base, moshaf: [{ id: 2, name: 'x', server: 'https://s/', surah_list: '0,1,114,115,x' }] },
    ]);
    expect(r.surahList).toEqual([1, 114]);
  });

  it('kommt mit fehlendem moshaf-Feld klar', () => {
    expect(parseReciters([{ id: 9, name: 'Ohne' }])).toEqual([]);
    expect(parseReciters([])).toEqual([]);
  });
});

describe('surahAudioUrl', () => {
  it('polstert die Surennummer dreistellig (mp3quran-Konvention)', () => {
    expect(surahAudioUrl('https://s/a/', 1)).toBe('https://s/a/001.mp3');
    expect(surahAudioUrl('https://s/a/', 114)).toBe('https://s/a/114.mp3');
  });
});

describe('parseRadios', () => {
  it('behaelt nur vollstaendige https-Sender und normalisiert den Namen', () => {
    expect(
      parseRadios({
        radios: [
          { id: 1, name: '  Radio   Eins ', url: 'https://stream/1' },
          { id: 2, name: 'Kein URL' },
          { id: 3, name: '', url: 'https://stream/3' },
          { name: 'Keine Id', url: 'https://stream/4' },
          { id: 5, name: 'Unsicher', url: 'http://stream/5' },
        ],
      }),
    ).toEqual([{ id: 1, name: 'Radio Eins', url: 'https://stream/1' }]);
  });

  it('liefert bei fehlendem radios-Feld eine leere Liste', () => {
    expect(parseRadios({})).toEqual([]);
  });
});
