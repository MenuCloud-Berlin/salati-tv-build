import { useId, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Pattern, Rect, Stop } from 'react-native-svg';

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

  // muster: achtzackiger Stern (Rub al-Hizb), gekachelt und sehr weit
  // heruntergedimmt. Die Kachelgroesse haengt an der kurzen Bildschirmseite,
  // damit das Muster auf jedem Panel gleich fein wirkt.
  const kachel = Math.round(kurz * 0.12);
  // Geraetebefund 2026-08-16 (Android-TV-Emulator, 1080p): mit 7 % Deckkraft und
  // 1,5 dp Strich war das Muster auf Schwarz NICHT zu sehen — Gold auf #0a0a0a
  // ergibt dort einen Grauwert von 24 gegen 10. Eine Einstellung, die man
  // waehlen kann und dann nichts bewirkt, ist schlimmer als keine. Der Strich
  // waechst jetzt mit der Kachel, sonst wird das Muster auf 4K wieder duenn.
  const strich = Math.max(1.5, kachel * 0.03);
  return (
    <View pointerEvents="none" style={styles.fill}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} width={kachel} height={kachel} patternUnits="userSpaceOnUse">
            <G opacity={0.18}>
              {/* Zwei um 45° gedrehte Quadrate ergeben den Achtzack. Als
                  Umriss statt gefuellt: gefuellt wuerde das Muster bei dieser
                  Groesse zu einer Flaeche verlaufen. */}
              <Path
                d={quadrat(kachel / 2, kachel / 2, kachel * 0.3, 0)}
                stroke={theme.accent}
                strokeWidth={strich}
                fill="none"
              />
              <Path
                d={quadrat(kachel / 2, kachel / 2, kachel * 0.3, Math.PI / 4)}
                stroke={theme.accent}
                strokeWidth={strich}
                fill="none"
              />
            </G>
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
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
