import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Ablage fuer alles, was die App aus dem Netz holt — damit der Fernseher auch
 * ohne Netz noch etwas zeigt.
 *
 * WARUM: Bis 1.4.0 war JEDER Inhalt ausser Gebetszeiten und Quiz an eine
 * funktionierende Verbindung gebunden. Fiel sie aus, zeigten Rezitatoren,
 * Radio, Videos, Reels, Podcasts und der Koran-Leser genau eine Sache: eine
 * Fehlermeldung mit „Erneut versuchen". Ein Fernseher steht aber oft am Rand
 * des WLANs, und ein Gast-Netz mit Captive Portal sieht fuer die App aus wie
 * gar kein Netz.
 *
 * Jetzt gilt: Was einmal geladen wurde, bleibt da. Der Abruf geht weiterhin
 * ZUERST ins Netz (die Indizes aendern sich, neue Folgen sollen erscheinen);
 * erst wenn er scheitert, tritt die Ablage ein. Das ist bewusst herum so —
 * andersherum saehe der Nutzer wochenlang einen alten Stand.
 *
 * SPEICHER: AsyncStorage, nicht das Dateisystem. Es liegt bereits im Bundle
 * (die Einstellungen nutzen es), waehrend `expo-file-system` ein weiteres
 * natives Modul waere. Dafuer wird die Groesse hier selbst begrenzt: je
 * Bereich eine Obergrenze an Eintraegen, die aeltesten fliegen zuerst.
 * Mediendateien (MP3/MP4) landen NICHT hier — die sind zu gross und laufen
 * ohnehin als Stream.
 */

const PREFIX = 'salati-tv-cache:';
/** Aufbewahrungsfrist. Aelteres wird noch benutzt, wenn nichts anderes da ist,
 *  aber beim Aufraeumen zuerst verworfen. */
const MAX_ALTER_MS = 90 * 24 * 60 * 60 * 1000;

interface Eintrag<T> {
  /** Format-Version: aendert sich die Struktur, wird Altes verworfen statt
   *  falsch gelesen. */
  v: 1;
  /** Zeitpunkt der Ablage (ms). */
  t: number;
  d: T;
}

function schluessel(key: string): string {
  return `${PREFIX}${key}`;
}

/** Legt einen Wert ab. Fehler werden verschluckt: eine volle Platte darf den
 *  Abruf nicht scheitern lassen — der Inhalt ist ja schon da. */
export async function ablegen<T>(key: string, daten: T): Promise<void> {
  try {
    const eintrag: Eintrag<T> = { v: 1, t: Date.now(), d: daten };
    await AsyncStorage.setItem(schluessel(key), JSON.stringify(eintrag));
  } catch {
    /* ignorieren */
  }
}

/** Liest einen Wert. `null`, wenn nichts da ist oder der Eintrag unbrauchbar. */
export async function lesen<T>(key: string): Promise<T | null> {
  try {
    const roh = await AsyncStorage.getItem(schluessel(key));
    if (!roh) return null;
    const eintrag = JSON.parse(roh) as Partial<Eintrag<T>>;
    if (eintrag?.v !== 1 || eintrag.d === undefined) return null;
    return eintrag.d as T;
  } catch {
    return null;
  }
}

/**
 * Netz zuerst, Ablage als Rueckfall.
 *
 * Gibt zusaetzlich zurueck, WOHER die Daten kommen — die Bildschirme sagen es
 * dem Nutzer. Ein stiller alter Stand waere schlechter als ein sichtbarer:
 * wer nicht weiss, dass er Zwischengespeichertes sieht, haelt eine fehlende
 * neue Folge fuer einen Fehler der App.
 *
 * Scheitert das Netz UND ist nichts abgelegt, fliegt der urspruengliche Fehler
 * weiter — der Bildschirm zeigt dann wie bisher „Erneut versuchen".
 */
export async function mitAblage<T>(
  key: string,
  laden: () => Promise<T>,
): Promise<{ daten: T; ausAblage: boolean }> {
  try {
    const daten = await laden();
    void ablegen(key, daten);
    return { daten, ausAblage: false };
  } catch (fehler) {
    const abgelegt = await lesen<T>(key);
    if (abgelegt !== null) return { daten: abgelegt, ausAblage: true };
    throw fehler;
  }
}

/**
 * Haelt die Ablage einer Gruppe klein: behaelt die `anzahl` zuletzt
 * geschriebenen Eintraege mit diesem Praefix, verwirft den Rest.
 *
 * Gebraucht fuer die Suren des Lesers — 114 Suren mal Uebersetzung waeren
 * mehrere Megabyte in AsyncStorage. Die zuletzt gelesenen sind die, die
 * jemand wieder aufschlaegt.
 */
export async function aufraeumen(gruppe: string, anzahl: number): Promise<void> {
  try {
    const alle = await AsyncStorage.getAllKeys();
    const meine = alle.filter((k) => k.startsWith(`${PREFIX}${gruppe}`));
    if (meine.length === 0) return;

    // KEIN vorzeitiges Zurueck bei `meine.length <= anzahl`: die Altersgrenze
    // muss auch dann greifen. Sonst laege eine Sure, die vor zwei Jahren einmal
    // gelesen wurde, fuer immer im Speicher — ein Fernseher laeuft jahrelang,
    // und die Stueckzahl-Grenze wird bei gelegentlicher Nutzung nie erreicht.
    // (Der Test „verwirft ueberalterte Eintraege auch unterhalb der
    // Stueckzahl-Grenze" hat genau das gefunden.)
    const paare = await AsyncStorage.multiGet(meine);
    const mitZeit = paare.map(([k, roh]) => {
      let t = 0;
      try {
        t = (JSON.parse(roh ?? '{}') as Partial<Eintrag<unknown>>).t ?? 0;
      } catch {
        t = 0; // unlesbar → aeltester, fliegt zuerst
      }
      return { k, t };
    });
    const jetzt = Date.now();
    const zuAlt = mitZeit.filter((e) => jetzt - e.t > MAX_ALTER_MS).map((e) => e.k);
    const rest = mitZeit
      .filter((e) => !zuAlt.includes(e.k))
      .sort((a, b) => b.t - a.t)
      .slice(anzahl)
      .map((e) => e.k);
    const weg = [...zuAlt, ...rest];
    if (weg.length > 0) await AsyncStorage.multiRemove(weg);
  } catch {
    /* ignorieren — Aufraeumen darf nie einen Abruf stoeren */
  }
}

/** Alles Zwischengespeicherte verwerfen (Einstellungen → Speicher leeren). */
export async function leeren(): Promise<number> {
  try {
    const alle = await AsyncStorage.getAllKeys();
    const meine = alle.filter((k) => k.startsWith(PREFIX));
    if (meine.length > 0) await AsyncStorage.multiRemove(meine);
    return meine.length;
  } catch {
    return 0;
  }
}

/** Wie viele Eintraege liegen abgelegt — fuer die Anzeige in den Einstellungen. */
export async function anzahlEintraege(): Promise<number> {
  try {
    return (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX)).length;
  } catch {
    return 0;
  }
}
