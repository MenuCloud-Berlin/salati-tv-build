/**
 * Die Ablage entscheidet, was der Fernseher OHNE Netz noch zeigt. Geprüft wird
 * deshalb das Verhalten, auf das sich der Nutzer verlässt — nicht die interne
 * Form der Einträge:
 *
 *   • Mit Netz gewinnt IMMER das Netz (sonst sähe man wochenlang einen alten
 *     Stand und hielte fehlende neue Folgen für einen Fehler der App).
 *   • Ohne Netz tritt die Ablage ein, statt eine Fehlermeldung zu zeigen.
 *   • Ohne Netz UND ohne Ablage bleibt es beim Fehler — es gibt nichts zu zeigen.
 *   • Ein kaputter oder veralteter Eintrag wird verworfen, nicht falsch gelesen.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { anzahlEintraege, aufraeumen, ablegen, leeren, lesen, mitAblage } from '@/lib/cache';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('Ablage', () => {
  it('legt ab und liest zurück', async () => {
    await ablegen('a', { x: 1 });
    expect(await lesen<{ x: number }>('a')).toEqual({ x: 1 });
  });

  it('liefert null für einen unbekannten Schlüssel', async () => {
    expect(await lesen('gibtsnicht')).toBeNull();
  });

  it('verwirft einen unlesbaren Eintrag, statt zu werfen', async () => {
    await AsyncStorage.setItem('salati-tv-cache:kaputt', '{kein json');
    expect(await lesen('kaputt')).toBeNull();
  });

  it('verwirft einen Eintrag mit fremder Formatversion', async () => {
    // Ein Eintrag aus einer kuenftigen Version darf nicht als heutige Struktur
    // gelesen werden — das gaebe still falsche Inhalte auf dem Bildschirm.
    await AsyncStorage.setItem('salati-tv-cache:alt', JSON.stringify({ v: 99, t: Date.now(), d: { x: 1 } }));
    expect(await lesen('alt')).toBeNull();
  });
});

describe('mitAblage', () => {
  it('nimmt bei Erfolg das Netz und legt das Ergebnis ab', async () => {
    const r = await mitAblage('k', async () => ['frisch']);
    expect(r).toEqual({ daten: ['frisch'], ausAblage: false });
    expect(await lesen('k')).toEqual(['frisch']);
  });

  it('bevorzugt das Netz, auch wenn schon etwas abgelegt ist', async () => {
    await ablegen('k', ['alt']);
    const r = await mitAblage('k', async () => ['neu']);
    expect(r.daten).toEqual(['neu']);
    expect(r.ausAblage).toBe(false);
    // Und der neue Stand ersetzt den alten.
    expect(await lesen('k')).toEqual(['neu']);
  });

  it('fällt ohne Netz auf die Ablage zurück und sagt es', async () => {
    await ablegen('k', ['alt']);
    const r = await mitAblage('k', async () => {
      throw new Error('kein netz');
    });
    expect(r).toEqual({ daten: ['alt'], ausAblage: true });
  });

  it('reicht den Fehler durch, wenn nichts abgelegt ist', async () => {
    await expect(
      mitAblage('leer', async () => {
        throw new Error('kein netz');
      }),
    ).rejects.toThrow('kein netz');
  });

  it('lässt einen Schreibfehler den Abruf nicht scheitern lassen', async () => {
    // `mockRejectedValueOnce` und NICHT `jest.spyOn(...).mockRestore()`: der
    // Mock von AsyncStorage ist selbst schon eine jest.fn, und `mockRestore`
    // laesst sie danach als leere Attrappe zurueck — jedes spaetere `setItem`
    // in dieser Datei schrieb dann ins Nichts, und vier folgende Tests fielen
    // aus einem Grund um, der nichts mit ihnen zu tun hatte.
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('platte voll'));
    const r = await mitAblage('k', async () => ['frisch']);
    expect(r.daten).toEqual(['frisch']);
  });
});

describe('aufräumen', () => {
  /** Zeitstempel von Hand setzen: `ablegen` schreibt Date.now(), und mehrere
   *  Aufrufe in derselben Millisekunde waeren nicht auseinanderzuhalten.
   *  `alterMs` zaehlt ab JETZT rueckwaerts — mit festen kleinen Zahlen (1970)
   *  griffe sonst die Altersgrenze und raeumte alles weg. */
  async function lege(key: string, alterMs: number, daten: unknown) {
    await AsyncStorage.setItem(
      `salati-tv-cache:${key}`,
      JSON.stringify({ v: 1, t: Date.now() - alterMs, d: daten }),
    );
  }

  it('behält die zuletzt geschriebenen Einträge und verwirft den Rest', async () => {
    for (let i = 0; i < 6; i++) await lege(`sure:${i}`, (6 - i) * 1000, i);
    await aufraeumen('sure:', 3);

    const uebrig = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('salati-tv-cache:sure:')).sort();
    expect(uebrig).toEqual([
      'salati-tv-cache:sure:3',
      'salati-tv-cache:sure:4',
      'salati-tv-cache:sure:5',
    ]);
  });

  it('verwirft überalterte Einträge auch unterhalb der Stückzahl-Grenze', async () => {
    // Ein Fernseher laeuft jahrelang. Ohne Altersgrenze bliebe eine Sure, die
    // vor zwei Jahren einmal gelesen wurde, fuer immer im Speicher liegen.
    const HUNDERT_TAGE = 100 * 24 * 60 * 60 * 1000;
    await lege('sure:alt', HUNDERT_TAGE, 'alt');
    await lege('sure:neu', 1000, 'neu');

    await aufraeumen('sure:', 50); // Stueckzahl weit ueber dem Bestand
    expect(await lesen('sure:alt')).toBeNull();
    expect(await lesen('sure:neu')).toBe('neu');
  });

  it('lässt andere Gruppen unangetastet', async () => {
    await ablegen('sure:1', 'a');
    await ablegen('videos', 'b');
    await aufraeumen('sure:', 0);
    expect(await lesen('videos')).toBe('b');
  });

  it('tut nichts, solange die Grenze nicht überschritten ist', async () => {
    await ablegen('sure:1', 'a');
    await aufraeumen('sure:', 5);
    expect(await lesen('sure:1')).toBe('a');
  });
});

describe('leeren', () => {
  it('entfernt nur die Ablage, nicht die Einstellungen', async () => {
    await ablegen('videos', [1]);
    await ablegen('sure:1', [2]);
    await AsyncStorage.setItem('salati-tv-settings-v1', '{"is24h":true}');

    expect(await anzahlEintraege()).toBe(2);
    expect(await leeren()).toBe(2);
    expect(await anzahlEintraege()).toBe(0);
    // Die Einstellungen liegen unter einem eigenen Schluessel und bleiben.
    expect(await AsyncStorage.getItem('salati-tv-settings-v1')).toBe('{"is24h":true}');
  });
});
