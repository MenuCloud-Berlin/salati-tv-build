import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer } from 'expo-video';

import { AmbientGlow } from '@/components/AmbientGlow';
import { useAzanLauf } from '@/lib/azanRuf';
import {
  istGespeichert,
  offlineAudioMoeglich,
  sureHerunterladen,
  sureLoeschen,
  useOfflineAudio,
} from '@/lib/offlineAudio';
import { FocusCard } from '@/components/FocusCard';
import { useTranslation } from '@/lib/i18n';
import type { Theme } from '@/lib/theme';
import { useTheme } from '@/lib/useTheme';

// Vollbild-Audio-Player für Rezitatoren & Radio. expo-video dient hier als
// reine Audio-Engine (kein VideoView gemountet → nur Ton, läuft im nativen
// ExoPlayer weiter). Eigene 10-Fuß-Steuerung: eine große fokussierte Play/Pause-
// Karte, Titel/Untertitel groß, ruhiger Verlaufs-Hintergrund. Zurück steuert der
// aufrufende Screen (Menu/Back-Taste).
//
// Audit 2026-07-28 (T13): Kicker und Hinweiszeile waren fest deutsch. Der
// Aufrufer uebergibt jetzt einen Uebersetzungs-Schluessel statt fertigem Text.
export function AudioNowPlaying({
  uri,
  title,
  subtitle,
  loop = false,
  coverUrl,
  kickerKey,
  speicherbar,
}: {
  uri: string;
  title: string;
  subtitle?: string;
  loop?: boolean;
  coverUrl?: string;
  kickerKey?: string;
  /**
   * Wenn gesetzt, bekommt der Bildschirm einen Knopf zum Speichern der
   * Rezitation. Nur die Rezitatoren geben ihn mit: ein Radio-Stream hat kein
   * Ende und laesst sich nicht herunterladen, und ein Podcast liegt ohnehin
   * schon als Datei bereit.
   */
  speicherbar?: { reciterId: string; reciterName: string; surah: number; netzUrl: string };
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = loop;
    p.play();
  });
  const [playing, setPlaying] = useState(true);
  const [status, setStatus] = useState<string>('loading');
  const { width, height } = useWindowDimensions();
  const { t, rtl } = useTranslation();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(width, height, rtl, theme), [width, height, rtl, theme]);

  useEffect(() => {
    const s1 = player.addListener('playingChange', (e) => setPlaying(e.isPlaying));
    const s2 = player.addListener('statusChange', (e) => setStatus(e.status));
    return () => {
      s1.remove();
      s2.remove();
    };
  }, [player]);

  // Setzt der Gebetsruf ein, verstummt die laufende Rezitation. Zwei Stimmen
  // gleichzeitig aus demselben Fernseher waeren fuer beide respektlos. Danach
  // laeuft sie NICHT von selbst weiter — wer wieder hoeren will, druckt OK;
  // das automatische Fortsetzen mitten im Gebetsruf waere genau der Fehler,
  // den das Pausieren vermeiden soll.
  const rufLaeuft = useAzanLauf() !== null;
  useEffect(() => {
    if (rufLaeuft && player.playing) player.pause();
  }, [rufLaeuft, player]);

  const toggle = () => {
    if (player.playing) player.pause();
    else player.play();
  };

  const kicker = t(kickerKey ?? (loop ? 'player.kickerRadio' : 'player.kickerRecitation'));

  // Speichern/Loeschen der Rezitation. `useOfflineAudio` haelt die Anzeige am
  // Verzeichnis; `fortschritt` ist nur waehrend des Ladens gesetzt.
  useOfflineAudio();
  const [fortschritt, setFortschritt] = useState<number | null>(null);
  const [fehler, setFehler] = useState(false);
  // Die Hinweiszeile beschreibt den FOKUSSIERTEN Knopf. Ohne das stand dort
  // „OK speichert diese Sure", waehrend der Fokus auf Wiedergabe lag — der
  // Hinweis haette den Nutzer zur falschen Taste geschickt.
  const [speicherFokus, setSpeicherFokus] = useState(false);
  const gespeichert = speicherbar ? istGespeichert(speicherbar.reciterId, speicherbar.surah) : false;

  async function speichernUmschalten() {
    if (!speicherbar || fortschritt !== null) return;
    setFehler(false);
    if (gespeichert) {
      await sureLoeschen(speicherbar.reciterId, speicherbar.surah);
      return;
    }
    setFortschritt(0);
    try {
      await sureHerunterladen(
        speicherbar.reciterId,
        speicherbar.reciterName,
        speicherbar.surah,
        speicherbar.netzUrl,
        setFortschritt,
      );
    } catch {
      setFehler(true);
    } finally {
      setFortschritt(null);
    }
  }

  return (
    <View style={styles.root}>
      {coverUrl ? (
        <Image source={{ uri: coverUrl }} style={styles.coverBg} contentFit="cover" blurRadius={30} />
      ) : null}
      <View style={styles.scrim} />
      <AmbientGlow color={theme.accent} size={Math.min(width, height) * 1.1} top={-height * 0.28} left={-width * 0.1} />
      <AmbientGlow color={theme.glowRing} size={Math.min(width, height) * 1.2} bottom={-height * 0.32} right={-width * 0.1} intensity={0.12} />
      <View style={styles.center}>
        {coverUrl ? <Image source={{ uri: coverUrl }} style={styles.coverArt} contentFit="cover" /> : null}
        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        <View style={styles.knopfReihe}>
          <FocusCard hasTVPreferredFocus onPress={toggle} style={styles.playCard}>
            {status === 'loading' ? (
              <ActivityIndicator color={theme.accent} size="large" />
            ) : (
              <Text style={styles.playGlyph}>{playing ? '❚❚' : '▶'}</Text>
            )}
          </FocusCard>

          {speicherbar && offlineAudioMoeglich() ? (
            <FocusCard
              onPress={speichernUmschalten}
              onFocus={() => setSpeicherFokus(true)}
              onBlur={() => setSpeicherFokus(false)}
              style={[styles.speicherCard, gespeichert && styles.speicherAktiv]}>
              <Text style={[styles.speicherGlyph, gespeichert && styles.speicherAktivText]}>
                {fortschritt !== null ? `${Math.round(fortschritt * 100)}%` : gespeichert ? '✓' : '↓'}
              </Text>
            </FocusCard>
          ) : null}
        </View>

        <Text style={styles.hint}>
          {fehler
            ? t('player.saveError')
            : fortschritt !== null
              ? t('player.saving')
              : speicherFokus
                ? gespeichert
                  ? t('player.savedHint')
                  : t('player.saveHint')
                : status === 'error'
                  ? t('player.error')
                  : playing
                    ? t('player.hintPause')
                    : t('player.hintResume')}
        </Text>
      </View>
    </View>
  );
}

