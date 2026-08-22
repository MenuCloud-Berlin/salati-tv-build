// Temperatur-Anzeige fuer den Screensaver (ClockScreen). Open-Meteo:
// kostenlos, kein API-Schluessel, keine Kontingent-Sorgen (passt zur
// Kostenlos-Linie des Projekts, s. Plan). Standort kommt aus den ohnehin
// vorhandenen TvSettings (lat/lon fuer die Gebetszeitenberechnung) — kein
// eigener Standort-Eingabeschritt fuer den User.
import { fetchWithTimeout } from '@/lib/content';

export interface WetterInhalt {
  temperaturC: number;
  code: number;
}

interface OpenMeteoResponse {
  current?: { temperature_2m?: number; weather_code?: number };
}

export async function ladeWetter(lat: number, lon: number): Promise<WetterInhalt> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
  const r = await fetchWithTimeout(url);
  if (!r.ok) throw new Error(`wetter_${r.status}`);
  const j = (await r.json()) as OpenMeteoResponse;
  if (typeof j.current?.temperature_2m !== 'number') throw new Error('wetter_leer');
  return { temperaturC: Math.round(j.current.temperature_2m), code: j.current.weather_code ?? 0 };
}

/** Grober Text zum Open-Meteo-WMO-Wettercode (nur die Kategorien, die am
 *  Screensaver Sinn ergeben — Details wie Gewitterstaerke sind hier zu klein
 *  fuer den Nutzen). */
export function wetterText(code: number): string {
  if (code === 0) return 'klar';
  if (code <= 3) return 'bewölkt';
  if (code <= 48) return 'neblig';
  if (code <= 67) return 'regnerisch';
  if (code <= 77) return 'schneit';
  if (code <= 82) return 'schauerartig';
  return 'gewittrig';
}
