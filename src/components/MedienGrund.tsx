import { useEffect, useId, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { abspielAdresse, type HintergrundMedium } from '@/lib/hintergrundMedien';
import { useReduzierteBewegung } from '@/lib/useReduzierteBewegung';

/**
 * Ein Foto oder ein Video als Hintergrund der ganzen App.
 *
 * DREI DINGE, DIE HIER NICHT VERHANDELBAR SIND:
 *
 * 1. STUMM. Der Hintergrund laeuft, waehrend im Vordergrund eine Rezitation
 *    oder das Koran-Radio spielt — genau dafuer ist er da. Ein Video mit
 *    Tonspur wuerde beides uebereinanderlegen. Die Dateien haben deshalb schon
 *    keine Tonspur, und der Spieler ist zusaetzlich stumm geschaltet und auf
 *    `mixWithOthers` gestellt: ohne das nimmt der ExoPlayer auf Android den
 *    Audio-Fokus und der Gebetsruf verstummt.
 *
 * 2. IMMER EIN STANDBILD DARUNTER. Das Video braucht einen Moment, bis das
 *    erste Bild steht; ohne den Grund darunter blitzt der Bildschirm schwarz
 *    auf. Das Standbild ist ausserdem der ganze Hintergrund, solange die Datei
 *    noch nicht auf dem Geraet liegt.
 *
 * 3. ABGEDUNKELT. Ein Foto in voller Helligkeit macht jede Uhrzeit darauf
 *    unlesbar. Die Staerke waehlt der Nutzer (Einstellungen → Darstellung); die
 *    Voreinstellung ist bewusst kraeftig.
 */
export function MedienGrund({
  medium,
  dimmung,
  bewegtesFoto,
}: {
  medium: HintergrundMedium;
  /** 0…1 — wie stark der Grund abgedunkelt wird. */
  dimmung: number;
  /** Fotos langsam wandern lassen (Einstellung; „Bewegung reduzieren" sticht). */
  bewegtesFoto: boolean;
}) {
  const datei = abspielAdresse(medium);
  const istVideo = medium.art === 'video' && datei !== null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {medium.art === 'foto' && datei ? (
        <FotoGrund uri={datei} bewegt={bewegtesFoto} />
      ) : (
        // Das Standbild aus dem Netz: klein, und `expo-image` haelt es im
        // eigenen Speicher — es ist damit auch ohne Netz wieder da.
        <FotoGrund uri={medium.posterUrl} bewegt={bewegtesFoto && medium.art === 'foto'} />
      )}
      {istVideo ? <VideoGrund uri={datei} /> : null}
      <View style={[styles.schleier, { opacity: dimmung }]} />
      <Saum />
    </View>
  );
}

/**
 * Dunkler Saum oben und unten.
 *
 * WARUM ZUSAETZLICH zur Abdunkelung (Emulator-Befund 2026-08-30 mit dem
 * Tawaf-Video): eine gleichmaessige Abdunkelung nimmt dem ganzen Bild
 * Helligkeit, aber nicht die UNRUHE — und genau dort, wo Kopfzeile und
 * Fusszeile stehen, lag im Video eine helle Menschenmenge. Die Uhr blieb
 * lesbar, die kleinen Zeilen kaum.
 *
 * Der Saum ist deshalb NICHT die Nutzerwahl, sondern fest: er macht Text
 * lesbar und laesst die Bildmitte — wo das Motiv steht — unangetastet.
 */
function Saum() {
  const id = `sm-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  // Groesse in dp, NICHT in Prozent: react-native-svg legt ohne feste Groesse
  // keinen passenden Zeichenraum an — derselbe Befund wie beim Muster-
  // Hintergrund (s. components/Hintergrund.tsx, Geraetebefund 2026-08-16).
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#000" stopOpacity={0.55} />
            <Stop offset="28%" stopColor="#000" stopOpacity={0} />
            <Stop offset="68%" stopColor="#000" stopOpacity={0} />
            <Stop offset="100%" stopColor="#000" stopOpacity={0.6} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * Das Foto — wahlweise mit einer sehr langsamen Wanderung („Ken Burns").
 *
 * Warum ueberhaupt: ein Standbild, das stundenlang steht, wirkt wie ein
 * eingefrorener Bildschirm; auf OLED-Panels ist es zudem genau das Muster, das
 * sich einbrennt. 90 Sekunden je Richtung sind langsam genug, dass man die
 * Bewegung nicht als solche wahrnimmt.
 *
 * Bewegt wird NUR ueber `transform` mit `useNativeDriver` — auf einem
 * Fernseher-Chip ist das der Unterschied zwischen ruhig und ruckelnd (gleiche
 * Ueberlegung wie beim gedrehten Ornament in components/Hintergrund.tsx).
 */
const WANDER_MS = 90_000;

function FotoGrund({ uri, bewegt }: { uri: string; bewegt: boolean }) {
  const { width, height } = useWindowDimensions();
  const [takt] = useState(() => new Animated.Value(0));
  const ruhig = useReduzierteBewegung();

  const laeuft = bewegt && !ruhig;
  useEffect(() => {
    if (!laeuft) {
      takt.setValue(0);
      return;
    }
    const schleife = Animated.loop(
      Animated.sequence([
        Animated.timing(takt, { toValue: 1, duration: WANDER_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(takt, { toValue: 0, duration: WANDER_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    schleife.start();
    return () => schleife.stop();
  }, [laeuft, takt]);

  // Das Bild ist groesser als der Bildschirm; nur so kann es wandern, ohne
  // dass eine Kante hereinlaeuft.
  const stil = useMemo(() => {
    const ueber = laeuft ? 1.12 : 1;
    return {
      position: 'absolute' as const,
      left: (width - width * ueber) / 2,
      top: (height - height * ueber) / 2,
      width: width * ueber,
      height: height * ueber,
    };
  }, [width, height, laeuft]);

  const wandernX = takt.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.03, width * 0.03] });
  const wandernY = takt.interpolate({ inputRange: [0, 1], outputRange: [height * 0.02, -height * 0.02] });

  return (
    <Animated.View style={[stil, laeuft && { transform: [{ translateX: wandernX }, { translateY: wandernY }] }]}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={600} />
    </Animated.View>
  );
}

function VideoGrund({ uri }: { uri: string }) {
  const spieler = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.volume = 0;
    // Ohne das nimmt der ExoPlayer den Audio-Fokus und schaltet die laufende
    // Rezitation stumm — ein Hintergrund, der den Ton wegnimmt, waere das
    // Gegenteil dessen, wofuer er da ist.
    p.audioMixingMode = 'mixWithOthers';
    p.play();
  });

  return (
    <VideoView
      player={spieler}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      // Keine Bedienelemente: der Hintergrund ist kein Abspieler, und ein
      // Bedienbalken darueber wuerde den Fokus an sich ziehen.
      nativeControls={false}
    />
  );
}

const styles = StyleSheet.create({
  schleier: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' },
});
