import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * Weicher Lichtschein im Hintergrund (Koran-Leser, Wiedergabe).
 *
 * WARUM ES DIESE KOMPONENTE GIBT: der Schein war eine `View` mit
 * `borderRadius` und halbtransparenter Farbe. Eine Flaeche mit Radius ist aber
 * eine Flaeche mit KANTE — am 2026-08-08 standen am Fernseher zwei klar
 * umrissene Scheiben im Bild, eine olivfarbene und eine gruene. Das sah nach
 * einem Darstellungsfehler aus, nicht nach Licht, und war auf dem grossen
 * Bildschirm deutlich staerker zu sehen als in jeder Vorschau.
 *
 * Ein echter Verlauf laeuft zum Rand hin auf Null aus und hat deshalb keine
 * Kante. react-native-svg liegt ohnehin im Bundle (QR-Code der Kopplung), es
 * kommt keine Abhaengigkeit dazu.
 *
 * `useId()` fuer die Verlaufs-Kennung: SVG-Definitionen teilen sich einen
 * globalen Namensraum. Zwei Scheine mit derselben festen `id` auf einem
 * Bildschirm — genau der Fall hier — wuerden beide denselben Verlauf ziehen,
 * und die zweite Farbe waere wirkungslos.
 */
export function AmbientGlow({
  color,
  size,
  top,
  bottom,
  left,
  right,
  /** Deckkraft in der Mitte. Aussen ist sie immer 0. */
  intensity = 0.16,
}: {
  color: string;
  size: number;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  intensity?: number;
}) {
  const id = `glow-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View pointerEvents="none" style={[styles.wrap, { width: size, height: size, top, bottom, left, right }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={intensity} />
            <Stop offset="55%" stopColor={color} stopOpacity={intensity * 0.38} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
});
