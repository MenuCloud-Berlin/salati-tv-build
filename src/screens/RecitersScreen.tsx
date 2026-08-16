import { useEffect, useMemo, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AudioNowPlaying } from '@/components/AudioNowPlaying';
import { FocusCard } from '@/components/FocusCard';
import { fokusUeberstand } from '@/components/fokusUeberstand';
import { StateView } from '@/components/StateView';
import { SURAHS } from '@/data/surahs';
import { useTranslation } from '@/lib/i18n';
import { abspielAdresse, istGespeichert, useOfflineAudio } from '@/lib/offlineAudio';
import { fetchReciters, kamAusAblage, surahAudioUrl, type Reciter } from '@/lib/quranAudio';
import type { Theme } from '@/lib/theme';
import { useTheme } from '@/lib/useTheme';

type Stage =
  | { view: 'reciters' }
  | { view: 'surahs'; reciter: Reciter }
  | { view: 'play'; reciter: Reciter; surah: number };

// Rezitatoren-Bereich: Rezitator wählen → Sure wählen → Voll-Suren-Rezitation
// abspielen. Interne Stufen-Navigation (react-native-tvos Fokus je Stufe);
// die globale Zurück-Taste im App-Root führt aus dem Bereich heraus.
export function RecitersScreen() {
  const [reciters, setReciters] = useState<Reciter[] | null>(null);
  const [error, setError] = useState(false);
  const [stage, setStage] = useState<Stage>({ view: 'reciters' });
  const { height, width } = useWindowDimensions();
  const { t, rtl } = useTranslation();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(height, width, rtl, theme), [height, width, rtl, theme]);

  // s. VideosScreen: Fehler war ohne Wiederholen endgueltig (Audit 2026-07-28).
  const [attempt, setAttempt] = useState(0);
  // Der Ruecksetzer gehoert in den Wiederholen-Knopf, NICHT in den Effekt:
  // ein synchrones setState im Effektkoerper loest eine zweite Renderrunde aus
  // (react-hooks/set-state-in-effect). Beim ersten Lauf stehen beide Zustaende
  // ohnehin schon auf ihrem Startwert.
  const reload = () => {
    setError(false);
    setReciters(null);
    setAttempt((a) => a + 1);
  };

  useEffect(() => {
    let alive = true;
    fetchReciters()
      .then((r) => alive && setReciters(r))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [attempt]);

  // Zurück innerhalb des Bereichs: play → surahs → reciters; erst am
  // Rezitatoren-Wurzelblatt gibt der App-Root das Zurück weiter (Screen verlassen).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stage.view === 'play') {
        setStage({ view: 'surahs', reciter: stage.reciter });
        return true;
      }
      if (stage.view === 'surahs') {
        setStage({ view: 'reciters' });
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stage]);

  if (stage.view === 'play') {
    const s = SURAHS.find((x) => x.n === stage.surah);
    const netzUrl = surahAudioUrl(stage.reciter.server, stage.surah);
    return (
      <AudioNowPlaying
        quelle="reciters"
        // Gespeicherte Datei schlaegt das Netz — sonst laedt der Fernseher
        // dieselbe Sure jedes Mal neu, obwohl sie auf der Platte liegt.
        uri={abspielAdresse(stage.reciter.id, stage.surah, netzUrl)}
        title={s ? `${s.n}. ${s.en}` : t('reciters.surahN', { n: stage.surah })}
        subtitle={stage.reciter.name}
        speicherbar={{
          reciterId: stage.reciter.id,
          reciterName: stage.reciter.name,
          surah: stage.surah,
          netzUrl,
        }}
      />
    );
  }

  if (stage.view === 'surahs') {
    return (
      <SurahPicker
        reciter={stage.reciter}
        onPick={(n) => setStage({ view: 'play', reciter: stage.reciter, surah: n })}
      />
    );
  }

  // Audit 2026-07-28: kein fokussierbares Element in Fehler-/Ladezustand.
  if (error) {
    return (
      <StateView messageKey="reciters.loadError" onAction={reload} />
    );
  }
  if (!reciters) {
    return <StateView loading onAction={reload} />;
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t('reciters.title')}</Text>
      {kamAusAblage('reciters') ? <Text style={styles.subtitle}>{t('common.offlineList')}</Text> : null}
      <ScrollView
        style={styles.gridScroll}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}>
        {reciters.map((r, i) => (
          <FocusCard
            key={r.id}
            hasTVPreferredFocus={i === 0}
            onPress={() => setStage({ view: 'surahs', reciter: r })}
            style={styles.reciterCard}>
            <Text style={styles.reciterName} numberOfLines={2}>
              {r.name}
            </Text>
            <Text style={styles.reciterRewaya} numberOfLines={1}>
              {r.rewaya}
            </Text>
          </FocusCard>
        ))}
      </ScrollView>
    </View>
  );
}

