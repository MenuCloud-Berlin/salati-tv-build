import { useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useFernFokusKarte } from '@/lib/useFernFokusKarte';
import { useTheme } from '@/lib/useTheme';

// Fokussierbare Karte für die 10-Fuß-/D-Pad-Bedienung. react-native-tvos steuert
// den Fokus per Fernbedienung automatisch zwischen allen `Pressable`; wir heben
// die fokussierte Karte optisch hervor. Bewusst OHNE Android-`elevation`/Schatten:
// der zusammen mit dem transluzenten Karten-Hintergrund einen sichtbaren
// „inneren Kasten" in fokussierten Karten zeichnete (Gerätetest 2026-07-24).
// Stattdessen klarer Akzent-Rahmen + weiche Skalierung (animiert) — ruhig, premium.
//
// WICHTIG: Das übergebene `style` (Breite/Höhe/Flex, z. B. width:'48%') muss am
// PRESSABLE selbst hängen, sonst kollabiert das Layout (Grid-Karten wurden sonst
// zu schmalen Spalten). Deshalb ein Animated-Pressable statt eines inneren
// Animated.View-Wrappers.
//
// Seit 2026-08-30 meldet sich jede Karte zusaetzlich beim Fokus-Verzeichnis an
// (lib/fernfokus.ts). Nur dadurch koennen Steuerkreuz und OK des gekoppelten
// HANDYS ueberhaupt etwas bewegen: die App weiss sonst nicht, welche Karten es
// gibt und wo sie liegen. Fuer die echte Fernbedienung aendert sich nichts —
// die Plattform steuert den Fokus weiterhin selbst, das Verzeichnis hoert nur zu.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function FocusCard({
  children,
  onPress,
  hasTVPreferredFocus,
  style,
  onFocus,
  onBlur,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  hasTVPreferredFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Wird zusaetzlich zum internen Fokus-Effekt gerufen — die Aufrufer nutzen
   *  es, um sich den zuletzt fokussierten Eintrag zu merken (Home-Hub) oder um
   *  die Hinweiszeile auf den fokussierten Knopf zu beziehen (Wiedergabe). */
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const theme = useTheme();
  // Einmal erzeugt ueber den useState-Initialisierer: `useRef(...).current`
  // liest einen Ref waehrend des Renderns (react-hooks/refs).
  const [scale] = useState(() => new Animated.Value(1));
  const { setzeRef, beiLayout, beiFokus, beiFokusVerlust } = useFernFokusKarte(onPress);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderRadius: 18,
          borderWidth: 2,
          borderColor: 'transparent',
          backgroundColor: theme.card,
        },
        focused: {
          borderColor: theme.accent,
          backgroundColor: theme.cardFocus,
        },
      }),
    [theme],
  );

  const animate = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 20, bounciness: 6 }).start();

  return (
    <AnimatedPressable
      ref={setzeRef}
      onPress={onPress}
      onLayout={beiLayout}
      onFocus={() => {
        setFocused(true);
        animate(1.05);
        beiFokus();
        onFocus?.();
      }}
      onBlur={() => {
        setFocused(false);
        animate(1);
        beiFokusVerlust();
        onBlur?.();
      }}
      hasTVPreferredFocus={hasTVPreferredFocus}
      // Reihenfolge (Audit 2026-07-29): der Fokus-Stil steht VOR dem
      // uebergebenen `style`. Vorher stand er dahinter und uebermalte jede
      // Zustandsfarbe des Aufrufers — im Quiz blieb die selbst gewaehlte FALSCHE
      // Antwort golden statt rot, weil die Karte im Moment der Antwort immer
      // fokussiert ist (Bildschirmbefund). Der Fokus bleibt trotzdem sichtbar:
      // die Skalierung liegt separat am Ende, und Aufrufer setzen nur dort
      // eigene Rahmenfarben, wo sie eine Aussage haben (aktiv/richtig/falsch).
      style={[styles.card, focused && styles.focused, style, { transform: [{ scale }] }]}>
      {children}
    </AnimatedPressable>
  );
}
