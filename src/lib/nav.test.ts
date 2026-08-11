/**
 * Screen-Liste der TV-App (Audit 2026-07-28, T14).
 *
 * `SCREENS` ist die einzige Quelle: der Typ, die Pruefung eingehender
 * Fernbedienungs-Befehle, die Handshake-Meldung ans Handy und der Handy-seitige
 * Katalog haengen daran. Dieser Test haelt fest, dass jeder Eintrag auch
 * wirklich gerendert wird — eine Zeile in der Liste ohne Zweig in App.tsx
 * ergaebe einen schwarzen Fernseher ohne Fokus-Anker.
 */
import fs from 'fs';
import path from 'path';

import { SCREENS, isScreen } from '@/lib/nav';

const APP_TSX = path.join(__dirname, '..', '..', 'App.tsx');

describe('SCREENS', () => {
  it('hat keine Doubletten', () => {
    expect(new Set(SCREENS).size).toBe(SCREENS.length);
  });

  it('wird in App.tsx vollstaendig gerendert', () => {
    const src = fs.readFileSync(APP_TSX, 'utf8');
    const rendered = [...src.matchAll(/screen === '([a-z]+)'/g)].map((m) => m[1]);
    // 'clock' steht in App.tsx zusaetzlich im TV-Event-Handler; deshalb Menge
    // statt Reihenfolge/Anzahl vergleichen.
    expect([...new Set(rendered)].sort()).toEqual([...SCREENS].sort());
  });
});

describe('isScreen', () => {
  it('erkennt jeden bekannten Bildschirm', () => {
    for (const s of SCREENS) expect(isScreen(s)).toBe(true);
  });

  it('weist alles andere ab', () => {
    // Genau der Fall, der den Fernseher schwarz zuruecklassen wuerde: ein
    // neueres Handy schickt einen Namen, den diese Version nicht kennt.
    for (const v of ['hifz', '', 'Clock', null, undefined, 42, {}]) {
      expect(isScreen(v)).toBe(false);
    }
  });
});
