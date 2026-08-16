/**
 * Das Ausblenden der Bedienhinweise.
 *
 * Geprueft wird die Zusicherung, die der Nutzer merkt: es verschwindet nur,
 * wenn er es eingestellt hat, es kommt bei JEDEM Tastendruck zurueck, und die
 * Wartezeit beginnt dabei von vorn — sonst waere die Bedienung eine Sekunde
 * nach dem Wiederkommen schon wieder weg.
 */
import {
  ausblendenNach,
  bedienungGesehen,
  istBedienungSichtbar as sichtbar,
  zuruecksetzenFuerTest,
} from '@/lib/bedienungSichtbar';

beforeEach(() => {
  jest.useFakeTimers();
  zuruecksetzenFuerTest();
});

afterEach(() => {
  jest.useRealTimers();
});

it('blendet ohne Einstellung nie aus', () => {
  // Vorgabe ist 0 = nie. Auch nach einer Stunde muss alles stehen.
  expect(sichtbar()).toBe(true);
  jest.advanceTimersByTime(60 * 60 * 1000);
  expect(sichtbar()).toBe(true);
});

it('blendet nach der eingestellten Zeit aus', () => {
  ausblendenNach(10_000);
  expect(sichtbar()).toBe(true);
  jest.advanceTimersByTime(9_999);
  expect(sichtbar()).toBe(true);
  jest.advanceTimersByTime(1);
  expect(sichtbar()).toBe(false);
});

it('holt es bei einem Tastendruck zurueck und wartet dann wieder von vorn', () => {
  ausblendenNach(10_000);
  jest.advanceTimersByTime(10_000);
  expect(sichtbar()).toBe(false);

  bedienungGesehen();
  expect(sichtbar()).toBe(true);

  // Die Wartezeit muss NEU beginnen. Zaehlte sie weiter, waere die Bedienung
  // sofort wieder weg — genau der Fehler, den man am Geraet fuer ein Flackern
  // haelt.
  jest.advanceTimersByTime(9_999);
  expect(sichtbar()).toBe(true);
  jest.advanceTimersByTime(1);
  expect(sichtbar()).toBe(false);
});

it('zeigt beim Umschalten auf „nie" sofort wieder alles', () => {
  ausblendenNach(10_000);
  jest.advanceTimersByTime(10_000);
  expect(sichtbar()).toBe(false);

  // Wer die Einstellung ausschaltet, will das Ergebnis sehen — nicht erst
  // beim naechsten Tastendruck.
  ausblendenNach(0);
  expect(sichtbar()).toBe(true);
  jest.advanceTimersByTime(60_000);
  expect(sichtbar()).toBe(true);
});

it('setzt eine laufende Wartezeit auf die neue Zeit um', () => {
  ausblendenNach(30_000);
  jest.advanceTimersByTime(20_000);
  ausblendenNach(10_000);
  // Die alte Uhr darf nicht weiterlaufen: sonst verschwaende die Bedienung
  // 10 Sekunden nach dem Umstellen, obwohl gerade neu gestellt wurde.
  jest.advanceTimersByTime(9_999);
  expect(sichtbar()).toBe(true);
  jest.advanceTimersByTime(1);
  expect(sichtbar()).toBe(false);
});
