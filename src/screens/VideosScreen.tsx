import { useEffect, useMemo, useState } from 'react';
import { BackHandler, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { FocusCard } from '@/components/FocusCard';
import { Icon } from '@/components/Icon';
import { makeRowStyles, rowIconSize } from '@/components/rowStyles';
import { StateView } from '@/components/StateView';
import { VideoPlayer } from '@/components/VideoPlayer';
import { fetchVideos, fmtDuration, groupBySeries,
  kamAusAblage, type Section, type VideoEntry } from '@/lib/content';
import { useTranslation } from '@/lib/i18n';
import { useTheme } from '@/lib/useTheme';

// Lern-Videos-Browser: Netflix-artige Reihen (nach series_title gruppiert),
// D-Pad-Fokus, Auswahl spielt das Video im Vollbild (nativer Player).
// Quelle: die vorhandene R2-videos/index.json (kein Neu-Hosting).
export function VideosScreen() {
  const [sections, setSections] = useState<Section<VideoEntry>[] | null>(null);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const { width, height } = useWindowDimensions();
  const { t, rtl } = useTranslation();
  const theme = useTheme();
  // Querformat-Karten (16:10-artig) — siehe rowStyles.ts (Audit T12).
  const styles = useMemo(() => makeRowStyles(width, height, rtl, 1.3, theme), [width, height, rtl, theme]);
  // Wiederhol-Zaehler: der Ladeeffekt haengt daran, ein Inkrement startet den
  // Abruf neu. Vorher war `setError(true)` endgueltig — ohne den Bereich zu
  // verlassen kam man nicht mehr an die Inhalte (Audit 2026-07-28).
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
    fetchVideos()
      .then((v) => alive && setSections(groupBySeries(v)))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [attempt]);

  // Zurück während der Wiedergabe → zurück zur Videoliste.
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

  // Audit 2026-07-28: Fehler- und Ladezustand hatten KEIN fokussierbares
  // Element — auf Android TV findet die Fernbedienung dann keinen Anker und der
  // Bildschirm wirkt tot (gleicher Fehler wie am Clock-Screensaver 2026-07-24).
  // StateView bringt Fokus + Wiederholen mit.
  if (error) {
    return <StateView messageKey="videos.loadError" onAction={reload} />;
  }
  if (!sections) {
    return <StateView loading onAction={reload} />;
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{t('videos.title')}</Text>
      {kamAusAblage('videos') ? <Text style={styles.cardMeta}>{t('common.offlineStreams')}</Text> : null}
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
                key={v.video_url}
                hasTVPreferredFocus={si === 0 && i === 0}
                onPress={() => setPlaying(v.video_url)}
                style={styles.card}>
                <View style={styles.thumb}>
                  {/* Ohne Vorschaubild (der Index fuehrt keins) gaebe die
                      Kachel nur ein Dreieck her — neun davon nebeneinander
                      sehen nach fehlendem Bild aus. Die Folgennummer gibt
                      jeder Kachel ein Gesicht (s. components/rowStyles.ts). */}
                  <Text style={styles.thumbNummer}>{v.episode_no}</Text>
                  <Icon name="play" size={rowIconSize(height)} color={theme.accent} />
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {v.title}
                </Text>
                <Text style={styles.cardMeta} numberOfLines={1}>{fmtDuration(v.duration_sec)}</Text>
              </FocusCard>
            ))}
          </ScrollView>
        </View>
      ))}
    </ScrollView>
  );
}

