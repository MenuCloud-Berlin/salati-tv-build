import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';

import type { Theme } from '@/lib/theme';

/**
 * Analoges Ziffernblatt fuer den Screensaver.
 *
 * WARUM (Nutzerwunsch 2026-08-30, „dass man die Gebetsuhr nach Wuenschen
 * anpassen kann"): Die Uhr konnte bisher nur eines — grosse Ziffern. Ein
 * Fernseher, der den ganzen Tag im Wohnzimmer steht, ist fuer viele eher ein
 * Wanduhr-Ersatz als eine Digitalanzeige.
 *
 * ES WIRD NICHT ANIMIERT, ES WIRD GERECHNET. Die Zeiger stehen dort, wo die
 * uebergebene Zeit sie hinstellt; der Sekundentakt der Uhr (ein `setInterval`
 * in ClockScreen) zeichnet sie neu. Eine eigene Animation waere eine zweite
 * Zeitquelle — und die liefe garantiert irgendwann anders als die erste.
 *
 * DIE ZEIT KOMMT AM ORT AN, nicht am Fernseher: die Winkel werden aus
 * `zeitTeileInZone` gebildet (s. lib/timezone.ts). Ein Fernseher in Berlin,
 * der auf Mekka eingestellt ist, zeigt sonst analog etwas anderes als digital.
 *
 * DER AKZENT-BOGEN am Rand ist der Countdown: er laeuft von der aktuellen Zeit
 * bis zum naechsten Gebet. Damit sieht man die verbleibende Zeit, ohne sie zu
 * lesen — und er bleibt weg, wenn das naechste Gebet weiter als zwoelf Stunden
 * entfernt ist (dann waere der Bogen ein voller Kreis und saegte nichts).
 */
export function Ziffernblatt({
  groesse,
  stunde,
  minute,
  sekunde,
  sekundenZeiger,
  bisNaechstemGebetMs,
  strichstaerke,
  theme,
}: {
  groesse: number;
  stunde: number;
  minute: number;
  sekunde: number;
  sekundenZeiger: boolean;
  /** Millisekunden bis zum naechsten Gebet — fuer den Bogen am Rand. */
  bisNaechstemGebetMs: number;
  /** Faktor auf alle Strichstaerken (Einstellung „Strichstaerke"). */
  strichstaerke: number;
  theme: Theme;
}) {
  const m = groesse / 2;
  const rand = groesse * 0.46;
  const stark = (v: number) => Math.max(1, v * strichstaerke);

  const striche = useMemo(() => {
    const teile: string[] = [];
    for (let i = 0; i < 60; i++) {
      const w = (i * Math.PI) / 30 - Math.PI / 2;
      const voll = i % 5 === 0;
      const aussen = rand;
      const innen = rand - groesse * (voll ? 0.045 : 0.02);
      teile.push(
        `M${(m + innen * Math.cos(w)).toFixed(1)},${(m + innen * Math.sin(w)).toFixed(1)} ` +
          `L${(m + aussen * Math.cos(w)).toFixed(1)},${(m + aussen * Math.sin(w)).toFixed(1)}`,
      );
    }
    return teile.join(' ');
  }, [m, rand, groesse]);

  const { stunde: stdWinkel, minute: minWinkel, sekunde: sekWinkel } = zeigerWinkel(
    stunde,
    minute,
    sekunde,
  );
  const bogen = useMemo(
    () => bogenPfad(bisNaechstemGebetMs, stdWinkel, m, rand + groesse * 0.028),
    [bisNaechstemGebetMs, stdWinkel, rand, groesse, m],
  );

  return (
    <View pointerEvents="none">
      <Svg width={groesse} height={groesse} viewBox={`0 0 ${groesse} ${groesse}`}>
        {/* Die Flaeche unter dem Blatt. Sie traegt die ABDECKFARBE des Themas
            (`scrim`) und nicht dessen ruhige Flaeche: auf einem Foto-Hintergrund
            standen die duennen Zeiger sonst mitten in der Menschenmenge und
            waren kaum zu finden (Emulator-Befund 2026-08-30, Tawaf-Video). Auf
            einem einfarbigen Grund faellt die Scheibe dagegen kaum auf — sie
            hat dort dieselbe Farbe wie der Grund. */}
        <Circle cx={m} cy={m} r={rand + groesse * 0.045} fill={theme.scrim} />
        <Circle cx={m} cy={m} r={rand + groesse * 0.045} fill={theme.surface} />
        <Circle
          cx={m}
          cy={m}
          r={rand + groesse * 0.028}
          fill="none"
          stroke={theme.accent}
          strokeOpacity={0.18}
          strokeWidth={stark(groesse * 0.006)}
        />
        {bogen ? (
          <Path
            d={bogen}
            fill="none"
            stroke={theme.accent}
            strokeOpacity={0.85}
            strokeWidth={stark(groesse * 0.012)}
            strokeLinecap="round"
          />
        ) : null}
        <Path
          d={striche}
          stroke={theme.textMuted}
          strokeWidth={stark(groesse * 0.005)}
          strokeLinecap="round"
        />

        <G rotation={stdWinkel} origin={`${m}, ${m}`}>
          <Line
            x1={m}
            y1={m + groesse * 0.05}
            x2={m}
            y2={m - rand * 0.55}
            stroke={theme.text}
            strokeWidth={stark(groesse * 0.021)}
            strokeLinecap="round"
          />
        </G>
        <G rotation={minWinkel} origin={`${m}, ${m}`}>
          <Line
            x1={m}
            y1={m + groesse * 0.07}
            x2={m}
            y2={m - rand * 0.82}
            stroke={theme.text}
            strokeWidth={stark(groesse * 0.014)}
            strokeLinecap="round"
          />
        </G>
        {sekundenZeiger ? (
          <G rotation={sekWinkel} origin={`${m}, ${m}`}>
            <Line
              x1={m}
              y1={m + groesse * 0.1}
              x2={m}
              y2={m - rand * 0.9}
              stroke={theme.accent}
              strokeWidth={stark(groesse * 0.006)}
              strokeLinecap="round"
            />
          </G>
        ) : null}
        <Circle cx={m} cy={m} r={groesse * 0.018} fill={theme.accent} />
      </Svg>
    </View>
  );
}

