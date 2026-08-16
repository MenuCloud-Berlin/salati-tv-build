import { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { FocusCard } from '@/components/FocusCard';
import { Icon } from '@/components/Icon';
import { useTranslation } from '@/lib/i18n';
import { umschalten, useHintergrundAudio } from '@/lib/hintergrundAudio';
import type { Theme } from '@/lib/theme';
import { useTheme } from '@/lib/useTheme';

/**
 * Schmaler Streifen am unteren Rand: was gerade im Hintergrund laeuft.
 *
 * Seit die Wiedergabe den Bildschirmwechsel ueberlebt (lib/hintergrundAudio.ts)
 * kann Koran laufen, waehrend vorne die Gebetsuhr steht. Ohne einen sichtbaren
 * Hinweis waere das aber ein Ton aus dem Nichts: der Nutzer saehe die Uhr, hoerte
 * eine Rezitation und haette keinen Weg, sie anzuhalten, ohne den Bereich zu
 * suchen, aus dem sie kam.
 *
 * Bewusst KEIN Fokusanker (`hasTVPreferredFocus`): auf der Uhr soll der Fokus
 * dort bleiben, wo der Bildschirm ihn hinlegt. Wer den Streifen bedienen will,
 * steuert mit dem Steuerkreuz nach unten — er ist die letzte fokussierbare
 * Stelle des Bildschirms und damit ohne Suchen erreichbar.
 *
 * Laeuft nichts, rendert die Komponente `null` und nimmt keinen Platz weg.
 */
export function HintergrundStreifen() {
  const { stueck, spielt } = useHintergrundAudio();
  const { width, height } = useWindowDimensions();
  const { t, rtl } = useTranslation();
  const theme = useTheme();
  const s = useMemo(() => makeStyles(width, height, rtl, theme), [width, height, rtl, theme]);

  if (!stueck) return null;

  return (
    <View style={s.wrap} pointerEvents="box-none">
      <FocusCard onPress={umschalten} style={s.karte}>
        <View style={s.reihe}>
          <Icon name={spielt ? 'pause' : 'play'} size={s.symbolGroesse} color={theme.accent} />
          <View style={s.textBlock}>
            <Text style={s.kicker} numberOfLines={1}>
              {t(spielt ? 'player.laeuftImHintergrund' : 'player.pausiert')}
            </Text>
            <Text style={s.titel} numberOfLines={1}>
              {stueck.title}
              {stueck.subtitle ? ` · ${stueck.subtitle}` : ''}
            </Text>
          </View>
        </View>
      </FocusCard>
    </View>
  );
}

function makeStyles(w: number, h: number, rtl: boolean, theme: Theme) {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const padH = clamp(w * 0.05, 28, 96);
  // Der Streifen sitzt ueber dem unteren Rand, nicht darauf: Fernseher
  // schneiden am Rand ab (Overscan), und die fokussierte Karte waechst
  // zusaetzlich um 5 %.
  const abstandUnten = clamp(h * 0.05, 20, 56);
  const symbol = Math.round(clamp(h * 0.035, 18, 34));
  return Object.assign(
    StyleSheet.create({
      wrap: {
        position: 'absolute',
        left: padH,
        right: padH,
        bottom: abstandUnten,
        alignItems: rtl ? 'flex-end' : 'flex-start',
      },
      karte: {
        paddingHorizontal: clamp(w * 0.018, 14, 30),
        paddingVertical: clamp(h * 0.018, 10, 20),
        maxWidth: '70%',
      },
      reihe: {
        flexDirection: rtl ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: clamp(w * 0.012, 10, 20),
      },
      textBlock: { flexShrink: 1, alignItems: rtl ? 'flex-end' : 'flex-start' },
      kicker: {
        color: theme.textFaint,
        fontSize: clamp(h * 0.022, 11, 18),
        letterSpacing: rtl ? 0 : 2,
        textTransform: 'uppercase',
      },
      titel: {
        color: theme.text,
        fontSize: clamp(h * 0.032, 15, 26),
        fontWeight: '600',
        marginTop: 2,
        textAlign: rtl ? 'right' : 'left',
      },
    }),
    { symbolGroesse: symbol },
  );
}
