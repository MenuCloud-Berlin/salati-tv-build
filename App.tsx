import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useTVEventHandler,
  useWindowDimensions,
  View,
} from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';

import { ClockScreen } from '@/screens/ClockScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { PairingScreen } from '@/screens/PairingScreen';
import { PodcastsScreen } from '@/screens/PodcastsScreen';
import { QuizScreen } from '@/screens/QuizScreen';
import { QuranReaderScreen } from '@/screens/QuranReaderScreen';
import { RadioScreen } from '@/screens/RadioScreen';
import { RecitersScreen } from '@/screens/RecitersScreen';
import { ReelsScreen } from '@/screens/ReelsScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { VideosScreen } from '@/screens/VideosScreen';
import { azanLaeuft, azanStoppen, useAzanAusloeser, useAzanLauf } from '@/lib/azanRuf';
import { useTranslation } from '@/lib/i18n';
import { isScreen, screenFromUrl, type Screen } from '@/lib/nav';
import { onPairCommand, startPairing, stopPairing } from '@/lib/pairing';
import { hydrateOfflineAudio, verwaisteEintraegeAufraeumen } from '@/lib/offlineAudio';
import { applyRemoteSettings } from '@/lib/settings';
import { useTheme } from '@/lib/useTheme';
import { useLatestRef } from '@/lib/useLatestRef';

