import { useEffect, useMemo, useState } from 'react';
import { BackHandler, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { FocusCard } from '@/components/FocusCard';
import { Icon } from '@/components/Icon';
import { makeRowStyles, rowIconSize } from '@/components/rowStyles';
import { StateView } from '@/components/StateView';
import { VideoPlayer } from '@/components/VideoPlayer';
import { fetchReels, fmtDuration, groupBySeries,
  kamAusAblage, type ReelEntry, type Section } from '@/lib/content';
import { useTranslation } from '@/lib/i18n';
import { useTheme } from '@/lib/useTheme';

// Reels-Browser: kurze Clips (R2 reels/index.json), nach Serie gruppiert. Auf dem
// TV horizontal in Reihen statt vertikalem Swipe (10-Fuß-Bedienung). Auswahl
// spielt den Clip im Vollbild; Zurück führt zur Liste.
export function ReelsScreen() {
  const [sections, setSections] = useState<Section<ReelEntry>[] | null>(null);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const { width, height } = useWindowDimensions();
  const { t, rtl } = useTranslation();
  const theme = useTheme();
  // Hochkant-Karten (Reels sind Hochformat) — siehe rowStyles.ts (Audit T12).
  const styles = useMemo(() => makeRowStyles(width, height, rtl, 0.85, theme), [width, height, rtl, theme]);
  // s. VideosScreen: Fehler war ohne Wiederholen endgueltig (Audit 2026-07-28).
  const [attempt, setAttempt] = useState(0);
  // Der Ruecksetzer gehoert in den Wiederholen-Knopf, NICHT in den Effekt:
  // ein synchrones setState im Effektkoerper loest eine zweite Renderrunde aus
  // (react-hooks/set-state-in-effect). Beim ersten Lauf stehen beide Zustaende
  // ohnehin schon auf ihrem Startwert.
  const reload = () => {
    setError(false);
    setSections(null);
    setAttempt((a) => a + 1);
  };

  useEffect(() => {
    let alive = true;
    fetchReels()
      .then((v) => alive && setSections(groupBySeries(v)))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [attempt]);

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
    return <VideoPlayer uri={playing} onEnd={() => setPlaying(null)} />;
  }
  // Audit 2026-07-28: kein fokussierbares Element in Fehler-/Ladezustand.
  if (error) {
    return <StateView messageKey="reels.loadError" onAction={reload} />;
  }
  if (!sections) {
    return <StateView loading onAction={reload} />;
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{t('reels.title')}</Text>
      {kamAusAblage('reels') ? <Text style={styles.cardMeta}>{t('common.offlineStreams')}</Text> : null}
      {sections.map((sec, si) => (
        <View key={sec.key} style={styles.section}>
          <Text style={styles.sectionTitle}>{sec.title}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.rowScroll}
            contentContainerStyle={styles.row}>
            {sec.items.map((v, i) => (
              <FocusCard
                key={v.id}
                hasTVPreferredFocus={si === 0 && i === 0}
                onPress={() => setPlaying(v.video_url)}
                style={styles.card}>
                <View style={styles.thumb}>
                  {/* Die Nummer gehoert in die Kachel, nicht nur in die
                      Kleinzeile darunter: bis 1.9.0 stand sie allein dort, und
                      auf drei Meter Abstand sah die Reihe weiterhin nach fuenf
                      gleichen Karten aus (Fortsetzung des Befunds von unten). */}
                  <Text style={styles.thumbNummer}>
                    {v.episode_no}.{v.index}
                  </Text>
                  <Icon name="bolt" size={rowIconSize(height)} color={theme.accent} />
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {v.title}
                </Text>
                {/* Bildschirmbefund Audit 2026-07-29: alle Clips EINER Folge tragen
                    denselben Titel — die Reihe zeigte fuenf optisch identische
                    Karten, unterscheidbar nur an der Dauer. Folge und Clip-Nummer
                    („Folge 34.2") machen sie wieder auseinanderhaltbar. */}
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {t('reels.episodeLabel')} {v.episode_no}.{v.index} · {fmtDuration(v.duration_sec)}
                </Text>
              </FocusCard>
            ))}
          </ScrollView>
        </View>
      ))}
    </ScrollView>
  );
}

