/**
 * Das Ziffernblatt muss die richtige Zeit ZEIGEN, nicht nur zeichnen.
 *
 * Ein analoges Blatt hat den unangenehmen Zug, dass es auch mit falsch
 * stehenden Zeigern plausibel aussieht — anders als eine Ziffer, die man
 * ablesen kann. Geprueft wird deshalb die Rechnung dahinter, und zwar gegen
 * die Regel, an der man sie am Bildschirm nachvollziehen wuerde.
 */
import { render } from '@testing-library/react-native';

import { bogenPfad, zeigerWinkel, Ziffernblatt } from '@/components/Ziffernblatt';
import { themeById } from '@/lib/theme';

describe('zeigerWinkel', () => {
  it('stellt 3:00:00 auf 90 Grad', () => {
    const w = zeigerWinkel(3, 0, 0);
    expect(w.stunde).toBeCloseTo(90, 6);
    expect(w.minute).toBeCloseTo(0, 6);
    expect(w.sekunde).toBeCloseTo(0, 6);
  });

  it('nimmt den Stundenzeiger auf halber Stunde mit', () => {
    // 3:30 — der Stundenzeiger steht ZWISCHEN 3 und 4, nicht auf der 3.
    const w = zeigerWinkel(3, 30, 0);
    expect(w.stunde).toBeCloseTo(105, 6);
    expect(w.minute).toBeCloseTo(180, 6);
  });

  it('nimmt den Minutenzeiger mit den Sekunden mit', () => {
    expect(zeigerWinkel(1, 0, 30).minute).toBeCloseTo(3, 6);
  });

  it('kennt nur zwoelf Stunden — 9 Uhr und 21 Uhr stehen gleich', () => {
    expect(zeigerWinkel(21, 0, 0).stunde).toBeCloseTo(zeigerWinkel(9, 0, 0).stunde, 6);
  });

  it('faengt um zwoelf wieder bei null an', () => {
    expect(zeigerWinkel(12, 0, 0).stunde).toBeCloseTo(0, 6);
    expect(zeigerWinkel(0, 0, 0).stunde).toBeCloseTo(0, 6);
  });
});

describe('bogenPfad', () => {
  it('faellt weg, wenn er nichts aussagt', () => {
    expect(bogenPfad(0, 0, 200, 180)).toBeNull();
    expect(bogenPfad(-1, 0, 200, 180)).toBeNull();
    // Ab zwoelf Stunden waere er ein voller Kreis.
    expect(bogenPfad(12 * 60 * 60 * 1000, 0, 200, 180)).toBeNull();
    expect(bogenPfad(13 * 60 * 60 * 1000, 0, 200, 180)).toBeNull();
  });

  it('zeichnet fuer eine Stunde einen kurzen Bogen — kleiner Winkel, kein Grossbogen', () => {
    const d = bogenPfad(60 * 60 * 1000, 0, 200, 180)!;
    expect(d).toMatch(/^M[\d.,-]+ A180,180 0 0,1 /);
  });

  it('setzt bei mehr als sechs Stunden das Grossbogen-Merkmal', () => {
    // 7 h sind 210 Grad; ohne das Merkmal zeichnete SVG den kurzen Weg.
    const d = bogenPfad(7 * 60 * 60 * 1000, 0, 200, 180)!;
    expect(d).toMatch(/A180,180 0 1,1 /);
  });

  it('beginnt an der Stellung des Stundenzeigers', () => {
    // Startwinkel 0 → zwoelf Uhr, also senkrecht ueber der Mitte.
    const d = bogenPfad(60 * 60 * 1000, 0, 200, 180)!;
    const [x, y] = /^M([\d.-]+),([\d.-]+)/.exec(d)!.slice(1).map(Number);
    expect(x).toBeCloseTo(200, 1);
    expect(y).toBeCloseTo(20, 1);
  });
});

it('zeichnet ein Blatt mit Zeigern', async () => {
  const r = await render(
    <Ziffernblatt
      groesse={400}
      stunde={10}
      minute={9}
      sekunde={30}
      sekundenZeiger
      bisNaechstemGebetMs={45 * 60 * 1000}
      strichstaerke={1}
      theme={themeById('mitternacht')}
    />,
  );
  const pfade = r.root!.queryAll((n) => typeof n.props?.d === 'string' && (n.props.d as string).length > 0);
  // Zwei Pfade: der Countdown-Bogen und die Minutenstriche.
  expect(pfade.length).toBe(2);
  // Die 60 Minutenstriche liegen als EIN Pfad vor — 120 Punkte.
  const meiste = Math.max(
    ...pfade.map((p) => [...(p.props.d as string).matchAll(/[\d.]+,[\d.]+/g)].length),
  );
  expect(meiste).toBeGreaterThanOrEqual(120);
});
