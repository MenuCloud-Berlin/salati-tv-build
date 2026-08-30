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
/**
 * Bildschirm aus einem Startargument lesen: `-salatiScreen home`.
 *
 * Warum zusaetzlich zum Deep Link: Apple TV fragt bei einer von aussen
 * geoeffneten Adresse zurueck („Open in ‚Salati TV'?") und wartet auf einen
 * Tastendruck — im Simulator gibt es keinen, also blieb die Bildschirmfoto-
 * Automatik an genau diesem Fenster haengen (Lauf 31491392843, alle acht Bilder
 * zeigten dieselbe Uhr mit Rueckfrage). Ein Startargument geht diesen Weg gar
 * nicht erst: es steht beim Start schon in den Voreinstellungen des Prozesses
 * (`NativeModules.SettingsManager.settings`, NSArgumentDomain).
 *
 * Fuer eine installierte App ist das wirkungslos — Startargumente lassen sich
 * einer aus dem Store geladenen tvOS-App nicht mitgeben.
 */
export function screenFromLaunchArgument(einstellungen: unknown): Screen | null {
  if (!einstellungen || typeof einstellungen !== 'object') return null;
  const wert = (einstellungen as Record<string, unknown>).salatiScreen;
  return isScreen(wert) ? wert : null;
}

export function screenFromUrl(url: string | null | undefined): Screen | null {
  if (typeof url !== 'string') return null;
  const treffer = /^salatitv:\/\/screen\/([a-z]+)(?:\/\d+)?\/?$/i.exec(url.trim());
  const name = treffer?.[1]?.toLowerCase();
  return isScreen(name) ? name : null;
}

/**
 * Ein Ziel INNERHALB eines Bildschirms.
 *
 * Warum es das gibt: die Bildschirmfoto-Automatik kam nur bis zur Auswahl. Auf
 * der Store-Seite stand deshalb unter „Den Koran am Fernseher lesen" eine Liste
 * von Surennamen — von dem, was die Unterschrift verspricht, war nichts zu
 * sehen. Am Fernseher fuehrt die Fernbedienung weiter; im tvOS-Simulator gibt
 * es keine, also muss das Ziel beim Start mitkommen.
 *
 * Der Wert ist BEWUSST unverbindlich: was nicht passt, wird verworfen und der
 * Bildschirm startet wie immer. Ein falscher Wert von aussen darf nie mehr
 * bewirken, als ignoriert zu werden.
 */
export function surahFromLaunchArgument(einstellungen: unknown): number | null {
  if (!einstellungen || typeof einstellungen !== 'object') return null;
  return pruefeSure((einstellungen as Record<string, unknown>).salatiSure);
}

/** Sure aus einer Adresse: `salatitv://screen/quran/4`. */
export function surahFromUrl(url: string | null | undefined): number | null {
  if (typeof url !== 'string') return null;
  const treffer = /^salatitv:\/\/screen\/quran\/(\d+)\/?$/i.exec(url.trim());
  return pruefeSure(treffer?.[1]);
}

function pruefeSure(wert: unknown): number | null {
  const n = typeof wert === 'number' ? wert : typeof wert === 'string' ? Number(wert) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 114 ? n : null;
}

/** Bereiche des Einstellungs-Bildschirms — Reihenfolge wie in der Leiste. */
export const SETTINGS_BEREICHE = [
  'language',
  'location',
  'prayer',
  'azan',
  'display',
  // Eigener Bereich seit 2026-08-30: mit Fotos und Videos sind es zu viele
  // Kacheln fuer „Darstellung" geworden, und mit der Fernbedienung ist jede
  // zusaetzliche Kachel ein Tastendruck (derselbe Grund, aus dem es die
  // Bereiche ueberhaupt gibt).
  'hintergrund',
  'reader',
  'storage',
] as const;

export type SettingsBereich = (typeof SETTINGS_BEREICHE)[number];

export function istSettingsBereich(v: unknown): v is SettingsBereich {
  return typeof v === 'string' && (SETTINGS_BEREICHE as readonly string[]).includes(v);
}

/** Bereich aus einem Startargument: `-salatiBereich prayer`. */
export function settingsBereichFromLaunchArgument(einstellungen: unknown): SettingsBereich | null {
  if (!einstellungen || typeof einstellungen !== 'object') return null;
  const wert = (einstellungen as Record<string, unknown>).salatiBereich;
  return istSettingsBereich(wert) ? wert : null;
}