/**
 * Die drei Zeigerwinkel in Grad (0 = zwoelf Uhr, im Uhrzeigersinn).
 *
 * Eigene Funktion und exportiert, weil das die eigentliche Aussage des
 * Ziffernblatts ist: ein analoges Blatt sieht auch dann plausibel aus, wenn die
 * Zeiger falsch stehen. So laesst sich das ohne Bildschirm nachrechnen.
 *
 * Der Stundenzeiger nimmt die Minuten mit — sonst spraenge er im Stundentakt
 * und staende 59 Minuten lang falsch. Der Minutenzeiger nimmt die Sekunden mit.
 */
export function zeigerWinkel(
  stunde: number,
  minute: number,
  sekunde: number,
): { stunde: number; minute: number; sekunde: number } {
  return {
    stunde: (((stunde % 12) + minute / 60) / 12) * 360,
    minute: ((minute + sekunde / 60) / 60) * 360,
    sekunde: (sekunde / 60) * 360,
  };
}

/** Zwoelf Stunden — die Skala des Blattes und damit die Grenze des Bogens. */
const ZWOELF_STUNDEN_MS = 12 * 60 * 60 * 1000;

/**
 * Der Countdown-Bogen am Rand — `null`, wenn er nichts aussagt.
 *
 * Er beginnt an der Stellung des Stundenzeigers und laeuft im Uhrzeigersinn so
 * weit, wie bis zum naechsten Gebet noch Zeit bleibt. Ab zwoelf Stunden waere
 * er ein voller Kreis: dann bleibt er weg, statt eine Aussage ueber nichts zu
 * zeichnen.
 */
export function bogenPfad(
  bisMs: number,
  startWinkel: number,
  mitte: number,
  radius: number,
): string | null {
  if (bisMs <= 0 || bisMs >= ZWOELF_STUNDEN_MS) return null;
  const laenge = (bisMs / ZWOELF_STUNDEN_MS) * 360;
  const punkt = (grad: number) => {
    const w = ((grad - 90) * Math.PI) / 180;
    return `${(mitte + radius * Math.cos(w)).toFixed(1)},${(mitte + radius * Math.sin(w)).toFixed(1)}`;
  };
  const gross = laenge > 180 ? 1 : 0;
  return `M${punkt(startWinkel)} A${radius},${radius} 0 ${gross},1 ${punkt(startWinkel + laenge)}`;
}

