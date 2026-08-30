import { useEffect, useId, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { AmbientGlow } from '@/components/AmbientGlow';
import { MedienGrund } from '@/components/MedienGrund';
// Die Kennungen selbst stehen in lib/hintergruende.ts — ohne einen einzigen
// Import, damit die Einstellungen sie lesen koennen, ohne expo-video und das
// Dateisystem mitzuziehen (der Grund steht dort).
import { medienIdLesen } from '@/lib/hintergruende';
import { fetchHintergrundMedien, useHintergrundMedien } from '@/lib/hintergrundMedien';
import type { Screen } from '@/lib/nav';
import { useTvSettings } from '@/lib/settings';
import { useReduzierteBewegung } from '@/lib/useReduzierteBewegung';
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
// GEZEICHNET UND FOTOGRAFIERT — zwei Sorten, ein Schalter (Stand 2026-08-30):
//
//   - Alles in DIESER Datei ist gezeichnet: in jeder Aufloesung scharf, kein
//     Byte Ladezeit, da am ersten Tag ohne Netz. Bis 1.11.0 war das alles, was
//     es gab — und der Nutzer sagte zu Recht, dass Ornament kein Motiv ist.
//   - Fotos und Videos (Kaaba, Prophetenmoschee, Himmel) liegen NICHT im
//     Paket, sondern im Katalog in R2 und werden bei Bedarf einmal auf das
//     Geraet geladen (s. lib/hintergrundMedien.ts + components/MedienGrund.tsx).
//     Der Grund steht dort; die Kurzfassung: mehrere Megabyte fuer etwas, das
//     nicht jeder einschaltet, gehoeren nicht in ein APK.
//
// Ebenfalls bewusst: keine harten Kanten. Eine Flaeche mit Radius ist eine
// Flaeche mit Kante — genau daran ist die erste Fassung des Lichtscheins
// gescheitert (s. components/AmbientGlow.tsx).

/**
 * Bildschirme, auf denen ein FOTO oder VIDEO liegen darf — genau einer.
 *
 * Geraetebefund 2026-08-30, in dieser Reihenfolge gemessen:
 *   • Hinter den EINSTELLUNGEN war die Seite mit dem Tawaf-Video kaum noch zu
 *     lesen: hunderte helle Punkte hinter kleinem Text.
 *   • Auf dem HUB sah es eindrucksvoll aus, aber die Unterzeilen der Kacheln
 *     („Gebetszeiten & Countdown") verschwanden im Gewimmel.
 *
 * Die gezeichneten Hintergruende halten sich von selbst zurueck, ein Motiv
 * nicht. Es gehoert deshalb genau dorthin, wo grosse Zahlen und wenig Text
 * stehen und wo der Fernseher stundenlang steht: auf die Uhr. Ueberall sonst
 * bleibt der ruhige Grund — die Einstellung bleibt bestehen, sie wirkt nur
 * nicht ueberall.
 */
const MOTIV_BILDSCHIRME: readonly Screen[] = ['clock'];

export function Hintergrund({ screen }: { screen?: Screen } = {}) {
  const { hintergrund, hintergrundDimmung, fotoBewegung } = useTvSettings();
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const id = `hg-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const kurz = Math.min(width, height);

  // Foto/Video: der Katalog wird nur geholt, wenn wirklich eines gewaehlt ist
  // — wer bei „Ruhig" bleibt, soll dafuer keine Anfrage ausloesen.
  const gewaehltesMedium =
    screen === undefined || MOTIV_BILDSCHIRME.includes(screen) ? medienIdLesen(hintergrund) : null;
  const { katalog } = useHintergrundMedien();
  useEffect(() => {
    if (gewaehltesMedium && !katalog) void fetchHintergrundMedien().catch(() => {});
  }, [gewaehltesMedium, katalog]);

  const styles = useMemo(
    () => StyleSheet.create({ fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } }),
    [],
  );

  // Ist ein Motiv gewaehlt, gibt es NUR das Motiv oder gar nichts — nie einen
  // gezeichneten Ersatz. Ohne diese Zeile fiel die Auswahl unten auf das
  // Muster durch, und auf allen Bildschirmen ausser der Uhr stand ploetzlich
  // ein Ornament, das niemand eingestellt hatte (Emulator-Befund 2026-08-30).
  if (medienIdLesen(hintergrund) !== null) {
    const medium = gewaehltesMedium ? katalog?.find((m) => m.id === gewaehltesMedium) : null;
    // Solange der Katalog fehlt (erster Start ohne Netz), bleibt der Grund
    // ruhig — besser als ein halbes Bild oder ein Fehlerkasten hinter der Uhr.
    if (!medium) return null;
    return <MedienGrund medium={medium} dimmung={hintergrundDimmung} bewegtesFoto={fotoBewegung} />;
  }

  if (hintergrund === 'ruhig') return null;

  if (hintergrund === 'sterne') return <Sternenhimmel />;

  if (hintergrund === 'kuppel') return <Kuppelnacht />;

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
  // Systemeinstellung "Bewegung reduzieren" achten: dann steht die Rosette
  // still, statt sich zu drehen. Sie bleibt sichtbar - der Hintergrund ist
  // die Zierde, nicht die Bewegung. (Seit 2026-08-30 als gemeinsamer Haken,
  // s. useReduzierteBewegung unten - drei Hintergruende brauchen ihn.)
  const ruhig = useReduzierteBewegung();

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

// --------------------------------------------------------------------------
// "sterne": Sternenhimmel mit Mondsichel
//
// Der ruhigste der gezeichneten Hintergruende. Die Punkte tragen die Textfarbe
// des Themas und nicht Weiss — sonst waere er auf „Papier" ein Fehlerbild.
//
// Die Sterne stehen FEST. Bewegt wird nur ihre Helligkeit, und zwar in zwei
// Gruppen gegenlaeufig: ein ganzes Feld, das gemeinsam heller und dunkler
// wird, sieht nach Bildschirmfehler aus, zwei versetzte Gruppen sehen nach
// Nachthimmel aus. Beides laeuft ueber `opacity` mit `useNativeDriver`.
const FUNKELN_MS = 5200;

/** Feste Pseudo-Zufallszahlen: dieselbe Verteilung bei jedem Start. Ein echtes
 *  `Math.random()` waere im Render unrein und liesse die Sterne bei jedem
 *  Neuzeichnen springen. */
function streu(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function Sternenhimmel() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const [takt] = useState(() => new Animated.Value(0));
  const ruhig = useReduzierteBewegung();

  useEffect(() => {
    if (ruhig) return;
    const schleife = Animated.loop(
      Animated.sequence([
        Animated.timing(takt, { toValue: 1, duration: FUNKELN_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(takt, { toValue: 0, duration: FUNKELN_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    schleife.start();
    return () => schleife.stop();
  }, [takt, ruhig]);

  const { a, b, sichel } = useMemo(() => sternenfeld(width, height), [width, height]);

  const hellA = takt.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] });
  const hellB = takt.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0.35] });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <AmbientGlow
        color={theme.glowRing}
        size={Math.min(width, height) * 1.3}
        bottom={-height * 0.45}
        left={-width * 0.1}
        intensity={0.08}
      />
      <Animated.View style={[StyleSheet.absoluteFill, ruhig ? { opacity: 0.6 } : { opacity: hellA }]}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <Path d={a} fill={theme.text} fillOpacity={0.5} />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, ruhig ? { opacity: 0.6 } : { opacity: hellB }]}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <Path d={b} fill={theme.text} fillOpacity={0.5} />
        </Svg>
      </Animated.View>
      <View style={StyleSheet.absoluteFill}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <Path d={sichel} fill={theme.accent} fillOpacity={0.3} />
        </Svg>
      </View>
    </View>
  );
}

/**
 * Zwei Sternengruppen und die Mondsichel als Pfade.
 *
 * Exportiert, damit sich die Verteilung ohne Bildschirm pruefen laesst: die
 * Sterne muessen im Bild liegen (ein Stern bei y > Hoehe ist gezeichnete
 * Rechenzeit fuer nichts) und OBEN dichter stehen — unten steht auf jedem
 * Bildschirm Text.
 */
export function sternenfeld(w: number, h: number): { a: string; b: string; sichel: string; punkte: { x: number; y: number }[] } {
  const anzahl = 90;
  const a: string[] = [];
  const b: string[] = [];
  const punkte: { x: number; y: number }[] = [];
  for (let i = 0; i < anzahl; i++) {
    const x = streu(i * 3 + 1) * w;
    // Hoch 1,6 zieht die Verteilung nach oben: unten steht der Inhalt.
    const y = Math.pow(streu(i * 3 + 2), 1.6) * h;
    const r = 0.8 + streu(i * 3 + 3) * 1.9;
    punkte.push({ x, y });
    const kreis =
      `M${(x - r).toFixed(1)},${y.toFixed(1)} a${r},${r} 0 1,0 ${(2 * r).toFixed(1)},0 ` +
      `a${r},${r} 0 1,0 ${(-2 * r).toFixed(1)},0`;
    (i % 2 === 0 ? a : b).push(kreis);
  }
  // Mondsichel aus zwei Boegen: der zweite ist minimal groesser und laeuft
  // zurueck, die Flaeche dazwischen bleibt stehen. Bewusst ohne Maske — eine
  // Maske erzeugt auf Android einen eigenen Stapelkontext.
  const r = Math.min(w, h) * 0.075;
  const mx = w * 0.82;
  const my = h * 0.2;
  const sichel =
    `M${mx},${my - r} A${r},${r} 0 1,0 ${mx},${my + r} ` +
    `A${(r * 1.25).toFixed(1)},${(r * 1.25).toFixed(1)} 0 0,1 ${mx},${my - r} Z`;
  return { a: a.join(' '), b: b.join(' '), sichel, punkte };
}

// --------------------------------------------------------------------------
// "kuppel": Moschee-Silhouette am unteren Rand
//
// Der einzige gezeichnete Hintergrund mit einem MOTIV. Er sitzt bewusst unten
// und laesst die obere Haelfte frei: dort steht auf jedem Bildschirm der
// Inhalt. Die Silhouette ist ein einziger Pfad — Kuppel, zwei Minarette und
// eine Mauer, gerechnet aus der Bildschirmbreite, damit sie auf 4K genauso
// sitzt wie auf 720p.
function Kuppelnacht() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const id = `kn-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const pfad = useMemo(() => bausilhouette(width, height), [width, height]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={theme.glowRing} stopOpacity={0} />
            <Stop offset="70%" stopColor={theme.accent} stopOpacity={0.08} />
            <Stop offset="100%" stopColor={theme.accent} stopOpacity={0.2} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill={`url(#${id})`} />
        <Path d={pfad} fill={theme.accent} fillOpacity={0.22} />
      </Svg>
    </View>
  );
}

/**
 * Kuppel, Minarette und Mauer als EIN Pfad.
 *
 * Alle Masse relativ zu Breite und Hoehe: die Silhouette soll auf jedem Panel
 * dieselbe Form haben. Exportiert, damit sich die Geometrie ohne Bildschirm
 * pruefen laesst — sie muss im unteren Drittel bleiben.
 */
export function bausilhouette(w: number, h: number): string {
  const boden = h;
  const mauer = h * 0.9;
  const mitte = w / 2;
  const kuppelR = w * 0.1;
  const kuppelBasis = mauer - kuppelR * 0.15;
  const trommel = kuppelBasis + kuppelR * 0.35;
  const minarettB = w * 0.016;
  const minarettH = h * 0.26;
  const minarettX = [mitte - w * 0.2, mitte + w * 0.2];

  const teile: string[] = [];
  teile.push(`M0,${boden} L0,${mauer} L${w},${mauer} L${w},${boden} Z`);
  teile.push(
    `M${mitte - kuppelR},${trommel} L${mitte - kuppelR},${kuppelBasis} ` +
      `A${kuppelR},${kuppelR * 1.15} 0 0,1 ${mitte + kuppelR},${kuppelBasis} ` +
      `L${mitte + kuppelR},${trommel} Z`,
  );
  const spitze = kuppelBasis - kuppelR * 1.15;
  teile.push(`M${mitte},${spitze} l${-kuppelR * 0.05},${-h * 0.03} l${kuppelR * 0.1},0 Z`);
  for (const x of minarettX) {
    const kopf = mauer - minarettH;
    teile.push(
      `M${x - minarettB},${mauer} L${x - minarettB},${kopf} L${x + minarettB},${kopf} L${x + minarettB},${mauer} Z`,
    );
    teile.push(
      `M${x - minarettB * 1.6},${kopf} A${minarettB * 1.6},${minarettB * 2.2} 0 0,1 ${x + minarettB * 1.6},${kopf} Z`,
    );
    teile.push(
      `M${x - minarettB * 0.35},${kopf - minarettB * 2.2} l0,${-h * 0.022} l${minarettB * 0.7},0 l0,${h * 0.022} Z`,
    );
  }
  return teile.join(' ');
}
