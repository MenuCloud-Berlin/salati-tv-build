import { themeById, type Theme } from '@/lib/theme';
import { useTvSettings } from '@/lib/settings';

/**
 * Die aktive Farbwelt.
 *
 * Bewusst eine eigene Datei und nicht in `theme.ts`: dort wuerde der Import des
 * Einstellungs-Stores einen Zyklus schliessen (settings.ts liest bereits
 * `isThemeId` aus theme.ts). Metro loest Zyklen zwar auf, aber die
 * Auswertungsreihenfolge waere dann von der Import-Reihenfolge abhaengig — und
 * ein zu frueh gelesenes `THEMES` ist `undefined`, was jede Farbe im Baum
 * unbrauchbar macht.
 */
export function useTheme(): Theme {
  return themeById(useTvSettings().theme);
}
