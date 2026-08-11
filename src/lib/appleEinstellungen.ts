import { NativeModules } from 'react-native';

/**
 * Die Voreinstellungen des laufenden Prozesses unter Apple (NSUserDefaults).
 *
 * Warum nicht einfach `NativeModules.SettingsManager.settings`: mit der neuen
 * Architektur liegen die Konstanten eines Moduls NICHT mehr als Felder am
 * Modul-Objekt, sondern hinter `getConstants()`. Der direkte Feldzugriff liest
 * dort `undefined` — stumm, ohne Fehler. Genau daran ist am 2026-08-11 die
 * Bildschirmfoto-Automatik gescheitert (Lauf 31493692564: acht Bilder, alle
 * derselbe Startbildschirm), und aus demselben Grund lief der iOS-Zweig der
 * Spracherkennung (`lib/locale.ts`) seit jeher ins Leere.
 *
 * Der alte Weg bleibt als zweiter Versuch stehen — er trägt in der alten
 * Architektur.
 */
export function appleEinstellungen(): Record<string, unknown> | null {
  try {
    const modul = NativeModules?.SettingsManager as
      | { getConstants?: () => { settings?: unknown }; settings?: unknown }
      | undefined;
    const ausKonstanten = modul?.getConstants?.().settings;
    const wert = ausKonstanten ?? modul?.settings;
    return wert && typeof wert === 'object' ? (wert as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
