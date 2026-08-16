import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { FocusCard } from '@/components/FocusCard';
import { fokusUeberstand } from '@/components/fokusUeberstand';
import { HintergrundStreifen } from '@/components/HintergrundStreifen';
import { Icon, type IconName } from '@/components/Icon';
import { useTranslation } from '@/lib/i18n';
import type { Screen } from '@/lib/nav';
import { countdownUnits, fmtCountdown, nextPrayer } from '@/lib/prayerTimes';
import { calcExtras, useTvSettings } from '@/lib/settings';
import { zeitInZone } from '@/lib/timezone';
import type { Theme } from '@/lib/theme';
import { useTheme } from '@/lib/useTheme';

interface Tile {
  screen: Screen;
  labelKey: string;
  hintKey: string;
  icon: IconName;
}

// Der Home-Hub — Einstieg in alle Bereiche. Große, fokussierbare Kacheln für
// die D-Pad-Bedienung. „Verbinden" öffnet das Handy-Pairing (Fernbedienung +
// Zweitschirm-Quiz); die eigentlichen Medien-Inhalte kommen aus R2.
//
// Audit 2026-07-28 (T13): Die Beschriftungen standen fest deutsch in dieser
// Liste. Jetzt Schluessel statt Text — uebersetzt in dieselben 14 Sprachen wie
// die Handy-App, mit woertlich uebernommenen Begriffen (locales/*.json).
const TILES: Tile[] = [
  { screen: 'clock', labelKey: 'home.clock', hintKey: 'home.clockHint', icon: 'clock' },
  { screen: 'quran', labelKey: 'home.quran', hintKey: 'home.quranHint', icon: 'reader' },
  { screen: 'reciters', labelKey: 'home.reciters', hintKey: 'home.recitersHint', icon: 'book' },
  { screen: 'radio', labelKey: 'home.radio', hintKey: 'home.radioHint', icon: 'radio' },
  { screen: 'videos', labelKey: 'home.videos', hintKey: 'home.videosHint', icon: 'video' },
  { screen: 'podcasts', labelKey: 'home.podcasts', hintKey: 'home.podcastsHint', icon: 'headphones' },
  { screen: 'reels', labelKey: 'home.reels', hintKey: 'home.reelsHint', icon: 'bolt' },
  { screen: 'quiz', labelKey: 'home.quiz', hintKey: 'home.quizHint', icon: 'quiz' },
  { screen: 'pairing', labelKey: 'home.pairing', hintKey: 'home.pairingHint', icon: 'phone' },
  { screen: 'settings', labelKey: 'home.settings', hintKey: 'home.settingsHint', icon: 'settings' },
];

/**
 * Zuletzt fokussierte Kachel — Audit-Befund N4: nach dem Zurueckkehren aus
 * einem Bereich sprang der Fokus immer auf die erste Kachel, wer zwischen
 * „Videos" und „Podcasts" wechselte musste jedes Mal wieder durch die halbe
 * Liste steuern.
 *
 * Bewusst ein Modul-Zustand und weder State noch Ref im Baum: der Hub wird beim
 * Verlassen ausgehaengt und naehme seinen State mit — genau dann, wenn er
 * gebraucht wird. Ein Ref in App.tsx waere dieselbe Information, muesste aber
 * WAEHREND DES RENDERNS gelesen werden, was React ausdruecklich verbietet
 * (react-hooks/refs). Dasselbe Muster wie bei lib/settings.ts und lib/pairing.ts:
 * Zustand, der laenger lebt als ein Bildschirm, liegt neben dem Baum.
 */
let letzteKachel: Screen = 'clock';

/** Nur fuer Tests: setzt das Fokus-Gedaechtnis auf den Ausgangswert zurueck. */
export function resetHomeFokus() {
  letzteKachel = 'clock';
}

/**
 * Home-Hub — voll responsiv (siehe ClockScreen-Kommentar): Spaltenzahl und
 * Kachelgröße werden aus der tatsächlichen dp-Fläche berechnet, damit die
 * Kacheln auf dem 320-dpi-Emulator (540 dp hoch) genauso sauber sitzen wie auf
 * echten 1×-1080p-TVs und nicht am Rand abgeschnitten werden.
 *
 * Bildschirmbefund 2026-08-08 (1920x1080): die Kacheln waren so gross, dass nur
 * sechs von zehn ins Bild passten — die dritte Reihe war mittendurch
 * abgeschnitten, was wie ein Darstellungsfehler aussieht und nicht wie „hier
 * geht es weiter". Gleichzeitig blieben rechts oben rund 60 % der Kopfzeile
 * leer. Beides ist behoben: die Kachelhoehe wird jetzt aus der VERFUEGBAREN
 * HOEHE geteilt durch die Reihenzahl gerechnet (alle zehn Kacheln sind ohne
 * Scrollen sichtbar), und in die freie Kopfzeile ist das naechste Gebet
 * gewandert — die Information, wegen der der Fernseher ueberhaupt laeuft.
 */