/** Dichte-relative Groessen wie in ClockScreen — die Karte war vorher fest
 *  140×140 dp und der Titel 56 dp, was auf 540-dp-Panels zusammen mit Cover
 *  (260 dp) hoeher wurde als der Bildschirm. */
function makeStyles(w: number, h: number, rtl: boolean, theme: Theme) {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const play = clamp(h * 0.18, 80, 150);
  const cover = clamp(h * 0.3, 120, 260);
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.bg, overflow: 'hidden' },
    coverBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 },
    scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.scrim },
    coverArt: { width: cover, height: cover, borderRadius: 20, marginBottom: clamp(h * 0.03, 12, 28) },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: clamp(w * 0.06, 40, 120) },
    kicker: {
      color: theme.accent,
      fontSize: clamp(h * 0.035, 15, 24),
      fontWeight: '700',
      // Buchstabenabstand zerreisst arabische Ligaturen — im RTL-Layout 0.
      letterSpacing: rtl ? 0 : 6,
      textTransform: 'uppercase',
      marginBottom: clamp(h * 0.02, 8, 20),
    },
    title: { color: theme.text, fontSize: clamp(h * 0.075, 28, 56), fontWeight: '800', textAlign: 'center' },
    subtitle: {
      color: theme.textMuted,
      fontSize: clamp(h * 0.04, 18, 30),
      marginTop: clamp(h * 0.015, 6, 14),
      textAlign: 'center',
    },
    playCard: {
      width: play,
      height: play,
      borderRadius: play / 2,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: clamp(h * 0.05, 20, 48),
    },
    playGlyph: { color: theme.accent, fontSize: clamp(play * 0.38, 26, 52), fontWeight: '700' },
    knopfReihe: {
      flexDirection: rtl ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: clamp(w * 0.016, 14, 28),
    },
    // Kleiner als die Wiedergabe-Taste: Speichern ist die seltenere Handlung,
    // und die Groesse sagt das, ohne dass es jemand lesen muss.
    speicherCard: {
      width: play * 0.62,
      height: play * 0.62,
      borderRadius: (play * 0.62) / 2,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: clamp(h * 0.05, 20, 48),
    },
    speicherAktiv: { borderColor: theme.accent, borderWidth: 2, backgroundColor: theme.cardActive },
    speicherGlyph: { color: theme.text, fontSize: clamp(play * 0.2, 15, 28), fontWeight: '700' },
    speicherAktivText: { color: theme.accent },
    hint: {
      color: theme.textFaint,
      fontSize: clamp(h * 0.035, 15, 24),
      marginTop: clamp(h * 0.04, 16, 36),
      textAlign: 'center',
    },
  });
}
