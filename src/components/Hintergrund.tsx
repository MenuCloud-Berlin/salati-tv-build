import { useEffect, useId, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

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

export type HintergrundId = 'ruhig' | 'schein' | 'verlauf' | 'muster' | 'bewegt';

export const HINTERGRUENDE: readonly HintergrundId[] = ['ruhig', 'schein', 'verlauf', 'muster', 'bewegt'];

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

  if (hintergrund === 'bewegt') return <BewegterGrund />;

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
  // Kachelgroesse und Deckkraft sind am Bildschirm eingestellt, nicht geraten
  // (2026-08-16, 1080p): bei 14 % Kachel und 18 % Deckkraft zeichnete das
  // Muster durch die halbdurchsichtigen Karten hindurch und nahm der Uhr die
  // Aufmerksamkeit. Groessere Kacheln und 12 % geben Textur, ohne mitzureden.
  const kachel = Math.round(kurz * 0.18);
  const strich = Math.max(1.5, kachel * 0.022);
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
          strokeOpacity={0.12}
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


// --------------------------------------------------------------------------
// "bewegt": die Rosette aus den Lernvideos, langsam drehend
//
// Uebernommen aus content/pipeline/video_muster.html - dort war es der Grund,
// auf dem die Folien liegen, und der User wollte genau den auf dem Fernseher
// wiederhaben ("die Hintergruende von den Videos fand ich sehr gut, so
// bewegende Hintergruende, das koenntest du noch fuer die Gebetsuhr bauen").
//
// Bewegt wird NUR ueber `transform` und mit `useNativeDriver` - die Drehung
// laeuft damit im UI-Faden und nicht ueber die JS-Bruecke. Auf einem
// Fernseher-Chip ist das der Unterschied zwischen ruhiger Drehung und
// Ruckeln; ausserdem laeuft sie weiter, waehrend JS anderes tut.
//
// Eine volle Umdrehung dauert dreieinhalb Minuten. Schneller sieht nach
// Bildschirmschoner aus, langsamer sieht man gar nicht.
const DREHUNG_MS = 210_000;

function BewegterGrund() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const kurz = Math.min(width, height);
  // useState statt useRef: der Lint-Regelsatz verbietet Ref-Zugriff waehrend
  // des Renderns - und im Haus ist useState das gaengige Muster fuer einen
  // Animationswert (FocusCard, ClockScreen).
  const [dreh] = useState(() => new Animated.Value(0));
  const [ruhig, setRuhig] = useState(false);

  // Systemeinstellung "Bewegung reduzieren" achten: dann steht die Rosette
  // still, statt sich zu drehen. Sie bleibt sichtbar - der Hintergrund ist
  // die Zierde, nicht die Bewegung.
  useEffect(() => {
    let lebt = true;
    AccessibilityInfo.isReduceMotionEnabled().then((an) => lebt && setRuhig(an));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (an) => setRuhig(an));
    return () => {
      lebt = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (ruhig) return;
    const schleife = Animated.loop(
      Animated.timing(dreh, {
        toValue: 1,
        duration: DREHUNG_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    schleife.start();
    return () => schleife.stop();
  }, [dreh, ruhig]);

  const winkel = dreh.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  // Die Rosette ist groesser als der Bildschirm und sitzt mittig - so laeuft
  // beim Drehen nie eine Ecke ins Bild.
  const gr = Math.round(Math.max(width, height) * 1.35);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <AmbientGlow color={theme.accent} size={kurz * 1.2} top={-height * 0.25} left={-width * 0.1} />
      <Animated.View
        style={{
          position: 'absolute',
          left: (width - gr) / 2,
          top: (height - gr) / 2,
          width: gr,
          height: gr,
          transform: [{ rotate: winkel }],
        }}>
        <Rosette groesse={gr} farbe={theme.accent} />
      </Animated.View>
    </View>
  );
}

/** Zwoelf gleich grosse Kreise auf einem Kreis - das Grundmuster vieler
 *  Ornamente. Ihre Schnittpunkte bilden die Blattform von selbst, es braucht
 *  also keine gezeichneten Blaetter. Dazu feine Strahlen nach aussen: ohne sie
 *  saehe die Rosette gedreht genauso aus wie ungedreht, und die Bewegung waere
 *  unsichtbar (derselbe Befund wie beim Videohintergrund). */
function Rosette({ groesse, farbe }: { groesse: number; farbe: string }) {
  const m = groesse / 2;
  const r = groesse * 0.21;
  const kreise = Array.from({ length: 12 }, (_, i) => {
    const w = (i * Math.PI) / 6;
    return { cx: m + r * Math.cos(w), cy: m + r * Math.sin(w) };
  });
  const strahlen = Array.from({ length: 24 }, (_, i) => {
    const w = (i * Math.PI) / 12;
    const r1 = 2 * r + groesse * 0.018;
    const r2 = r1 + groesse * (i % 2 ? 0.04 : 0.026);
    return `M${(m + r1 * Math.cos(w)).toFixed(1)},${(m + r1 * Math.sin(w)).toFixed(1)} `
      + `L${(m + r2 * Math.cos(w)).toFixed(1)},${(m + r2 * Math.sin(w)).toFixed(1)}`;
  }).join(' ');
  const strich = Math.max(1, groesse * 0.0012);

  return (
    <Svg width={groesse} height={groesse} viewBox={`0 0 ${groesse} ${groesse}`}>
      {kreise.map((k, i) => (
        <Circle
          key={i}
          cx={k.cx}
          cy={k.cy}
          r={r}
          fill="none"
          stroke={farbe}
          strokeOpacity={0.13}
          strokeWidth={strich}
        />
      ))}
      <Circle cx={m} cy={m} r={r} fill="none" stroke={farbe} strokeOpacity={0.11} strokeWidth={strich} />
      <Circle cx={m} cy={m} r={2 * r} fill="none" stroke={farbe} strokeOpacity={0.1} strokeWidth={strich} />
      <Path d={strahlen} stroke={farbe} strokeOpacity={0.1} strokeWidth={strich} fill="none" />
    </Svg>
  );
}
