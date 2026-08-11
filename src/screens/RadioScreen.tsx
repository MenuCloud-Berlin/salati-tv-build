import { useEffect, useMemo, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AudioNowPlaying } from '@/components/AudioNowPlaying';
import { FocusCard } from '@/components/FocusCard';
import { Icon } from '@/components/Icon';
import { makeRowStyles } from '@/components/rowStyles';
import { StateView } from '@/components/StateView';
import { useTranslation } from '@/lib/i18n';
import { fetchRadios, kamAusAblage, type RadioStation } from '@/lib/quranAudio';
import type { Theme } from '@/lib/theme';
import { useTheme } from '@/lib/useTheme';

// Koran-Radio: 24/7-Streams von mp3quran.net. Sender wählen → Dauer-Wiedergabe
// (loop, weil Endlos-Stream). Zurück im App-Root verlässt den Bereich.
export function RadioScreen() {
  const [stations, setStations] = useState<RadioStation[] | null>(null);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState<RadioStation | null>(null);
  const { width, height } = useWindowDimensions();
  const { t, rtl } = useTranslation();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(width, height, rtl, theme), [width, height, rtl, theme]);
  const glyphSize = Math.round(Math.max(22, Math.min(36, height * 0.22 * 0.22)));
  // s. VideosScreen: Fehler war ohne Wiederholen endgueltig (Audit 2026-07-28).
  const [attempt, setAttempt] = useState(0);
  // Der Ruecksetzer gehoert in den Wiederholen-Knopf, NICHT in den Effekt:
  // ein synchrones setState im Effektkoerper loest eine zweite Renderrunde aus
  // (react-hooks/set-state-in-effect). Beim ersten Lauf stehen beide Zustaende
  // ohnehin schon auf ihrem Startwert.
  const reload = () => {
    setError(false);
    setStations(null);
    setAttempt((a) => a + 1);
  };

  useEffect(() => {
    let alive = true;
    fetchRadios()
      .then((s) => alive && setStations(s))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [attempt]);

  // Zurück beim Abspielen → zurück zur Senderliste (statt gleich raus zum Home).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (playing) {
        setPlaying(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [playing]);

  if (playing) {
    return <AudioNowPlaying uri={playing.url} title={playing.name} loop subtitle="mp3quran.net" />;
  }

  // Audit 2026-07-28: kein fokussierbares Element in Fehler-/Ladezustand.
  if (error) {
    return <StateView messageKey="radio.loadError" onAction={reload} />;
  }
  if (!stations) {
    return <StateView loading onAction={reload} />;
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t('radio.title')}</Text>
      {/* Sender kommen aus der Ablage, die Streams selbst brauchen Netz — der
          Hinweis sagt genau das, statt eine leere Wiedergabe zu erklaeren. */}
      {kamAusAblage('radios') ? <Text style={styles.offline}>{t('common.offlineStreams')}</Text> : null}
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {stations.map((s, i) => (
          <FocusCard
            key={s.id}
            hasTVPreferredFocus={i === 0}
            onPress={() => setPlaying(s)}
            style={styles.card}>
            <Icon name="radio" size={glyphSize} color={theme.accent} />
            <Text style={styles.name} numberOfLines={2}>
              {s.name}
            </Text>
          </FocusCard>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * Dichte-relatives Sender-Raster (Audit 2026-07-28, T12): vorher fest
 * `paddingHorizontal: 56` und Karten `300×150`. Die Spaltenzahl kommt jetzt aus
 * der echten dp-Breite, mit derselben −1-dp-Marge gegen Sub-Pixel-Umbruch wie
 * in HomeScreen/RecitersScreen.
 */
function makeStyles(w: number, h: number, rtl: boolean, theme: Theme) {
  const base = makeRowStyles(w, h, rtl, 1, theme);
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const padH = clamp(w * 0.045, 28, 80);
  const gap = clamp(w * 0.014, 12, 22);
  const cols = w >= 1400 ? 4 : 3;
  const cardW = Math.floor((w - padH * 2 - gap * (cols - 1)) / cols) - 1;
  const cardH = clamp(h * 0.22, 96, 170);
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: padH, paddingVertical: clamp(h * 0.05, 20, 48) },
    title: base.title,
    grid: base.grid,
    card: {
      width: cardW,
      height: cardH,
      padding: clamp(cardH * 0.13, 12, 22),
      justifyContent: 'center',
      alignItems: rtl ? 'flex-end' : 'flex-start',
      gap: clamp(cardH * 0.06, 6, 12),
    },
    offline: {
      color: theme.textFaint,
      fontSize: clamp(h * 0.026, 13, 20),
      marginBottom: clamp(h * 0.014, 6, 14),
      textAlign: rtl ? 'right' : 'left',
    },
    name: {
      color: theme.text,
      fontSize: clamp(cardH * 0.15, 15, 24),
      fontWeight: '600',
      textAlign: rtl ? 'right' : 'left',
    },
  });
}