export function HomeScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const { width, height } = useWindowDimensions();
  const { t, rtl } = useTranslation();
  const theme = useTheme();
  const settings = useTvSettings();
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const padH = clamp(width * 0.05, 28, 96);
  const padV = clamp(height * 0.05, 20, 56);
  // Fuenf Spalten auf breiten Panels: zehn Kacheln ergeben damit genau zwei
  // volle Reihen — keine angebrochene letzte Reihe, kein Scrollen.
  const cols = width >= 1400 ? 5 : 4;
  const gap = clamp(width * 0.018, 14, 30);
  const rows = Math.ceil(TILES.length / cols);
  const availW = width - padH * 2;
  // −1 dp Sicherheitsmarge pro Spalte: sonst trifft die Kachelbreite exakt die
  // verfügbare Breite und Sub-Pixel-Rundung lässt die letzte Kachel umbrechen
  // (Gerätetest 2026-07-24: Home fiel dadurch auf 2 statt 3 Spalten zurück).
  const tileW = Math.floor((availW - gap * (cols - 1)) / cols) - 1;
  // Kopfzeile grob veranschlagt (Wortmarke + Unterzeile + Abstand) — die Hoehe
  // muss VOR dem Layout feststehen, sonst laesst sie sich nicht aufteilen.
  const headerH = clamp(height * 0.19, 92, 200);
  const availH = height - padV * 2 - headerH;
  const tileH = clamp(Math.floor((availH - gap * (rows - 1)) / rows), 96, 300);

  const { highLatitude, offsets, location, is24h } = settings;
  const extras = useMemo(() => calcExtras({ highLatitude, offsets }), [highLatitude, offsets]);
  // Einmal je halbe Minute genuegt: der Hub zeigt keine Sekunden, und ein
  // Sekundentakt wuerde bei jedem Tick alle zehn Kacheln neu rendern.
  // Die Zeit kommt aus dem State und nicht aus `Date.now()` im Rumpf — ein
  // Direktaufruf waere eine unreine Funktion im Render (react-hooks/purity).
  const [jetzt, setJetzt] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setJetzt(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const next = useMemo(() => nextPrayer(location, jetzt, extras), [location, extras, jetzt]);
  const units = countdownUnits(t);

  // Wie weit eine fokussierte Kachel ueber ihre Flaeche hinauswaechst.
  // FocusCard skaliert auf 1,05 — die Kachel wird also um 5 % breiter und
  // hoeher, je zur Haelfte nach jeder Seite. Der ScrollView schneidet seine
  // Kinder an seinen Grenzen ab, und genau deshalb fehlte bei den Kacheln am
  // RAND ein Stueck des goldenen Rahmens (Nutzerbefund: "verdeckte Raender").
  // Bei den inneren Kacheln faellt es nicht auf — daher "manchmal".

  const s = useMemo(
    () => makeStyles({ padH, padV, gap, tileW, tileH, headerH, height, rtl, theme }),
    [padH, padV, gap, tileW, tileH, headerH, height, rtl, theme],
  );

  // Bewusst nur EIN Element mit `hasTVPreferredFocus`: zwei Anker lassen den
  // Fokus auf Android TV zwischen ihnen springen (`focus.test.tsx` prueft das).
  //
  // EINMAL beim Aufbau festgelegt (useState-Initialisierer), nicht bei jedem
  // Render neu: `hasTVPreferredFocus` ist auf react-native-tvos kein reiner
  // Anzeigewert, sondern fordert den Fokus an. Waenderte er sich waehrend der
  // Nutzer steuert, zoege es den Fokus mitten in der Bewegung zurueck.
  const [fokusKachel] = useState<Screen>(() =>
    TILES.some((x) => x.screen === letzteKachel) ? letzteKachel : TILES[0].screen,
  );

  return (
    <View style={s.root}>
      <View style={s.header}>
        <View style={s.brandBlock}>
          <Text style={s.brand}>SALATI</Text>
          <Text style={s.sub}>{t('home.tagline')}</Text>
        </View>
        <View style={s.nextBlock}>
          <Text style={s.nextLabel} numberOfLines={1}>{t('clock.next')}</Text>
          <Text style={s.nextName} numberOfLines={1}>
            {t(`prayers.${next.key}`)} · {zeitInZone(next.at, location.tz, is24h)}
          </Text>
          <Text style={s.nextLeft} numberOfLines={1}>
            {t('clock.timeLeft', { time: fmtCountdown(next.diffMs, units) })}
          </Text>
        </View>
      </View>
      {/* `scroll` zieht die Grenzen des ScrollViews um den Ueberstand nach
          aussen, `grid` schiebt den Inhalt um denselben Betrag zurueck. Netto
          steht damit jede Kachel exakt dort wie vorher — nur wird der
          Fokusrahmen nicht mehr abgeschnitten. */}
      <ScrollView style={s.scroll} contentContainerStyle={s.grid} showsVerticalScrollIndicator={false}>
        {TILES.map((tile) => (
          <FocusCard
            key={tile.screen}
            hasTVPreferredFocus={tile.screen === fokusKachel}
            onFocus={() => {
              letzteKachel = tile.screen;
            }}
            onPress={() => navigate(tile.screen)}
            style={s.tile}>
            <View style={s.iconWrap}>
              <Icon name={tile.icon} size={clamp(tileH * 0.24, 26, 48)} color={theme.accent} />
            </View>
            <Text style={s.label} numberOfLines={1}>{t(tile.labelKey)}</Text>
            {/* Zwei Zeilen: bei vier Spalten schnitt „Zweitschirm mit dem
                Handy" einzeilig mitten im Wort ab (Bildschirmbefund 2026-08-08). */}
            <Text style={s.hint} numberOfLines={2}>{t(tile.hintKey)}</Text>
          </FocusCard>
        ))}
      </ScrollView>
      <HintergrundStreifen />
    </View>
  );
}