// Root + Navigation der Salati-TV-App. Clock ist Default/Screensaver; jede Taste
// öffnet den Home-Hub. Zurück (Fire-TV-Menu / Android-Back) führt Screen → Home
// → Clock. Am Clock — der Wurzel der App — gibt `goBack()` das Ereignis ans
// System zurück, die App schließt also wie jede andere Android-TV-App zum
// Launcher; das ist das erwartete Verhalten und die einzige Stelle, an der Back
// die App verlässt. (Der Kommentar behauptete hier bis zum Audit 2026-07-29 das
// Gegenteil des Codes.) Fokus/D-Pad steuert react-native-tvos automatisch
// zwischen den Pressables.
export default function App() {
  useKeepAwake();
  const [screen, setScreen] = useState<Screen>('clock');
  const screenRef = useLatestRef(screen);
  const theme = useTheme();

  // Sanfter Uebergang bei jedem Screen-Wechsel (ruhiger als der harte Swap):
  // Einblenden PLUS ein kurzer Weg von unten nach oben. Der reine Cross-Fade
  // liess jeden Wechsel gleich aussehen, egal ob man tiefer ging oder zurueck;
  // die kleine Bewegung gibt dem Wechsel eine Richtung, ohne aufdringlich zu
  // sein (220 ms, ausklingend).
  // Die Werte werden EINMAL erzeugt (useState-Initialisierer) statt ueber
  // `useRef(...).current` — letzteres liest einen Ref waehrend des Renderns.
  const [fade] = useState(() => new Animated.Value(1));
  const [rutsch] = useState(() => new Animated.Value(0));
  useEffect(() => {
    fade.setValue(0);
    rutsch.setValue(14);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(rutsch, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [screen, fade, rutsch]);

  // Gebetsruf: der Ausloeser laeuft app-weit, nicht je Bildschirm — der Ruf
  // soll auch erklingen, wenn gerade der Koran-Leser offen ist.
  useAzanAusloeser();
  const azanLauf = useAzanLauf();

  const navigate = useCallback((s: Screen) => setScreen(s), []);
  const goBack = useCallback((): boolean => {
    // Laeuft ein Gebetsruf, beendet ihn die Zurueck-Taste — und NUR ihn. Das
    // ist die einzige Taste, die ihn stoppen kann, ohne die Bedienung sonst zu
    // stoeren: „OK" wuerde zugleich die gerade fokussierte Kachel ausloesen,
    // und ein Knopf, der den Fokus an sich zieht, risse den Nutzer aus dem
    // Bildschirm, in dem er steht.
    if (azanLaeuft()) {
      azanStoppen();
      return true;
    }
    const cur = screenRef.current;
    if (cur === 'clock') return false; // nichts zu tun (App darf schließen)
    setScreen(cur === 'home' ? 'clock' : 'home');
    return true;
  }, [screenRef]);

  // Fire-TV-Fernbedienung: Menu-Taste = zurück. Am Clock: jede Taste → Home.
  useTVEventHandler((evt) => {
    if (!evt) return;
    const type = evt.eventType;
    if (type === 'menu') {
      goBack();
      return;
    }
    if (
      screenRef.current === 'clock' &&
      (type === 'select' || type === 'up' || type === 'down' || type === 'left' || type === 'right')
    ) {
      setScreen('home');
    }
  });

  // Verzeichnis der gespeicherten Rezitationen laden und dabei aufraeumen:
  // Wer ueber die Systemeinstellungen „Speicher leeren" waehlt, loescht die
  // Dateien, nicht das Verzeichnis — ohne diesen Durchgang staende dort
  // „gespeichert", und die Wiedergabe liefe stumm auf eine Datei, die es nicht
  // mehr gibt.
  useEffect(() => {
    void hydrateOfflineAudio().then(() => verwaisteEintraegeAufraeumen());
  }, []);

  // Android-TV-Hardware-Back: zurück statt App beenden (außer am Clock).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => goBack());
    return () => sub.remove();
  }, [goBack]);

  // LAN-Pairing app-weit: Server für die gesamte App-Laufzeit starten, damit das
  // Handy jederzeit verbinden kann. Fernbedienungs-Kommandos vom Handy auf die
  // Navigation abbilden ('nav' = Screen wählen, 'key' back/select).
  useEffect(() => {
    void startPairing();
    const off = onPairCommand((cmd) => {
      // `isScreen` statt `as Screen` (Audit 2026-07-28, T14): ein unbekannter
      // Name liesse den Fernseher schwarz und ohne Fokus-Anker zurueck.
      if (cmd.t === 'einstellungen') {
        // Rechenparameter des Handys uebernehmen, damit Fernseher und Handy
        // ohne doppelte Handeingabe dieselben Gebetszeiten zeigen.
        applyRemoteSettings(cmd);
      } else if (cmd.t === 'nav' && isScreen(cmd.screen)) {
        setScreen(cmd.screen);
      } else if (cmd.t === 'key' && cmd.dir === 'back') {
        goBack();
      } else if (cmd.t === 'key' && cmd.dir === 'select' && screenRef.current === 'clock') {
        setScreen('home');
      }
    });
    return () => {
      off();
      stopPairing();
    };
  }, [goBack, screenRef]);

  // Deep Links: `salatitv://screen/<name>` schaltet um. Das ist dieselbe
  // Umschaltung wie ueber die Handy-Fernbedienung, nur ueber den Weg, den das
  // Betriebssystem selbst mitbringt — damit laesst sich der Fernseher von aussen
  // auf einen Bildschirm stellen, ohne dass jemand die Fernbedienung in der Hand
  // hat. Genau das braucht die Bildschirmfoto-Automatik fuer den App Store
  // (`xcrun simctl openurl`) und der Emulator-Lauf unter Android (`adb`).
  useEffect(() => {
    const anwenden = (url: string | null) => {
      const s = screenFromUrl(url);
      if (s) setScreen(s);
    };
    void Linking.getInitialURL().then(anwenden).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => anwenden(url));
    return () => sub.remove();
  }, []);

  // Der Wurzel-Hintergrund traegt die Themenfarbe: waehrend des Einblendens
  // ist der neue Screen noch halbtransparent, und darunter darf nicht das alte
  // Schwarz durchscheinen (auf dem hellen Thema waere das ein dunkler Blitz).
  const wurzel = useMemo(() => [styles.root, { backgroundColor: theme.bg }], [theme]);

  return (
    <View style={wurzel}>
      <StatusBar hidden />
      <Animated.View style={[styles.fill, { opacity: fade, transform: [{ translateY: rutsch }] }]}>
      {screen === 'clock' && (
        // Fokussierbar + Initialfokus: auf dem TV muss ein Element den Fokus
        // halten, sonst erreichen Fernbedienungs-Tasten (OK/DPAD) das onPress
        // NICHT — sonst hängt der Nutzer auf der Uhr fest (Gerätetest-Fund
        // 2026-07-24). Mit Fokus öffnet OK das Menü; zusätzlich schaltet der
        // useTVEventHandler oben bei jeder Richtungstaste auf Home.
        <Pressable
          focusable
          hasTVPreferredFocus
          style={styles.fill}
          onPress={() => setScreen('home')}>
          <ClockScreen />
        </Pressable>
      )}
      {screen === 'home' && <HomeScreen navigate={navigate} />}
      {screen === 'videos' && <VideosScreen />}
      {screen === 'reciters' && <RecitersScreen />}
      {screen === 'quran' && <QuranReaderScreen />}
      {screen === 'radio' && <RadioScreen />}
      {screen === 'reels' && <ReelsScreen />}
      {screen === 'podcasts' && <PodcastsScreen />}
      {screen === 'settings' && <SettingsScreen />}
      {screen === 'pairing' && <PairingScreen />}
      {screen === 'quiz' && <QuizScreen />}
      </Animated.View>
      {/* Ueber allem, aber NICHT fokussierbar: der Ruf soll nicht den Fokus
          uebernehmen. Der Hinweis nennt die Taste, die ihn beendet. */}
      {azanLauf ? <AzanBanner prayer={azanLauf.prayer} /> : null}
    </View>
  );
}

