import { useEffect, useMemo, useState } from 'react';
import { BackHandler, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';

import { AudioNowPlaying } from '@/components/AudioNowPlaying';
import { FocusCard } from '@/components/FocusCard';
import { Icon } from '@/components/Icon';
import { makeRowStyles, rowIconSize } from '@/components/rowStyles';
import { StateView } from '@/components/StateView';
import { fetchPodcasts, fmtDuration, groupBySeries,
  kamAusAblage, type PodcastEntry, type Section } from '@/lib/content';
import { useTranslation } from '@/lib/i18n';
import { useTheme } from '@/lib/useTheme';

// Podcasts: der deutsche Quran-Arabisch-Podcast (Supabase-Index). Cover-Grid in
// Reihen nach Serie; Auswahl spielt die Folge als Audio (mit Cover-Hintergrund).
export function PodcastsScreen() {
  const [sections, setSections] = useState<Section<PodcastEntry>[] | null>(null);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState<PodcastEntry | null>(null);
  const { width, height } = useWindowDimensions();
  const { t, rtl } = useTranslation();
  const theme = useTheme();
  // Seitenverhaeltnis so gewaehlt, dass das quadratische Cover die Kartenbreite
  // genau fuellt (Kartenbreite = Bildhoehe + 2x Innenabstand) — siehe rowStyles.ts.
  // `metaLines: 2` — auf schmalen Karten bricht „Episode 1 · 11:54" um; ohne
  // reservierte zweite Zeile lief die Dauer unten aus der Karte (Audit 2026-07-29).
  const styles = useMemo(() => makeRowStyles(width, height, rtl, 0.62, theme, 2), [width, height, rtl, theme]);
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
    fetchPodcasts()
      .then((eps) => alive && setSections(groupBySeries(eps)))
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
    return (
      <AudioNowPlaying
        quelle="podcasts"
        uri={playing.audio_url}
        title={playing.title}
        subtitle={playing.series_title ?? t('podcasts.fallbackSeries')}
        coverUrl={playing.cover_url}
        kickerKey="player.kickerPodcast"
      />
    );
  }
  // Audit 2026-07-28: kein fokussierbares Element in Fehler-/Ladezustand.
  if (error) {
    return <StateView messageKey="podcasts.loadError" onAction={reload} />;
  }
  if (!sections) {
    return <StateView loading onAction={reload} />;
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{t('podcasts.title')}</Text>
      {kamAusAblage('podcasts') ? <Text style={styles.cardMeta}>{t('common.offlineStreams')}</Text> : null}
      {sections.map((sec, si) => (
        <View key={sec.key} style={styles.section}>
          <Text style={styles.sectionTitle}>{sec.title}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.rowScroll}
            contentContainerStyle={styles.row}>
            {sec.items.map((ep, i) => (
              <FocusCard
                key={ep.episode_no}
                hasTVPreferredFocus={si === 0 && i === 0}
                onPress={() => setPlaying(ep)}
                style={styles.card}>
                {ep.cover_url ? (
                  <Image source={{ uri: ep.cover_url }} style={styles.cover} contentFit="cover" />
                ) : (
                  <View style={[styles.cover, styles.coverFallback]}>
                    <Icon name="headphones" size={rowIconSize(height)} color={theme.accent} />
                  </View>
                )}
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {ep.title}
                </Text>
                <Text style={styles.cardMeta} numberOfLines={2}>
                  {t('podcasts.episodeLabel')} {ep.episode_no}
                  {ep.duration_sec ? ` · ${fmtDuration(ep.duration_sec)}` : ''}
                </Text>
              </FocusCard>
            ))}
          </ScrollView>
        </View>
      ))}
    </ScrollView>
  );
}

