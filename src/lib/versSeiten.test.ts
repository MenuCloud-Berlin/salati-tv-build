/**
 * Der Grenzfall, an dem der Leser bis 1.9.0 gescheitert ist: ein Vers, der
 * laenger ist als der Bildschirm.
 *
 * Geprueft wird nicht, dass eine Funktion aufgerufen wurde, sondern die
 * Zusicherung, die der Nutzer sieht: KEIN Wort geht verloren, KEIN Abschnitt
 * braucht mehr Zeilen, als in die Flaeche passen, und die Schrift wird nicht so
 * klein, dass sie auf Fernsehabstand unlesbar wird.
 */
import {
  abschnitteAufteilen,
  abschnittVonWort,
  textAbschnitte,
  textFaktor,
  versLayout,
  wortBreiteEm,
} from '@/lib/versSeiten';

/** Ein 1080er Panel, groesste Schriftstufe — der ungeguenstigste Fall.
 *  Werte aus readerVerseMetrics(1080, 1.4) und dem Buehnenmass des Lesers. */
const PANEL = { breite: 1920 - 260, hoehe: 640, fontSize: 150, lineHeight: 210 };

/** Ein Wort aus Sure 2, Vers 282 im Uthmani-Wortlaut — mit den Vokalzeichen,
 *  auf die es bei der Breitenrechnung ankommt. */
const WORT = 'الَّذِينَ'; // ٱلَّذِينَ

function verseMit(anzahl: number): string[] {
  return Array.from({ length: anzahl }, () => WORT);
}

describe('wortBreiteEm', () => {
  it('zaehlt kombinierende Zeichen NICHT mit', () => {
    const ohne = wortBreiteEm('كفروا'); // كفروا
    const mit = wortBreiteEm('كَفَرُواۡ'); // كَفَرُوا۟
    expect(mit).toBeCloseTo(ohne, 5);
  });

  it('gibt auch fuer ein Wort ohne sichtbare Buchstaben eine Breite', () => {
    expect(wortBreiteEm('َُ')).toBeGreaterThan(0);
  });
});

describe('abschnitteAufteilen', () => {
  it('verliert kein Wort und wiederholt keines', () => {
    const woerter = verseMit(128);
    const abschnitte = abschnitteAufteilen(woerter, PANEL.breite, 3, PANEL.fontSize);
    const alle = abschnitte.flat();
    expect(alle).toEqual(woerter.map((_, i) => i));
  });

  it('haelt jeden Abschnitt innerhalb seiner Zeilenzahl', () => {
    const zeilenProAbschnitt = 3;
    const abschnitte = abschnitteAufteilen(verseMit(128), PANEL.breite, zeilenProAbschnitt, PANEL.fontSize);
    for (const a of abschnitte) {
      // Zeilen dieses Abschnitts nachrechnen — mit derselben Greedy-Regel.
      let zeilen = 1;
      let belegt = 0;
      for (let k = 0; k < a.length; k++) {
        const b = wortBreiteEm(WORT) * PANEL.fontSize;
        if (belegt > 0 && belegt + b > PANEL.breite) {
          zeilen += 1;
          belegt = 0;
        }
        belegt += b;
      }
      expect(zeilen).toBeLessThanOrEqual(zeilenProAbschnitt);
    }
  });

  it('legt ein ueberbreites Wort in eine eigene Zeile, statt haengen zu bleiben', () => {
    const riesig = 'ب'.repeat(400);
    const abschnitte = abschnitteAufteilen([riesig, riesig], 100, 2, 40);
    expect(abschnitte.flat()).toEqual([0, 1]);
  });

  it('gibt bei fehlender Messung alles in einem Abschnitt zurueck', () => {
    // Vor dem ersten onLayout ist die Breite 0 — dann darf nichts wegfallen.
    expect(abschnitteAufteilen(verseMit(5), 0, 3, PANEL.fontSize)).toEqual([[0, 1, 2, 3, 4]]);
  });
});