/**
 * Hinweis waehrend des Gebetsrufs.
 *
 * `pointerEvents="none"` und kein `focusable`: der Streifen darf die Bedienung
 * nicht anfassen. Er sagt, welches Gebet ruft und welche Taste ihn beendet —
 * mehr nicht. Wer ihn wegdrueckt, ist danach genau dort, wo er vorher war.
 */
function AzanBanner({ prayer }: { prayer: string }) {
  const { t, rtl } = useTranslation();
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const s = useMemo(() => {
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    return StyleSheet.create({
      wrap: {
        position: 'absolute',
        top: clamp(height * 0.04, 16, 48),
        alignSelf: 'center',
        maxWidth: width * 0.7,
        paddingHorizontal: clamp(width * 0.022, 16, 40),
        paddingVertical: clamp(height * 0.018, 10, 22),
        borderRadius: clamp(height * 0.02, 12, 24),
        borderWidth: 2,
        borderColor: theme.accent,
        // UNDURCHSICHTIG, und zwar in zwei Lagen: alle Karten-Farben des
        // Themas sind halbdurchsichtig (sie liegen sonst auf dem Grund und
        // muessen ihn durchscheinen lassen). Der Streifen schwebt aber ueber
        // dem Inhalt — mit `cardActive` allein stand der Bildschirm-Text mitten
        // im Hinweis und beide waren unlesbar (Geraetebefund 2026-08-08).
        // Deshalb: Grundfarbe deckend, goldener Schimmer als eigene Lage.
        backgroundColor: theme.bg,
        alignItems: 'center',
        gap: 4,
        overflow: 'hidden',
      },
      schimmer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: theme.cardActive },
      titel: {
        color: theme.accent,
        fontSize: clamp(height * 0.034, 18, 30),
        fontWeight: '800',
        textAlign: 'center',
        writingDirection: rtl ? 'rtl' : 'ltr',
      },
      hinweis: { color: theme.textMuted, fontSize: clamp(height * 0.022, 12, 19), textAlign: 'center' },
    });
  }, [width, height, rtl, theme]);

  return (
    <View style={s.wrap} pointerEvents="none">
      <View style={s.schimmer} />
      <Text style={s.titel}>{t('azan.running', { prayer: t(`prayers.${prayer}`) })}</Text>
      <Text style={s.hinweis}>{t('azan.runningHint')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
});
