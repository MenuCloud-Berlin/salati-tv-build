/**
 * Was hinter allen Bildschirmen liegen kann — als reine Werte, ohne Zeichnung.
 *
 * WARUM ES DIESE DATEI GIBT: Der Katalog stand bis 2026-08-30 in
 * `components/Hintergrund.tsx`, und `lib/settings.ts` holte sich `istHintergrundId`
 * von dort. Solange dieser Baustein nur SVG zeichnete, war das harmlos. Mit den
 * Foto- und Video-Hintergruenden zog derselbe Import plötzlich `expo-video`
 * und `expo-file-system` in JEDE Datei, die Einstellungen liest — bis in die
 * reinen Logik-Tests, die daran sofort scheiterten.
 *
 * Die Kennungen sind Daten, keine Darstellung. Hier stehen sie ohne einen
 * einzigen Import.
 */

export type GezeichneterHintergrund =
  | 'ruhig'
  | 'schein'
  | 'verlauf'
  | 'muster'
  | 'bewegt'
  | 'sterne'
  | 'kuppel';

/**
 * Gezeichnet oder ein Motiv aus dem Katalog (`medium:<id>`, s.
 * lib/hintergrundMedien.ts). EINE Einstellung fuer beides — zwei waeren zwei
 * Wahrheiten darueber, was gerade hinten liegt.
 */
export type HintergrundId = GezeichneterHintergrund | `medium:${string}`;

export const HINTERGRUENDE: readonly GezeichneterHintergrund[] = [
  'ruhig',
  'schein',
  'verlauf',
  'muster',
  'bewegt',
  'sterne',
  'kuppel',
];

/** Kennung eines Motivs in den Einstellungen. */
export function medienId(id: string): `medium:${string}` {
  return `medium:${id}`;
}

/**
 * Umgekehrt: `medium:kaaba-nacht` → `kaaba-nacht`; sonst `null`.
 *
 * Das Muster ist eng gefasst (Kleinbuchstaben, Ziffern, Bindestrich), und das
 * ist kein Schoenheitsgrund: aus der Kennung wird ein DATEINAME auf dem Geraet
 * gebildet. Ein `/` oder `..` darin waere ein Pfad in ein fremdes Verzeichnis.
 */
export function medienIdLesen(wert: unknown): string | null {
  if (typeof wert !== 'string') return null;
  const treffer = /^medium:([a-z0-9-]{1,64})$/.exec(wert);
  return treffer ? treffer[1] : null;
}

export function istHintergrundId(v: unknown): v is HintergrundId {
  if (typeof v !== 'string') return false;
  if ((HINTERGRUENDE as readonly string[]).includes(v)) return true;
  return medienIdLesen(v) !== null;
}

/** Locale-Schluessel des Anzeigenamens eines gezeichneten Hintergrunds. */
export function hintergrundNameKey(id: GezeichneterHintergrund): string {
  return `settings.background.${id}`;
}