describe('versLayout', () => {
  it('laesst kurze Verse in voller Groesse und in einem Stueck', () => {
    const l = versLayout({ woerter: verseMit(4), ...PANEL });
    expect(l.faktor).toBe(1);
    expect(l.abschnitte).toHaveLength(1);
  });

  it('verkleinert erst, bevor es blaettert', () => {
    // Ein Vers, der bei voller Groesse knapp zwei Abschnitte braucht.
    const l = versLayout({ woerter: verseMit(14), ...PANEL });
    expect(l.abschnitte).toHaveLength(1);
    expect(l.faktor).toBeLessThan(1);
  });

  it('bleibt beim laengsten Vers des Korans lesbar und vollstaendig', () => {
    const woerter = verseMit(128); // Sure 2, Vers 282
    const l = versLayout({ woerter, ...PANEL });
    expect(l.abschnitte.length).toBeGreaterThan(1);
    expect(l.faktor).toBeGreaterThanOrEqual(0.64); // nicht kleiner als lesbar
    expect(l.abschnitte.flat()).toEqual(woerter.map((_, i) => i));
  });

  it('gibt ohne Messung einen Abschnitt mit allen Woertern', () => {
    const l = versLayout({ woerter: verseMit(50), breite: 0, hoehe: 0, fontSize: 0, lineHeight: 0 });
    expect(l.abschnitte).toHaveLength(1);
    expect(l.abschnitte[0]).toHaveLength(50);
  });
});

describe('abschnittVonWort', () => {
  const abschnitte = [
    [0, 1, 2],
    [3, 4],
    [5],
  ];

  it('findet den Abschnitt des laufenden Wortes', () => {
    expect(abschnittVonWort(abschnitte, 4)).toBe(1);
    expect(abschnittVonWort(abschnitte, 5)).toBe(2);
  });

  it('bleibt beim ersten Abschnitt, solange kein Wort laeuft', () => {
    // -1 kommt vom Paket-Text ohne Zeitstempel und vor dem ersten Wort.
    expect(abschnittVonWort(abschnitte, -1)).toBe(0);
    expect(abschnittVonWort(abschnitte, 99)).toBe(0);
  });
});

describe('textFaktor', () => {
  const box = { breite: 1660, hoehe: 160, fontSize: 42, lineHeight: 60 };

  it('laesst kurze Uebersetzungen unangetastet', () => {
    expect(textFaktor({ text: 'Im Namen Gottes.', ...box })).toBe(1);
  });

  it('verkleinert lange Uebersetzungen, aber nicht ins Unlesbare', () => {
    const lang = 'Wort '.repeat(200);
    const f = textFaktor({ text: lang, ...box });
    expect(f).toBeLessThan(1);
    expect(f).toBeGreaterThanOrEqual(0.56);
  });

  it('verkleinert so weit, dass es WIRKLICH hineinpasst', () => {
    // Der Fall, an dem die erste Fassung gescheitert ist (An-Nisaa 1,
    // Bildschirmbefund 2026-08-16): sie rechnete den Faktor in EINEM Zug aus
    // der Wurzel des Verhaeltnisses aus und landete wieder bei derselben
    // Zeilenzahl — die letzte Zeile wurde unten abgeschnitten.
    const faelle = [
      { text: 'a'.repeat(175), breite: 845, hoehe: 69, fontSize: 19.4, lineHeight: 26.2 },
      { text: 'b'.repeat(400), breite: 1200, hoehe: 120, fontSize: 30, lineHeight: 40 },
      { text: 'c'.repeat(90), breite: 600, hoehe: 40, fontSize: 20, lineHeight: 26 },
    ];
    for (const fall of faelle) {
      const f = textFaktor(fall);
      const zeilen = Math.max(
        1,
        Math.ceil((fall.text.length * 0.5 * 1.12 * fall.fontSize * f) / fall.breite),
      );
      expect(zeilen * fall.lineHeight * f).toBeLessThanOrEqual(fall.hoehe);
    }
  });
});

describe('textAbschnitte', () => {
  it('gibt bei einem Abschnitt den ganzen Text', () => {
    expect(textAbschnitte('a b c', 1)).toEqual(['a b c']);
  });

  it('verliert kein Wort', () => {
    const text = Array.from({ length: 97 }, (_, i) => `w${i}`).join(' ');
    const teile = textAbschnitte(text, 4);
    expect(teile.join(' ').trim().split(/\s+/)).toEqual(text.split(' '));
  });

  it('liefert immer so viele Teile wie Abschnitte', () => {
    expect(textAbschnitte('a b c', 5)).toHaveLength(1); // weniger Woerter als Teile
    expect(textAbschnitte('a b c d e f g h i j', 3)).toHaveLength(3);
  });

  it('vertraegt eine fehlende Uebersetzung', () => {
    expect(textAbschnitte('', 3)).toEqual(['']);
  });
});