function makeStyles(o: {
  padH: number;
  padV: number;
  gap: number;
  tileW: number;
  tileH: number;
  headerH: number;
  height: number;
  rtl: boolean;
  theme: Theme;
}) {
  // Der Rahmen der fokussierten Kachel darf an der Scroll-Kante nicht
  // abgeschnitten werden (s. components/fokusUeberstand.ts). Bewusst HIER und
  // nicht im Komponentenkoerper: dort haelt der React-Compiler den Aufruf fuer
  // eine Abhaengigkeit, die sich aendern koennte, und gibt die Memoisierung auf.
  const ueberstandH = fokusUeberstand(o.tileW);
  const ueberstandV = fokusUeberstand(o.tileH);
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const align = o.rtl ? ('right' as const) : ('left' as const);
  const th = o.theme;
  const hintFont = clamp(o.tileH * 0.095, 13, 20);
  const hintZeile = Math.round(hintFont * 1.3);
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: th.bg, paddingHorizontal: o.padH, paddingTop: o.padV, paddingBottom: o.padV },
    header: {
      height: o.headerH,
      flexDirection: o.rtl ? 'row-reverse' : 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    brandBlock: { alignItems: o.rtl ? 'flex-end' : 'flex-start', flexShrink: 1 },
    brand: { color: th.accent, fontSize: clamp(o.height * 0.055, 28, 48), fontWeight: '800', letterSpacing: 8 },
    sub: { color: th.textMuted, fontSize: clamp(o.height * 0.03, 16, 26), marginTop: 6, textAlign: align },
    // Die rechte Kopfhaelfte war leer; hier steht jetzt, wonach der Nutzer
    // ohnehin sucht — ohne dass er dafuer die Uhr oeffnen muss.
    nextBlock: { alignItems: o.rtl ? 'flex-start' : 'flex-end', flexShrink: 1 },
    nextLabel: {
      color: th.textFaint,
      fontSize: clamp(o.height * 0.024, 12, 20),
      letterSpacing: o.rtl ? 0 : 2,
      textTransform: 'uppercase',
    },
    nextName: { color: th.text, fontSize: clamp(o.height * 0.042, 20, 36), fontWeight: '700', marginTop: 2 },
    nextLeft: { color: th.accent, fontSize: clamp(o.height * 0.03, 14, 26), fontWeight: '600', marginTop: 2 },
    // Im RTL-Layout fuellt das Raster von rechts nach links — sonst begaenne
    // die erste Kachel (und damit der Initialfokus) auf der „falschen" Seite.
    // Negativer Rand + gleich grosser Innenabstand: die Schnittkante wandert
    // nach aussen, der Inhalt bleibt stehen. Der negative Rand ist immer
    // kleiner als der Aussenabstand der Wurzel (padH >= 28, Ueberstand <= 10),
    // laeuft also nie ueber den Bildschirmrand hinaus.
    scroll: {
      marginHorizontal: -ueberstandH,
      marginTop: -ueberstandV,
      marginBottom: -ueberstandV,
    },
    grid: {
      flexDirection: o.rtl ? 'row-reverse' : 'row',
      flexWrap: 'wrap',
      gap: o.gap,
      paddingHorizontal: ueberstandH,
      paddingTop: ueberstandV,
      paddingBottom: o.padV * 0.5 + ueberstandV,
    },
    tile: {
      width: o.tileW,
      height: o.tileH,
      paddingHorizontal: clamp(o.tileW * 0.09, 14, 28),
      paddingVertical: clamp(o.tileH * 0.12, 12, 24),
      justifyContent: 'flex-end',
      alignItems: o.rtl ? 'flex-end' : 'flex-start',
    },
    iconWrap: { marginBottom: 'auto' },
    label: { color: th.text, fontSize: clamp(o.tileH * 0.15, 18, 32), fontWeight: '700', textAlign: align },
    hint: {
      color: th.textMuted,
      fontSize: hintFont,
      lineHeight: hintZeile,
      marginTop: 4,
      textAlign: align,
      // Zwei Zeilen sind RESERVIERT, auch wo nur eine steht. Sonst schiebt eine
      // umbrechende Unterzeile („Mit Rezitation & Uebersetzung") ihren Titel
      // nach oben, und in derselben Reihe stehen die Titel auf verschiedenen
      // Hoehen (Bildschirmbefund 2026-08-16). Die Kachel ist unten buendig
      // (`justifyContent: 'flex-end'`), deshalb wirkt sich das direkt aus.
      height: hintZeile * 2,
    },
  });
}
