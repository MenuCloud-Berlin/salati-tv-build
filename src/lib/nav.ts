// Zustandsbasierte Navigation (kein Router nötig für die überschaubare
// TV-Screen-Menge; react-native-tvos steuert den Fokus, wir schalten den
// aktiven Screen um). Clock = Default/Screensaver, Home = Hub.
//
// `SCREENS` ist die EINZIGE Quelle der Wahrheit (Audit 2026-07-28, T14): der
// Typ leitet sich daraus ab, `App.tsx` prüft eingehende Fernbedienungs-Befehle
// dagegen, der Kopplungs-Handshake meldet die Liste ans Handy, und der Test
// `apps/mobile/src/features/tv/screens.test.ts` liest genau diese Datei. Vorher
// stand die Liste zweimal getrennt da (hier als Typ, im Handy als feste
// Sprungziel-Liste) — fünf der elf Bildschirme waren deshalb vom Handy aus
// unerreichbar, ohne dass irgendetwas rot wurde.
export const SCREENS = [
  'clock',
  'home',
  'videos',
  'reels',
  'radio',
  'reciters',
  'quran',
  'podcasts',
  'quiz',
  'pairing',
  'settings',
] as const;

export type Screen = (typeof SCREENS)[number];

/**
 * Prüft einen von außen (Handy-Fernbedienung) gelieferten Wert.
 *
 * Ohne diese Prüfung landete ein unbekannter Screen-Name direkt im State und
 * die TV-App rendert dann GAR NICHTS — kein fokussierbares Element, also auch
 * kein Weg mit der Fernbedienung zurück (derselbe Fehlertyp wie am 2026-07-24).
 * Ein neueres Handy an einem älteren Fernseher genügt dafür.
 */
export function isScreen(value: unknown): value is Screen {
  return typeof value === 'string' && (SCREENS as readonly string[]).includes(value);
}

/**
 * Bildschirm aus einer Deep-Link-Adresse lesen: `salatitv://screen/home`.
 *
 * Dieselbe Umschaltung, die das Handy ueber die Kopplung ausloest — nur ueber
 * den Weg, den das Betriebssystem selbst mitbringt. Genutzt von der
 * Bildschirmfoto-Automatik (`xcrun simctl openurl`, `adb am start -d`), die
 * sonst keinen Weg haette, die Fernbedienung zu bedienen.
 *
 * Streng geprueft: `salatitv://pair?host=…` ist die Nutzlast, die der Fernseher
 * fuer das HANDY erzeugt (s. `pairPayload`). Bekaeme er sie zurueck, darf sie
 * nichts umschalten — deshalb muss der Wirt genau `screen` heissen.
 */
export function screenFromUrl(url: string | null | undefined): Screen | null {
  if (typeof url !== 'string') return null;
  const treffer = /^salatitv:\/\/screen\/([a-z]+)\/?$/i.exec(url.trim());
  const name = treffer?.[1]?.toLowerCase();
  return isScreen(name) ? name : null;
}