function SurahPicker({ reciter, onPick }: { reciter: Reciter; onPick: (n: number) => void }) {
  // Am Verzeichnis haengen, damit ein frischer Download sofort sichtbar ist.
  useOfflineAudio();
  const available = useMemo(() => new Set(reciter.surahList), [reciter]);
  const surahs = useMemo(() => SURAHS.filter((s) => available.has(s.n)), [available]);
  const { height, width } = useWindowDimensions();
  const { rtl } = useTranslation();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(height, width, rtl, theme), [height, width, rtl, theme]);
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{reciter.name}</Text>
      <Text style={styles.subtitle}>{reciter.rewaya}</Text>
      <ScrollView
        style={styles.gridScroll}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}>
        {surahs.map((s, i) => (
          <FocusCard
            key={s.n}
            hasTVPreferredFocus={i === 0}
            onPress={() => onPick(s.n)}
            style={styles.surahCard}>
            <Text style={styles.surahNum}>
              {s.n}
              {/* Haken statt Text: aus drei Metern schneller zu erfassen, und
                  er braucht keine Uebersetzung. */}
              {istGespeichert(reciter.id, s.n) ? <Text style={styles.gespeichert}> ✓</Text> : null}
            </Text>
            <Text style={styles.surahName} numberOfLines={1}>
              {s.en}
            </Text>
            <Text style={styles.surahAr} numberOfLines={1}>
              {s.ar}
            </Text>
          </FocusCard>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * Dichte-relative Styles (siehe ClockScreen): Spaltenzahl + Kartenbreite aus der
 * echten dp-Fläche, damit die Karten auf dem 320-dpi-Emulator (540 dp) genauso
 * sauber in 3 Spalten sitzen wie auf 1×-1080p-TVs (4 Spalten).
 */
function makeStyles(h: number, w: number, rtl: boolean, theme: Theme) {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const padH = clamp(w * 0.045, 28, 80);
  const padV = clamp(h * 0.05, 24, 56);
  const gap = clamp(w * 0.016, 14, 26);
  const availW = w - padH * 2;
  // −1 dp Sicherheitsmarge pro Spalte gegen Sub-Pixel-Umbruch (siehe HomeScreen).
  const rCols = w >= 1400 ? 4 : 3;
  const reciterW = Math.floor((availW - gap * (rCols - 1)) / rCols) - 1;
  const sCols = w >= 1400 ? 6 : 4;
  const surahW = Math.floor((availW - gap * (sCols - 1)) / sCols) - 1;
  const cardH = clamp(h * 0.24, 108, 160);
  // Rahmen der fokussierten Karte nicht an der Scroll-Kante abschneiden.
  const ueber = fokusUeberstand(Math.max(reciterW, cardH));

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: padH, paddingTop: padV, paddingBottom: padV * 0.4 },
    title: { color: theme.accent, fontSize: clamp(h * 0.05, 26, 44), fontWeight: '800', letterSpacing: rtl ? 0 : 2, textAlign: rtl ? 'right' : 'left' },
    subtitle: { color: theme.textMuted, fontSize: clamp(h * 0.032, 16, 26), marginTop: 4, marginBottom: 8, textAlign: rtl ? 'right' : 'left' },
    gridScroll: { marginHorizontal: -ueber, marginVertical: -ueber },
    grid: {
      flexDirection: rtl ? 'row-reverse' : 'row',
      flexWrap: 'wrap',
      gap,
      paddingHorizontal: ueber,
      paddingVertical: clamp(h * 0.025, 12, 24) + ueber,
    },
    reciterCard: { width: reciterW, height: cardH, padding: clamp(h * 0.03, 16, 24), justifyContent: 'center' },
    reciterName: { color: theme.text, fontSize: clamp(h * 0.035, 18, 28), fontWeight: '700', textAlign: rtl ? 'right' : 'left' },
    reciterRewaya: { color: theme.textMuted, fontSize: clamp(h * 0.026, 14, 20), marginTop: 6, textAlign: rtl ? 'right' : 'left' },
    surahCard: { width: surahW, height: cardH, padding: clamp(h * 0.028, 14, 22), justifyContent: 'center' },
    surahNum: { color: theme.accent, fontSize: clamp(h * 0.028, 15, 22), fontWeight: '700' },
    surahName: { color: theme.text, fontSize: clamp(h * 0.032, 16, 24), fontWeight: '600', marginTop: 4 },
    gespeichert: { color: theme.accent },
    surahAr: { color: theme.textMuted, fontSize: clamp(h * 0.03, 15, 22), marginTop: 4, textAlign: 'right' },
  });
}
