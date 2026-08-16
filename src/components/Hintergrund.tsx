import { useId, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { AmbientGlow } from '@/components/AmbientGlow';
import { useTvSettings } from '@/lib/settings';
import { useTheme } from '@/lib/useTheme';

// Hintergrund der ganzen App — liegt EINMAL in App.tsx hinter allen
// Bildschirmen, nicht je Bildschirm einzeln.
//
// WARUM (Nutzerbefund 2026-08-16, "es fehlt sowas wie verschiedene
// Hintergruende"): die fuenf Farbwelten aus lib/theme.ts aendern nur Farbwerte
// — jeder Bildschirm blieb eine gleichmaessig gefuellte Flaeche. Auf einem
// Fernseher, der stundenlang im Raum steht, ist das der Unterschied zwischen
// „Geraet an" und „schoen anzusehen".
//
// BEWUSST OHNE FOTOS: ein Bild fuer 4K waere mehrere Megabyte im Paket, und die
// vorhandenen Motive der Handy-App liegen bei 900 px — hochskaliert auf 65 Zoll
// sehen sie weich und wie ein Fehler aus. Alles hier ist gezeichnet und damit in
// jeder Aufloesung scharf, ohne ein Byte Ladezeit.
//
// Ebenfalls bewusst: keine harten Kanten. Eine Flaeche mit Radius ist eine
// Flaeche mit Kante — genau daran ist die erste Fassung des Lichtscheins
// gescheitert (s. components/AmbientGlow.tsx).

export type HintergrundId = 'ruhig' | 'schein' | 'verlauf' | 'muster';

export const HINTERGRUENDE: readonly HintergrundId[] = ['ruhig', 'schein', 'verlauf', 'muster'];

export function istHintergrundId(v: unknown): v is HintergrundId {
  return typeof v === 'string' && (HINTERGRUENDE as readonly string[]).includes(v);
}

/** Locale-Schluessel des Anzeigenamens. */
export function hintergrundNameKey(id: HintergrundId): string {
  return `settings.background.${id}`;
}

export function Hintergrund() {
  const { hintergrund } = useTvSettings();
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const id = `hg-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const kurz = Math.min(width, height);

  const styles = useMemo(
    () => StyleSheet.create({ fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } }),
    [],
  );

  if (hintergrund === 'ruhig') return null;

  if (hintergrund === 'schein') {
    // Zwei Lichter aus gegenueberliegenden Ecken — dieselbe Anordnung wie im
    // Koran-Leser. Auf der Uhr ergaenzt das deren mittig atmenden Schein,
    // statt ihn zu verdoppeln.
    return (
      <View pointerEvents="none" style={styles.fill}>
        <AmbientGlow color={theme.accent} size={kurz * 1.15} top={-height * 0.3} left={-width * 0.12} />
        <AmbientGlow
          color={theme.glowRing}
          size={kurz * 1.25}
          bottom={-height * 0.35}
          right={-width * 0.12}
          intensity={0.1}
        />
      </View>
    );
  }

  if (hintergrund === 'verlauf') {
    // Senkrechter Verlauf von der Grundflaeche zum Akzent, unten am staerksten
    // — das Bild bekommt Boden, der Text oben bleibt auf ruhigem Grund.
    return (
      <View pointerEvents="none" style={styles.fill}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={theme.accent} stopOpacity={0} />
              <Stop offset="55%" stopColor={theme.glowRing} stopOpacity={0.1} />
              <Stop offset="100%" stopColor={theme.accent} stopOpacity={0.24} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
        </Svg>
      </View>
    );
  }

  // muster: achtzackiger Stern (Rub al-Hizb), gekachelt.
  //
  // GERAETEBEFUND 2026-08-16 (Android-TV-Emulator, 1080p): die erste Fassung
  // benutzte `<Pattern patternUnits="userSpaceOnUse">` und war am Bildschirm
  // NICHT zu sehen. Kein Darstellungsproblem, sondern gar keine Zeichnung: eine
  // Pixelmessung ueber 600 Punkte der dunklen Ecke ergab durchgehend denselben
  // Wert (11,11,13). react-native-svg fuellt hier keine Flaeche mit einer
  // Kachel — der Verlauf daneben (LinearGradient, gleiche `id`-Mechanik) kam
  // dagegen an, es liegt also an `Pattern`, nicht an der Referenz.
  //
  // Statt die Bibliothek zu ueberreden, wird das Raster ausgerechnet und als EIN
  // Pfad gezeichnet. Ein Pfad statt hunderter Knoten, weil der Hintergrund
  // stehenbleibt und nichts davon fuer sich ansprechbar sein muss.
  const kachel = Math.round(kurz * 0.14);
  const strich = Math.max(1.5, kachel * 0.028);
  const spalten = Math.ceil(width / kachel) + 1;
  const zeilen = Math.ceil(height / kachel) + 1;
  const teile: string[] = [];
  for (let sp = 0; sp < spalten; sp++) {
    for (let z = 0; z < zeilen; z++) {
      const cx = sp * kachel + kachel / 2;
      const cy = z * kachel + kachel / 2;
      // Zwei um 45° gedrehte Quadrate ergeben den Achtzack. Als Umriss statt
      // gefuellt: gefuellt wuerde das Muster bei dieser Groesse zu einer
      // Flaeche verlaufen.
      teile.push(quadrat(cx, cy, kachel * 0.3, 0), quadrat(cx, cy, kachel * 0.3, Math.PI / 4));
    }
  }
  return (
    <View pointerEvents="none" style={styles.fill}>
      {/* Groesse und Sichtfeld ausdruecklich in dp, nicht in Prozent.
          Geraetebefund 2026-08-16: mit `width="100%"` kam KEIN Strich an — die
          Pfadpunkte stehen in dp, und ohne feste Groesse legt react-native-svg
          keinen dazu passenden Zeichenraum an. Der Verlauf daneben fiel nicht
          auf, weil sein Rechteck ebenfalls in Prozent misst. */}
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path
          d={teile.join(' ')}
          stroke={theme.accent}
          strokeOpacity={0.18}
          strokeWidth={strich}
          fill="none"
        />
      </Svg>
    </View>
  );
}

/** Pfad eines um `drehung` gedrehten Quadrats mit Mittelpunkt (cx, cy). */
function quadrat(cx: number, cy: number, r: number, drehung: number): string {
  const punkte = [0, 1, 2, 3].map((i) => {
    const w = drehung + (Math.PI / 2) * i + Math.PI / 4;
    return `${(cx + r * Math.cos(w)).toFixed(2)},${(cy + r * Math.sin(w)).toFixed(2)}`;
  });
  return `M${punkte[0]} L${punkte[1]} L${punkte[2]} L${punkte[3]} Z`;
}
