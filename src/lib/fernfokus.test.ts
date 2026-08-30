import {
  aktiveKarteFuerTest,
  anmelden,
  bewerte,
  fernTaste,
  fokusGemeldet,
  istFernTaste,
  lageGemeldet,
  zuruecksetzenFuerTest,
  type Lage,
} from '@/lib/fernfokus';

// Der Befund, der diese Datei ausgeloest hat (2026-08-30): das Handy schickte
// seit jeher `key`-Kommandos, der Fernseher wertete nur `back` aus. Hier steht
// deshalb nicht nur die Richtungsrechnung, sondern auch, dass eine Taste
// ueberhaupt etwas bewegt.

interface Karte {
  id: number;
  fokusse: number;
  ausloesungen: number;
}

/** Legt eine Karte an der angegebenen Lage an — wie eine FocusCard es taete. */
function karte(lage: Lage): Karte {
  const k: Karte = { id: 0, fokusse: 0, ausloesungen: 0 };
  const { id } = anmelden({
    messen: () => Promise.resolve(lage),
    fokussieren: () => {
      k.fokusse += 1;
      // Die Plattform meldet den Fokus zurueck; am Geraet macht das `onFocus`.
      fokusGemeldet(k.id);
    },
    ausloesen: () => {
      k.ausloesungen += 1;
    },
  });
  k.id = id;
  lageGemeldet(id, lage);
  return k;
}

/** Raster wie im Home-Hub: fuenf Spalten, zwei Reihen, 300x200 mit 20 Abstand. */
function raster(): Karte[][] {
  const reihen: Karte[][] = [];
  for (let z = 0; z < 2; z++) {
    const reihe: Karte[] = [];
    for (let sp = 0; sp < 5; sp++) {
      reihe.push(karte({ x: 60 + sp * 320, y: 200 + z * 220, w: 300, h: 200 }));
    }
    reihen.push(reihe);
  }
  return reihen;
}

beforeEach(() => zuruecksetzenFuerTest());

describe('istFernTaste', () => {
  it('nimmt die fuenf Tasten und verwirft alles andere', () => {
    for (const t of ['up', 'down', 'left', 'right', 'select']) expect(istFernTaste(t)).toBe(true);
    for (const t of ['back', 'UP', '', null, 7, undefined]) expect(istFernTaste(t)).toBe(false);
  });
});

describe('bewerte', () => {
  const a: Lage = { x: 0, y: 0, w: 100, h: 100 };

  it('schliesst aus, was nicht in der Richtung liegt', () => {
    expect(bewerte(a, { x: 0, y: 200, w: 100, h: 100 }, 'up')).toBeNull();
    expect(bewerte(a, { x: 200, y: 0, w: 100, h: 100 }, 'left')).toBeNull();
    // Dieselbe Reihe ist kein Ziel fuer hoch/runter.
    expect(bewerte(a, { x: 200, y: 0, w: 100, h: 100 }, 'down')).toBeNull();
  });

  it('bevorzugt die Karte in derselben Spalte vor der schraegen', () => {
    const geradeaus = bewerte(a, { x: 0, y: 200, w: 100, h: 100 }, 'down')!;
    const schraeg = bewerte(a, { x: 150, y: 160, w: 100, h: 100 }, 'down')!;
    expect(geradeaus).toBeLessThan(schraeg);
  });
});

describe('fernTaste', () => {
  it('legt den Fokus auf die erste Karte, wenn noch keine ihn hat', async () => {
    const r = raster();
    expect(await fernTaste('down')).toBe(true);
    expect(r[0][0].fokusse).toBe(1);
  });

  it('bewegt den Fokus im Raster in alle vier Richtungen', async () => {
    const r = raster();
    fokusGemeldet(r[0][2].id);

    await fernTaste('right');
    expect(aktiveKarteFuerTest()).toBe(r[0][3].id);
    await fernTaste('down');
    expect(aktiveKarteFuerTest()).toBe(r[1][3].id);
    await fernTaste('left');
    expect(aktiveKarteFuerTest()).toBe(r[1][2].id);
    await fernTaste('up');
    expect(aktiveKarteFuerTest()).toBe(r[0][2].id);
  });

  it('laeuft am Rand nicht um', async () => {
    const r = raster();
    fokusGemeldet(r[0][0].id);
    expect(await fernTaste('up')).toBe(false);
    expect(await fernTaste('left')).toBe(false);
    expect(aktiveKarteFuerTest()).toBe(r[0][0].id);
  });

  it('OK loest die fokussierte Karte aus — und sonst keine', async () => {
    const r = raster();
    fokusGemeldet(r[1][1].id);
    expect(await fernTaste('select')).toBe(true);
    expect(r[1][1].ausloesungen).toBe(1);
    expect(r[0][0].ausloesungen).toBe(0);
  });

  it('OK ohne Fokus tut nichts (der Aufrufer entscheidet dann selbst)', async () => {
    raster();
    expect(await fernTaste('select')).toBe(false);
  });

  it('vermisst vor jeder Bewegung neu — eine gescrollte Liste bleibt steuerbar', async () => {
    // Zwei Karten untereinander; die untere wandert durch Scrollen nach OBEN.
    let untenLage: Lage = { x: 0, y: 300, w: 200, h: 100 };
    const oben = karte({ x: 0, y: 0, w: 200, h: 100 });
    const unten: Karte = { id: 0, fokusse: 0, ausloesungen: 0 };
    const { id } = anmelden({
      messen: () => Promise.resolve(untenLage),
      fokussieren: () => {
        unten.fokusse += 1;
        fokusGemeldet(unten.id);
      },
      ausloesen: () => {},
    });
    unten.id = id;

    fokusGemeldet(oben.id);
    await fernTaste('down');
    expect(aktiveKarteFuerTest()).toBe(unten.id);

    // Nach dem Scrollen liegt sie oberhalb — „hoch" muss sie jetzt finden.
    untenLage = { x: 0, y: -300, w: 200, h: 100 };
    fokusGemeldet(oben.id);
    expect(await fernTaste('down')).toBe(false);
    await fernTaste('up');
    expect(aktiveKarteFuerTest()).toBe(unten.id);
  });

  it('vergisst abgemeldete Karten', async () => {
    const bleibt = karte({ x: 0, y: 0, w: 100, h: 100 });
    const geht = karte({ x: 0, y: 200, w: 100, h: 100 });
    fokusGemeldet(bleibt.id);
    zuruecksetzenFuerTest();
    const nur = karte({ x: 0, y: 0, w: 100, h: 100 });
    fokusGemeldet(nur.id);
    expect(await fernTaste('down')).toBe(false);
    expect(geht.fokusse).toBe(0);
  });
});
