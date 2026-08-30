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

import { Hintergrund } from '@/components/Hintergrund';
import { ausblendenNach, bedienungGesehen } from '@/lib/bedienungSichtbar';
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
import { appleEinstellungen } from '@/lib/appleEinstellungen';
import { azanLaeuft, azanStoppen, useAzanAusloeser, useAzanLauf, useNativenAdhanPlan } from '@/lib/azanRuf';
import { fernTaste, istFernTaste } from '@/lib/fernfokus';
import { useHintergrundAudio } from '@/lib/hintergrundAudio';
import { useFernFokusKarte } from '@/lib/useFernFokusKarte';
import { useTranslation } from '@/lib/i18n';
import {
  isScreen,
  screenFromLaunchArgument,
  screenFromUrl,
  settingsBereichFromLaunchArgument,
  surahFromLaunchArgument,
  surahFromUrl,
  type Screen,
  type SettingsBereich,
} from '@/lib/nav';
import { onPairCommand, startPairing, stopPairing } from '@/lib/pairing';
import { hydrateHintergrundMedien } from '@/lib/hintergrundMedien';
import { hydrateOfflineAudio, verwaisteEintraegeAufraeumen } from '@/lib/offlineAudio';
import { applyRemoteSettings, useTvSettings } from '@/lib/settings';
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
  // Startbildschirm ist die Uhr. Nur ein Startargument kann daran ruetteln
  // (`-salatiScreen <name>`, s. lib/nav.ts) — es wird schon beim ersten Rendern
  // gelesen, damit die Uhr nicht kurz aufblitzt.
  const [screen, setScreen] = useState<Screen>(
    () => screenFromLaunchArgument(appleEinstellungen()) ?? 'clock',
  );
  const screenRef = useLatestRef(screen);
  // Ziel INNERHALB eines Bildschirms — die Bildschirmfoto-Automatik kam sonst
  // nur bis zur Auswahl (s. lib/nav.ts). Ein Startargument wird einmal beim
  // ersten Rendern gelesen, ein Deep Link kann es spaeter nachziehen.
  const [startSure, setStartSure] = useState<number | null>(() =>
    surahFromLaunchArgument(appleEinstellungen()),
  );
  const [startBereich] = useState<SettingsBereich | null>(() =>
    settingsBereichFromLaunchArgument(appleEinstellungen()),
  );
  const theme = useTheme();
  const { bedienungAusblenden } = useTvSettings();
  // Laeuft im Hintergrund etwas (Rezitation, Radio, Podcast), zeigt die Uhr
  // dafuer einen bedienbaren Streifen. Dann darf eine Richtungstaste dort NICHT
  // mehr blind ins Menue springen — sonst waere der Streifen unerreichbar,
  // obwohl er genau fuer diesen Fall gebaut ist (s. useTVEventHandler unten).
  const { stueck: hintergrundStueck } = useHintergrundAudio();
  const hintergrundLaeuft = hintergrundStueck !== null;
  const hintergrundLaeuftRef = useLatestRef(hintergrundLaeuft);

  // Die Wartezeit steht in den Einstellungen, gezaehlt wird sie neben dem Baum
  // (lib/bedienungSichtbar.ts). Der Bildschirmwechsel gilt als Bedienung: wer
  // gerade irgendwo hingegangen ist, soll dort die Hinweise sehen.
  useEffect(() => {
    ausblendenNach(bedienungAusblenden * 1000);
  }, [bedienungAusblenden]);
  useEffect(() => {
    bedienungGesehen();
  }, [screen]);

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
  // Haelt zusaetzlich den nativen Hintergrund-Alarm aktuell (Android) — feuert
  // auch, wenn der Fernseher gerade nicht auf dieser App steht (s. azanRuf.ts).
  useNativenAdhanPlan();
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
    // Jeder Tastendruck holt die Bedienhinweise zurueck und beginnt die
    // Wartezeit von vorn (s. lib/bedienungSichtbar.ts). Bewusst HIER und nicht
    // je Bildschirm: die Ereignisse kommen nur einmal an, die Antwort wird an
    // vier Stellen gebraucht.
    bedienungGesehen();
    const type = evt.eventType;
    if (type === 'menu') {
      goBack();
      return;
    }
    // Auf der Uhr oeffnet jede Taste das Menue — SOLANGE dort nichts anderes
    // zu bedienen ist. Laeuft eine Rezitation im Hintergrund, traegt die Uhr
    // den Wiedergabe-Streifen; dann muss das Steuerkreuz ihn erreichen koennen
    // (runter zum Streifen, hoch zurueck zur Uhr), und nur „OK" auf der
    // Uhrflaeche selbst oeffnet das Menue. Das erledigt deren `onPress` —
    // deshalb hier gar nichts mehr.
    if (screenRef.current === 'clock' && !hintergrundLaeuftRef.current) {
      if (type === 'select' || type === 'up' || type === 'down' || type === 'left' || type === 'right') {
        setScreen('home');
      }
    }
  });

  // Verzeichnis der gespeicherten Rezitationen laden und dabei aufraeumen:
  // Wer ueber die Systemeinstellungen „Speicher leeren" waehlt, loescht die
  // Dateien, nicht das Verzeichnis — ohne diesen Durchgang staende dort
  // „gespeichert", und die Wiedergabe liefe stumm auf eine Datei, die es nicht
  // mehr gibt.
  useEffect(() => {
    void hydrateOfflineAudio().then(() => verwaisteEintraegeAufraeumen());
    // Dasselbe fuer die Hintergrund-Motive: auch sie liegen als Dateien im
    // Dokumentverzeichnis (s. lib/hintergrundMedien.ts).
    void hydrateHintergrundMedien();
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
      } else if (cmd.t === 'key' && istFernTaste(cmd.dir)) {
        // Steuerkreuz und OK des Handys (Nutzerbefund 2026-08-30: vier der
        // sechs Tasten waren wirkungslos). Der Fokus wird ueber das
        // Verzeichnis bewegt, nicht ueber die Plattform — s. lib/fernfokus.ts.
        //
        // Die Uhr ist der einzige Sonderfall, und aus demselben Grund wie beim
        // `useTVEventHandler` oben: solange dort nichts zu bedienen ist,
        // oeffnet jede Taste das Menue.
        if (screenRef.current === 'clock' && !hintergrundLaeuftRef.current) {
          setScreen('home');
        } else {
          void fernTaste(cmd.dir);
        }
      }
    });
    return () => {
      off();
      stopPairing();
    };
  }, [goBack, screenRef, hintergrundLaeuftRef]);

  // Deep Links: `salatitv://screen/<name>` schaltet um. Das ist dieselbe
  // Umschaltung wie ueber die Handy-Fernbedienung, nur ueber den Weg, den das
  // Betriebssystem selbst mitbringt — damit laesst sich der Fernseher von aussen
  // auf einen Bildschirm stellen, ohne dass jemand die Fernbedienung in der Hand
  // hat. Genau das braucht die Bildschirmfoto-Automatik fuer den App Store
  // (`xcrun simctl openurl`) und der Emulator-Lauf unter Android (`adb`).
  useEffect(() => {
    const anwenden = (url: string | null) => {
      const s = screenFromUrl(url);
      if (!s) return;
      setStartSure(surahFromUrl(url));
      setScreen(s);
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
      {/* Liegt EINMAL hinter allen Bildschirmen. Vor der eingeblendeten
          Flaeche, damit der Wechsel darueber laeuft und der Hintergrund
          dabei stehen bleibt. */}
      <Hintergrund screen={screen} />
      <Animated.View style={[styles.fill, { opacity: fade, transform: [{ translateY: rutsch }] }]}>
      {screen === 'clock' && <UhrFlaeche onOeffnen={() => setScreen('home')} />}
      {screen === 'home' && <HomeScreen navigate={navigate} />}
      {screen === 'videos' && <VideosScreen />}
      {screen === 'reciters' && <RecitersScreen />}
      {screen === 'quran' && <QuranReaderScreen startSurah={startSure} />}
      {screen === 'radio' && <RadioScreen />}
      {screen === 'reels' && <ReelsScreen />}
      {screen === 'podcasts' && <PodcastsScreen />}
      {screen === 'settings' && <SettingsScreen startBereich={startBereich} />}
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
 * Die Uhr als fokussierbare Flaeche.
 *
 * Fokussierbar + Initialfokus: auf dem TV muss ein Element den Fokus halten,
 * sonst erreichen Fernbedienungs-Tasten (OK/DPAD) das `onPress` NICHT — sonst
 * haengt der Nutzer auf der Uhr fest (Geraetetest-Fund 2026-07-24).
 *
 * Sie meldet sich zusaetzlich beim Fokus-Verzeichnis an (lib/fernfokus.ts),
 * damit das Steuerkreuz des HANDYS zwischen ihr und dem Wiedergabe-Streifen
 * wechseln kann. Ohne diese Anmeldung fuehrte „runter" in den Streifen und
 * „hoch" nirgendwohin zurueck.
 */
function UhrFlaeche({ onOeffnen }: { onOeffnen: () => void }) {
  const { setzeRef, beiLayout, beiFokus, beiFokusVerlust } = useFernFokusKarte(onOeffnen);
  return (
    <Pressable
      ref={setzeRef}
      focusable
      hasTVPreferredFocus
      style={styles.fill}
      onLayout={beiLayout}
      onFocus={beiFokus}
      onBlur={beiFokusVerlust}
      onPress={onOeffnen}>
      <ClockScreen />
    </Pressable>
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
