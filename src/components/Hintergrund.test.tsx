/**
 * Der Hintergrund muss WIRKLICH etwas zeichnen.
 *
 * Anlass ist kein hypothetischer Fall: die erste Fassung des Musters benutzte
 * `<Pattern>` aus react-native-svg und kam am Fernseher gar nicht an — eine
 * Pixelmessung am Geraet ergab ueber 600 Punkte denselben Wert. Typecheck,
 * Lint und alle Tests waren dabei gruen, weil niemand nachgesehen hat, ob am
 * Ende Striche herauskommen.
 *
 * Geprueft wird deshalb der Pfad selbst: dass er existiert, dass er den ganzen
 * Bildschirm bedeckt und dass die Deckkraft ueber der Wahrnehmungsschwelle
 * liegt.
 */
import { render } from '@testing-library/react-native';

// Der Hintergrund kann seit 2026-08-30 auch ein Video sein (components/MedienGrund.tsx).
// Hier geht es um das GEZEICHNETE — die native Video-Schicht wird deshalb
// ersetzt, statt sie in einen Test zu ziehen, der sie nicht braucht.
jest.mock('expo-video', () => ({
  useVideoPlayer: () => ({ play: jest.fn(), addListener: () => ({ remove: jest.fn() }) }),
  VideoView: 'VideoView',
}));
jest.mock('expo-image', () => ({ Image: 'Image' }));

import { Hintergrund } from '@/components/Hintergrund';
import { HINTERGRUENDE } from '@/lib/hintergruende';
import { hydrateTvSettings, setHintergrund } from '@/lib/settings';

beforeEach(async () => {
  await hydrateTvSettings();
});

/** Alle Zahlenpaare eines SVG-Pfades. */
function punkte(d: string): { x: number; y: number }[] {
  return [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
  }));
}

it('kennt genau diese gezeichneten Moeglichkeiten', () => {
  // Foto und Video stehen NICHT hier: sie kommen aus dem Katalog in R2 und
  // heissen `medium:<id>` (s. lib/hintergruende.ts).
  expect([...HINTERGRUENDE]).toEqual([
    'ruhig',
    'schein',
    'verlauf',
    'muster',
    'bewegt',
    'sterne',
    'kuppel',
  ]);
});

it('zeichnet bei „ruhig" nichts', async () => {
  setHintergrund('ruhig');
  const r = await render(<Hintergrund />);
  expect(r.toJSON()).toBeNull();
});

it('zeichnet das Muster ueber den ganzen Bildschirm', async () => {
  setHintergrund('muster');
  const r = await render(<Hintergrund />);
  const pfade = r.root!.queryAll((n) => typeof n.props?.d === 'string' && n.props.d.length > 0);
  expect(pfade.length).toBeGreaterThan(0);

  const p = punkte(pfade[0].props.d as string);
  // Ein einzelnes Quadrat haette acht Punkte — hier muessen es die eines
  // ganzen Rasters sein.
  expect(p.length).toBeGreaterThan(100);

  // Das Raster muss bis in beide Ecken reichen. Die Bildschirmgroesse im Test
  // ist 750 x 1334 (RN-Vorgabe); gepruefte Aussage ist die Abdeckung, nicht
  // die konkrete Zahl.
  const maxX = Math.max(...p.map((q) => q.x));
  const maxY = Math.max(...p.map((q) => q.y));
  expect(Math.min(...p.map((q) => q.x))).toBeLessThan(maxX * 0.15);
  expect(Math.min(...p.map((q) => q.y))).toBeLessThan(maxY * 0.15);

  // Sichtbar heisst: nicht am unteren Ende der Skala. Bei 12 % ergibt Gold auf
  // #0a0a0a einen Grauwert von 35 gegen 11 — am Bildschirm nachgemessen.
  expect(pfade[0].props.strokeOpacity).toBeGreaterThanOrEqual(0.1);
  expect(pfade[0].props.strokeWidth).toBeGreaterThanOrEqual(1.5);

  // Und die Zeichenflaeche muss eine GROESSE haben. Mit `width="100%"` kam am
  // Geraet kein einziger Strich an: die Pfadpunkte stehen in dp, und ohne
  // festes Sichtfeld legt react-native-svg keinen dazu passenden Raum an
  // (Bildschirmbefund 2026-08-16 — Typecheck, Lint und Tests waren gruen,
  // waehrend die Flaeche leer blieb).
  const flaechen = r.root!.queryAll((n) => typeof n.props?.bbWidth !== 'undefined');
  expect(flaechen.length).toBeGreaterThan(0);
  for (const f of flaechen) {
    expect(typeof f.props.bbWidth).toBe('number');
    expect(f.props.bbWidth).toBeGreaterThan(0);
    expect(f.props.bbHeight).toBeGreaterThan(0);
  }
});

/** Zaehlt Knoten eines Typs im gerenderten Baum. react-native-svg schreibt
 *  seine Eigenschaften vor dem Rendern um (`fill="url(#x)"` wird zu einem
 *  Pinselverweis), deshalb wird ueber die Knotenart geprueft und nicht ueber
 *  die geschriebene Eigenschaft. */
function zaehle(knoten: unknown, typ: string): number {
  const k = knoten as { type?: string; children?: unknown[] } | null;
  if (!k) return 0;
  const eigen = k.type === typ ? 1 : 0;
  return eigen + (k.children ?? []).reduce<number>((n, c) => n + zaehle(c, typ), 0);
}

it('legt beim Verlauf eine Flaeche mit Farbverlauf an', async () => {
  setHintergrund('verlauf');
  const r = await render(<Hintergrund />);
  const baum = r.toJSON();
  expect(zaehle(baum, 'RNSVGLinearGradient')).toBe(1);
  // Ohne die gefuellte Flaeche waere der Verlauf nur eine Angabe ohne Bild.
  expect(zaehle(baum, 'RNSVGRect')).toBe(1);
});

it('setzt beim Lichtschein zwei Lichter', async () => {
  setHintergrund('schein');
  const r = await render(<Hintergrund />);
  // AmbientGlow zeichnet je Licht einen eigenen Radialverlauf.
  expect(zaehle(r.toJSON(), 'RNSVGRadialGradient')).toBe(2);
});

it('zeichnet bei „bewegt" die Rosette', async () => {
  setHintergrund('bewegt');
  const r = await render(<Hintergrund />);
  // Zwoelf Kreise auf einem Kreis plus zwei Ringe - ohne sie waere der Grund
  // leer und die Drehung ginge ins Nichts.
  const kreise = r.root!.queryAll((n) => typeof n.props?.r === 'number' && n.props.r > 0);
  expect(kreise.length).toBeGreaterThanOrEqual(14);
  // Und die Strahlen: ohne sie saehe die Rosette gedreht genauso aus wie
  // ungedreht - die Bewegung waere unsichtbar.
  const pfade = r.root!.queryAll((n) => typeof n.props?.d === 'string' && n.props.d.length > 0);
  expect(pfade.length).toBeGreaterThan(0);
});
