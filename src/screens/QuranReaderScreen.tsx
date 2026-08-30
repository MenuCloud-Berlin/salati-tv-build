import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  type LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { AmbientGlow } from '@/components/AmbientGlow';
import { FocusCard } from '@/components/FocusCard';
import { fokusUeberstand } from '@/components/fokusUeberstand';
import { useBedienungSichtbar } from '@/lib/bedienungSichtbar';
import { StateView } from '@/components/StateView';
import { SURAHS } from '@/data/surahs';
import { useTranslation } from '@/lib/i18n';
import { activeWordIndex, type ReaderVerse } from '@/lib/quranText';
import { spielerHolen, umschalten, useHintergrundAudio } from '@/lib/hintergrundAudio';
import {
  nochmalVersuchen,
  sureOeffnen,
  useLeseSitzung,
  versSpringen,
  wiederholenUmschalten,
} from '@/lib/leseSitzung';
import { toggleReaderOption, useTvSettings } from '@/lib/settings';
import type { Theme } from '@/lib/theme';
import {
  abschnittVonWort,
  textAbschnitte,
  textFaktor,
  versLayout,
  type Abschnitt,
} from '@/lib/versSeiten';
import { useQuranFont, type QuranFontResult } from '@/lib/useQuranFont';
import { useTheme } from '@/lib/useTheme';
import { useLatestRef } from '@/lib/useLatestRef';

// Koran-Reader für den TV: großer Untertitel-Look. Rezitation Vers für Vers mit
// live markiertem Wort (Wort-Zeitstempel von quran.com), arabischer Text +
// lateinische Umschrift + Übersetzung in der Oberflächensprache.
//
// Ausbau 2026-08-08 — bis 1.3.0 war dieser Bereich gegenüber der Handy-App
// deutlich zurück:
//   • Der arabische Text lief in der SYSTEMSCHRIFT des Fernsehers. Welche das
//     ist, entscheidet die Firmware; auf Fire-TV-Geräten ist es regelmäßig eine
//     Schrift ohne die gestapelten Koran-Zeichen. Jetzt dieselben acht Schriften
//     wie auf dem Handy, inklusive der KFGQPC-Textumschreibung (`adaptQuranText`)
//     und der Sukūn-Einstellung.
//   • Schriftgrad, Umschrift und Übersetzung waren fest verdrahtet.
//   • Es gab KEINE Bedienung außer Play/Pause: kein Vers zurück, kein
//     Wiederholen — wer einen Vers noch einmal hören wollte, musste die Sure neu
//     beginnen.
//   • Die Suren-Auswahl war ein Raster mit 114 Kacheln; bis Sure 100 sind das
//     rund 25 Mal DPAD_DOWN.
export function QuranReaderScreen({ startSurah }: { startSurah?: number | null } = {}) {
  const { locale } = useTranslation();
  const sitzung = useLeseSitzung();
  // Laeuft schon eine Lesung (sie ueberlebt seit 2026-08-30 den
  // Bildschirmwechsel, s. lib/leseSitzung.ts), fuehrt der Leser sie fort statt
  // in der Suren-Auswahl zu landen. Mit vorgegebener Sure — Startargument oder
  // Deep Link — beginnt er unmittelbar beim Lesen.
  const [stage, setStage] = useState<'picker' | 'reading'>(
    startSurah || sitzung.aktiv ? 'reading' : 'picker',
  );
  const { height, width } = useWindowDimensions();

  // Die Sure des Startarguments EINMAL oeffnen — im Effekt, nicht im Rumpf:
  // `sureOeffnen` startet einen Abruf und eine Wiedergabe, beides gehoert
  // nicht ins Rendern. Danach fuehrt die Sitzung.
  const startRef = useLatestRef(startSurah);
  const spracheRef = useLatestRef(locale);
  useEffect(() => {
    const n = startRef.current;
    if (n) sureOeffnen(n, spracheRef.current);
  }, [startRef, spracheRef]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stage === 'reading') {
        setStage('picker');
        return true;
      }
      return false; // Picker: App-Root verlässt den Bereich
    });
    return () => sub.remove();
  }, [stage]);

  if (stage === 'picker') {
    return (
      <SurahPicker
        onPick={(n) => {
          sureOeffnen(n, locale);
          setStage('reading');
        }}
        height={height}
        width={width}
      />
    );
  }
  return <Reader height={height} width={width} />;
}

/** Zwanzig Suren je Block — eine Bildschirmseite, die ohne Scrollen erfassbar
 *  ist, und sechs Blöcke, die in eine Zeile passen. */
const BLOCK = 20;
const BLOCK_STARTS = [1, 21, 41, 61, 81, 101];

function SurahPicker({
  onPick,
  height,
  width,
}: {
  onPick: (n: number) => void;
  height: number;
  width: number;
}) {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const padH = clamp(width * 0.045, 28, 80);
  const gap = clamp(width * 0.014, 12, 22);
  const cols = width >= 1400 ? 5 : 4;
  const cardW = Math.floor((width - padH * 2 - gap * (cols - 1)) / cols) - 1;
  const { t, rtl } = useTranslation();
  const theme = useTheme();
  const arab = useQuranFont();
  // Der Block wird beim Aufbau festgelegt und danach vom Nutzer gewechselt;
  // die Auswahl selbst bleibt beim Verlassen NICHT erhalten — der Leser kommt
  // ueblicherweise an einer anderen Sure heraus, als er begonnen hat.
  const [blockStart, setBlockStart] = useState(1);
  const s = useMemo(() => pickerStyles(height, padH, gap, cardW, rtl, theme), [height, padH, gap, cardW, rtl, theme]);
  const sichtbar = SURAHS.filter((x) => x.n >= blockStart && x.n < blockStart + BLOCK);

  return (
    <View style={s.root}>
      <Text style={s.title}>{t('home.quran')}</Text>
      <Text style={s.sub}>{t('reader.pickerSubtitle')}</Text>

      {/* Sprungleiste: ohne sie sind es bis Sure 100 rund 25 Mal DPAD_DOWN. */}
      <View style={s.blockRow}>
        {BLOCK_STARTS.map((start, i) => {
          const bis = Math.min(start + BLOCK - 1, 114);
          const aktiv = start === blockStart;
          return (
            <FocusCard
              key={start}
              hasTVPreferredFocus={i === 0}
              onPress={() => setBlockStart(start)}
              style={[s.blockCard, aktiv && s.activeCard]}>
              <Text style={[s.blockLabel, aktiv && s.activeText]}>
                {start}–{bis}
              </Text>
            </FocusCard>
          );
        })}
      </View>

      <ScrollView style={s.gridScroll} contentContainerStyle={s.grid} showsVerticalScrollIndicator={false}>
        {sichtbar.map((sur) => (
          <FocusCard key={sur.n} onPress={() => onPick(sur.n)} style={s.card}>
            <Text style={s.num}>{sur.n}</Text>
            <Text style={s.name} numberOfLines={1}>{sur.en}</Text>
            {/* Auch der Suren-Name ist arabische Schrift und bekommt deshalb
                dieselbe gewaehlte Koran-Schrift wie der Vers. */}
            <Text style={[s.ar, arab.style]} numberOfLines={1}>{arab.text(sur.ar)}</Text>
          </FocusCard>
        ))}
      </ScrollView>
    </View>
  );
}

function Reader({ height, width }: { height: number; width: number }) {
  const { t, rtl } = useTranslation();
  const theme = useTheme();
  const { readerScale, readerTranslit, readerTranslation } = useTvSettings();
  const arab = useQuranFont();
  const bedienungSichtbar = useBedienungSichtbar();
  // Verse, Vers-Index, Wiederholen und das Weiterschalten liegen seit
  // 2026-08-30 in lib/leseSitzung.ts — NEBEN dem Baum, damit die Rezitation
  // den Wechsel zur Gebetsuhr ueberlebt. Dieser Bildschirm ist ihre
  // Oberflaeche, nicht ihr Besitzer.
  const { verses, idx, wiederholen, laedt, fehler, quelle, surah } = useLeseSitzung();
  const [posMs, setPosMs] = useState(0);
  const { spielt: playing } = useHintergrundAudio();

  const current = verses?.[idx];

  // Position pollen (Wort-Sync). 80ms — Wort-Segmente sind teils <500ms.
  // Gefragt wird der gemeinsame Spieler; er kann zwischendurch ausgetauscht
  // werden (naechster Vers), deshalb bei jedem Takt neu holen.
  useEffect(() => {
    const id = setInterval(() => {
      const p = spielerHolen();
      setPosMs(Math.round((p?.currentTime ?? 0) * 1000));
    }, 80);
    return () => clearInterval(id);
  }, []);

  const toggle = umschalten;
  const springe = (delta: number) => versSpringen(delta);

  // Die Buehne misst sich selbst, statt aus der Bildschirmhoehe geschaetzt zu
  // werden: zwischen Kopfzeile, Bedienleiste und Hinweiszeile bleibt je nach
  // Sprache und Panel unterschiedlich viel uebrig, und um genau diesen Rest
  // geht es bei der Frage, wie viel Vers auf den Schirm passt.
  const [buehne, setBuehne] = useState({ w: 0, h: 0 });
  const misstBuehne = useCallback((e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setBuehne((alt) => (Math.abs(alt.w - w) < 1 && Math.abs(alt.h - h) < 1 ? alt : { w, h }));
  }, []);

  const s = useMemo(
    () => readerStyles(height, width, rtl, theme, readerScale),
    [height, width, rtl, theme, readerScale],
  );
  const meta = SURAHS.find((x) => x.n === surah);
  const activeWord = current ? activeWordIndex(current.segments, posMs) : -1;

  // Wie viel Hoehe der Vers bekommt und wie viel seine Begleitzeilen. Ohne
  // Umschrift und Uebersetzung gehoert die Buehne ganz dem Vers; mit beiden
  // bekommt er die Haelfte. Feste Anteile statt `flex`, weil nur mit einer
  // bekannten Hoehe gerechnet werden kann, wie viele Zeilen hineinpassen.
  const zeigtTranslit = readerTranslit;
  const zeigtUebersetzung = readerTranslation && !!current?.translation;
  const zusatz = (zeigtTranslit ? 1 : 0) + (zeigtUebersetzung ? 1 : 0);
  // Die Begleitzeilen brauchen selten mehr als zwei Zeilen — ein Fuenftel der
  // Buehne je Zeile reicht. Der Vers bekommt den Rest: gaebe man ihm nur die
  // Haelfte, muesste schon ein gewoehnlicher Vers geblaettert werden.
  const arabAnteil = zusatz === 0 ? 1 : zusatz === 1 ? 0.78 : 0.6;
  // `onLayout` misst die Flaeche MIT Polster; gerechnet wird mit dem Inneren.
  // Zwischen Vers, Umschrift und Uebersetzung bleibt eine Luecke: ohne sie
  // stossen sie aneinander, sobald eine der Zeilen ihren Kasten fuellt
  // (Geraetebefund 2026-08-16 an An-Nisaa, Vers 1).
  const innen = Math.max(0, buehne.h - s.buehnenPolster * 2 - s.zeilenLuecke * zusatz);
  const arabH = innen * arabAnteil;
  const zusatzH = zusatz > 0 ? (innen - arabH) / zusatz : 0;

  const layout = useMemo(
    () =>
      versLayout({
        woerter: current?.words.map((w) => w.ar) ?? [],
        breite: buehne.w,
        hoehe: arabH,
        fontSize: s.arabischGroesse,
        lineHeight: s.arabischZeile,
      }),
    [current, buehne.w, arabH, s.arabischGroesse, s.arabischZeile],
  );
  const abschnitte: Abschnitt[] = layout.abschnitte;

  // Welcher Abschnitt zu sehen ist: normalerweise der, in dem die Rezitation
  // gerade steht. Wer von Hand blaettert, uebernimmt — bis die Rezitation den
  // Abschnitt von selbst wechselt, dann fuehrt wieder sie.
  const autoAbschnitt = abschnittVonWort(abschnitte, activeWord);
  const [manuell, setManuell] = useState<number | null>(null);
  const [letzterAuto, setLetzterAuto] = useState(autoAbschnitt);
  if (letzterAuto !== autoAbschnitt) {
    setLetzterAuto(autoAbschnitt);
    setManuell(null);
  }
  const abschnittIdx = Math.min(manuell ?? autoAbschnitt, abschnitte.length - 1);
  const sichtbareWorte = abschnitte[abschnittIdx] ?? [];

  // Blaettern statt Verswechsel, solange der Vers noch Abschnitte hat. Damit
  // erreicht die Fernbedienung jedes Wort auch dann, wenn der Text ohne
  // Zeitstempel kommt (mitgeliefertes Paket) und von selbst nichts blaettert.
  const weiter = (delta: number) => {
    const ziel = abschnittIdx + delta;
    if (ziel >= 0 && ziel < abschnitte.length) {
      setManuell(ziel);
      return;
    }
    springe(delta);
  };

  // Wer von Hand blaettert, nimmt die Rezitation mit: sonst liefe der markierte
  // Wortlaut in einem Abschnitt weiter, den man gerade nicht sieht — und
  // schaltete den Blick eine Sekunde spaeter wieder dorthin zurueck.
  const abschnitteRef = useLatestRef(abschnitte);
  const segmenteRef = useLatestRef(current?.segments);
  useEffect(() => {
    if (manuell === null) return;
    const erstes = abschnitteRef.current[manuell]?.[0];
    if (erstes === undefined) return;
    const seg = segmenteRef.current?.find((sg) => sg[0] === erstes);
    if (!seg) return; // Text ohne Zeitstempel (mitgeliefertes Paket)
    const p = spielerHolen();
    if (!p) return;
    try {
      // `seekBy` statt `currentTime = …`: eine Zuweisung an den Spieler gilt
      // als Aenderung eines Hook-Ergebnisses (react-hooks/immutability), der
      // Sprung selbst ist eine Methode und damit erlaubt.
      p.seekBy(seg[2] / 1000 - (p.currentTime ?? 0));
    } catch {
      /* ignore */
    }
  }, [manuell, abschnitteRef, segmenteRef]);

  const translitText = zeigtTranslit
    ? sichtbareWorte.map((i) => current?.words[i]?.translit ?? '').join(' ').trim()
    : '';
  // Die Uebersetzung wird der Laenge nach auf dieselbe Zahl Abschnitte verteilt
  // (s. lib/versSeiten.ts) — ungefaehr passend statt abgeschnitten.
  const uebersetzungText = zeigtUebersetzung
    ? (textAbschnitte(current?.translation ?? '', abschnitte.length)[abschnittIdx] ?? '')
    : '';
  const translitFaktor = textFaktor({
    text: translitText,
    breite: buehne.w,
    hoehe: zusatzH,
    fontSize: s.translitGroesse,
    lineHeight: s.translitGroesse * 1.35,
  });
  const uebersetzungFaktor = textFaktor({
    text: uebersetzungText,
    breite: buehne.w,
    hoehe: zusatzH,
    fontSize: s.uebersetzungGroesse,
    lineHeight: s.uebersetzungZeile,
  });

  // Audit 2026-07-28: Fehler- und Ladezustand des Lesers hatten KEIN
  // fokussierbares Element — auf Android TV fand die Fernbedienung dort keinen
  // Anker. Zudem war der Fehler endgueltig, obwohl der Abruf ueber drei
  // quran.com-Endpunkte laeuft und einzelne davon oft nur kurz haengen.
  if (fehler) {
    return <StateView messageKey="reader.loadError" onAction={nochmalVersuchen} />;
  }
  if (laedt || !verses || !current) {
    return <StateView loading onAction={nochmalVersuchen} />;
  }

  return (
    <View style={s.root}>
      {/* Ruhiger Lichtschein — als echter Verlauf, nicht als runde Flaeche:
          die zeigte am Fernseher zwei klar umrissene Scheiben (s. AmbientGlow). */}
      <AmbientGlow color={theme.accent} size={Math.min(width, height) * 1.1} top={-height * 0.3} left={-width * 0.12} />
      <AmbientGlow color={theme.glowRing} size={Math.min(width, height) * 1.2} bottom={-height * 0.35} right={-width * 0.12} intensity={0.12} />

      <View style={s.header}>
        <Text style={s.surahName} numberOfLines={1}>
          {surah}. {meta?.en ?? ''} · <Text style={arab.style}>{arab.text(meta?.ar ?? '')}</Text>
        </Text>
        <Text style={s.verseNo}>
          {t('reader.verseOf', { n: current.n, total: verses.length })}
          {abschnitte.length > 1
            ? ` · ${t('reader.sectionOf', { n: abschnittIdx + 1, total: abschnitte.length })}`
            : ''}
        </Text>
      </View>

      <View testID="reader-buehne" style={s.stage} onLayout={misstBuehne}>
        <View style={[s.arabBox, { height: arabH || undefined }]}>
          <ArabicVerse
            verse={current}
            woerter={sichtbareWorte}
            activeWord={activeWord}
            arab={arab}
            styles={s}
            faktor={layout.faktor}
          />
        </View>
        {zeigtTranslit ? (
          <View style={[s.zusatzBox, { height: zusatzH || undefined }]}>
            <Text
              style={[
                s.translit,
                {
                  fontSize: s.translitGroesse * translitFaktor,
                  lineHeight: s.translitGroesse * 1.35 * translitFaktor,
                },
              ]}>
              {translitText}
            </Text>
          </View>
        ) : null}
        {zeigtUebersetzung ? (
          <View style={[s.zusatzBox, { height: zusatzH || undefined }]}>
            <Text
              style={[
                s.translation,
                {
                  fontSize: s.uebersetzungGroesse * uebersetzungFaktor,
                  lineHeight: s.uebersetzungZeile * uebersetzungFaktor,
                },
              ]}>
              {uebersetzungText}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Bedienleiste. Vorher war die gesamte Versflaeche EIN Knopf (Play/Pause)
          und es gab sonst nichts — kein Zurueck zum vorigen Vers, kein
          Wiederholen. Der Initialfokus liegt auf Play/Pause, weil das die
          Taste ist, die man im Sitzen zuerst sucht. */}
      <View style={[s.controls, !bedienungSichtbar && s.verborgen]}>
        <FocusCard onPress={() => weiter(-1)} style={s.ctrl}>
          <Text style={s.ctrlGlyph}>⏮</Text>
        </FocusCard>
        <FocusCard hasTVPreferredFocus onPress={toggle} style={s.ctrlWide}>
          <Text style={s.ctrlGlyph}>{playing ? '❚❚' : '▶'}</Text>
        </FocusCard>
        <FocusCard onPress={() => weiter(1)} style={s.ctrl}>
          <Text style={s.ctrlGlyph}>⏭</Text>
        </FocusCard>
        <FocusCard
          onPress={wiederholenUmschalten}
          style={[s.ctrl, wiederholen && s.ctrlActive]}>
          <Text style={[s.ctrlGlyph, wiederholen && s.ctrlActiveText]}>↻</Text>
        </FocusCard>

        {/* Umschrift und Uebersetzung sind auch in den Einstellungen zu finden.
            Hier stehen sie zusaetzlich, weil sich beim LESEN entscheidet, ob man
            sie braucht — und der Weg dorthin sonst durch zwei Bildschirme und
            zurueck fuehrt, mit verlorener Sure am Ende. Beschriftet statt
            als Zeichen: „Aa" versteht auf drei Meter Abstand niemand. */}
        <FocusCard
          onPress={() => toggleReaderOption('readerTranslit')}
          style={[s.ctrlPille, readerTranslit && s.ctrlActive]}>
          <Text
            style={[s.ctrlLabel, readerTranslit && s.ctrlActiveText]}
            numberOfLines={1}>
            {t('settings.readerTranslit')}
          </Text>
        </FocusCard>
        <FocusCard
          onPress={() => toggleReaderOption('readerTranslation')}
          style={[s.ctrlPille, readerTranslation && s.ctrlActive]}>
          <Text
            style={[s.ctrlLabel, readerTranslation && s.ctrlActiveText]}
            numberOfLines={1}>
            {t('settings.readerTranslation')}
          </Text>
        </FocusCard>
      </View>

      <Text style={[s.hint, !bedienungSichtbar && s.verborgen]} numberOfLines={1}>
        {quelle === 'paket'
          ? t('common.offlineReaderPaket')
          : quelle === 'ablage'
            ? t('common.offlineReader')
            : wiederholen
              ? t('reader.repeatOn')
              : abschnitte.length > 1
                ? t('reader.sectionHint')
                : t('reader.controlHint')}
      </Text>
    </View>
  );
}

/**
 * Der arabische Vers, Wort für Wort.
 *
 * Eigene Komponente, weil hier zwei Dinge zusammenkommen, die nichts
 * miteinander zu tun haben: die Wort-Markierung (Zeitstempel) und die
 * Schrift-Umschreibung (`arab.text`). Jedes Wort läuft EINZELN durch die
 * Umschreibung — den ganzen Vers auf einmal umzuschreiben und dann zu
 * zerlegen, würde an den Stellen falsch trennen, an denen die KFGQPC-Ausgabe
 * ein Zeichen ersetzt.
 */
function ArabicVerse({
  verse,
  woerter,
  activeWord,
  arab,
  styles,
  faktor,
}: {
  verse: ReaderVerse;
  /** Indizes der Woerter, die dieser Abschnitt zeigt. Leer = alle. */
  woerter: readonly number[];
  activeWord: number;
  arab: QuranFontResult;
  styles: ReturnType<typeof readerStyles>;
  faktor: number;
}) {
  const idx = woerter.length > 0 ? woerter : verse.words.map((_, i) => i);
  const fontSize = styles.arabischGroesse * faktor;
  // Der Wortabstand ist ein RAND, kein Leerzeichen.
  //
  // Bis 1.9.0 stand hinter jedem Wort ein `{' '}`. Auf Android ergab das
  // sichtbare Luecken, auf tvOS NICHT: dort verschluckt die Textzeile das
  // abschliessende Leerzeichen, und der ganze Vers lief in einem Zug zusammen
  // („يَـٰٓأَيُّهَاٱلنَّاسُٱتَّقُوا۟"). Aufgefallen erst am Bildschirmfoto fuer
  // den App Store (2026-08-16). Ein Rand haengt an keiner Textregel und wirkt
  // auf beiden Plattformen gleich.
  const groesse = {
    fontSize,
    lineHeight: styles.arabischZeile * faktor,
    marginHorizontal: fontSize * 0.09,
  };
  return (
    <View style={styles.arabicRow}>
      {idx.map((wi) => (
        <Text
          key={wi}
          style={[styles.arabic, arab.style, groesse, wi === activeWord && styles.arabicActive]}>
          {arab.text(verse.words[wi]?.ar ?? '')}
        </Text>
      ))}
    </View>
  );
}

function pickerStyles(h: number, padH: number, gap: number, cardW: number, rtl: boolean, theme: Theme) {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const cardH = clamp(h * 0.2, 96, 140);
  // Sonst fehlt der ersten und letzten Kachel jeder Reihe ein Stueck des
  // goldenen Rahmens (s. components/fokusUeberstand.ts).
  const ueber = fokusUeberstand(Math.max(cardW, cardH));
  return StyleSheet.create({
    root: { flex: 1, paddingHorizontal: padH, paddingTop: clamp(h * 0.05, 24, 56), paddingBottom: 12 },
    title: { color: theme.accent, fontSize: clamp(h * 0.05, 26, 44), fontWeight: '800', letterSpacing: rtl ? 0 : 2, textAlign: rtl ? 'right' : 'left' },
    sub: { color: theme.textMuted, fontSize: clamp(h * 0.03, 15, 24), marginTop: 4, marginBottom: 10, textAlign: rtl ? 'right' : 'left' },
    blockRow: { flexDirection: rtl ? 'row-reverse' : 'row', gap, marginBottom: clamp(h * 0.022, 10, 20) },
    blockCard: {
      paddingHorizontal: clamp(cardW * 0.1, 14, 26),
      paddingVertical: clamp(h * 0.018, 8, 16),
      alignItems: 'center',
      justifyContent: 'center',
    },
    blockLabel: { color: theme.text, fontSize: clamp(h * 0.032, 15, 24), fontWeight: '700' },
    activeCard: { borderColor: theme.accent, borderWidth: 2, backgroundColor: theme.cardActive },
    activeText: { color: theme.accent },
    gridScroll: { marginHorizontal: -ueber, marginVertical: -ueber },
    grid: {
      flexDirection: rtl ? 'row-reverse' : 'row',
      flexWrap: 'wrap',
      gap,
      paddingHorizontal: ueber,
      paddingVertical: clamp(h * 0.02, 10, 22) + ueber,
    },
    card: { width: cardW, height: cardH, padding: clamp(h * 0.022, 12, 20), justifyContent: 'center' },
    num: { color: theme.accent, fontSize: clamp(h * 0.026, 14, 20), fontWeight: '700' },
    name: { color: theme.text, fontSize: clamp(h * 0.032, 16, 24), fontWeight: '600', marginTop: 2 },
    ar: { color: theme.textMuted, fontSize: clamp(h * 0.03, 15, 22), marginTop: 2, textAlign: 'right' },
  });
}

/**
 * Schriftgrad und Zeilenhoehe des Verses.
 *
 * Eigene, exportierte Funktion, weil das die einzige Stelle ist, an der die
 * Einstellung `readerScale` wirklich etwas bewirkt — und weil sie sich so
 * direkt pruefen laesst, ohne den halben Bildschirm zu rendern.
 *
 * Der eingestellte Schriftgrad wirkt NUR auf den Vers und seine beiden
 * Begleitzeilen; Kopfzeile und Bedienleiste bleiben, wo sie sind. Sonst schoebe
 * die groesste Stufe die Bedienung aus dem Bild. Die Obergrenzen sind bewusst
 * hoch genug, dass die groesste Stufe auf einem 1080-dp-Panel auch wirklich
 * groesser wird als die kleinste — eine Deckelung, die beide Stufen auf
 * denselben Wert klemmt, waere eine Einstellung ohne Wirkung.
 */
export function readerVerseMetrics(h: number, scale: number): { fontSize: number; lineHeight: number } {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  return {
    fontSize: clamp(h * 0.1 * scale, 30, 150),
    lineHeight: clamp(h * 0.15 * scale, 44, 210),
  };
}

function readerStyles(h: number, w: number, rtl: boolean, theme: Theme, scale: number) {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const { fontSize: arabSize, lineHeight: arabLine } = readerVerseMetrics(h, scale);
  const ctrl = clamp(h * 0.09, 50, 92);
  const buehnenPolster = clamp(h * 0.02, 12, 30);
  const zeilenLuecke = clamp(h * 0.018, 10, 26);
  const translitSize = clamp(h * 0.036 * scale, 16, 40);
  const uebersetzungSize = clamp(h * 0.038 * scale, 16, 42);
  const uebersetzungLine = clamp(h * 0.052 * scale, 24, 60);
  return Object.assign(
    StyleSheet.create({
      root: { flex: 1, overflow: 'hidden', paddingHorizontal: clamp(w * 0.06, 40, 130), paddingVertical: clamp(h * 0.04, 20, 52) },
      header: { flexDirection: rtl ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' },
      surahName: { color: theme.accent, fontSize: clamp(h * 0.038, 18, 30), fontWeight: '700', flexShrink: 1 },
      verseNo: { color: theme.textMuted, fontSize: clamp(h * 0.032, 15, 26), flexShrink: 0 },
      // `overflow: 'hidden'` ist hier kein Zierrat, sondern die Zusicherung: was
      // die Rechnung wider Erwarten doch nicht fasst, bleibt in der Buehne und
      // legt sich NICHT ueber die Bedienleiste.
      stage: { flex: 1, justifyContent: 'center', overflow: 'hidden', paddingVertical: buehnenPolster, gap: zeilenLuecke },
      arabBox: { justifyContent: 'center', overflow: 'hidden' },
      zusatzBox: { justifyContent: 'center', overflow: 'hidden' },
      arabicRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-end' },
      arabic: { color: theme.text, fontSize: arabSize, lineHeight: arabLine, fontWeight: '500' },
      arabicActive: { color: theme.accent },
      translit: { color: theme.accent, opacity: 0.85, fontSize: translitSize, textAlign: 'center', letterSpacing: 0.5 },
      translation: { color: theme.text, opacity: 0.9, fontSize: uebersetzungSize, textAlign: 'center', lineHeight: uebersetzungLine },
      verborgen: { opacity: 0 },
      controls: { flexDirection: rtl ? 'row-reverse' : 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: clamp(w * 0.012, 10, 20) },
      ctrl: { width: ctrl, height: ctrl, borderRadius: ctrl / 2, alignItems: 'center', justifyContent: 'center' },
      ctrlWide: { width: ctrl * 1.6, height: ctrl, borderRadius: ctrl / 2, alignItems: 'center', justifyContent: 'center' },
      ctrlPille: { height: ctrl, borderRadius: ctrl / 2, paddingHorizontal: clamp(w * 0.016, 16, 30), maxWidth: w * 0.22, alignItems: 'center', justifyContent: 'center' },
      ctrlActive: { borderColor: theme.accent, borderWidth: 2, backgroundColor: theme.cardActive },
      ctrlGlyph: { color: theme.text, fontSize: clamp(ctrl * 0.36, 18, 34), fontWeight: '700' },
      ctrlLabel: { color: theme.textMuted, fontSize: clamp(ctrl * 0.26, 13, 24), fontWeight: '600' },
      ctrlActiveText: { color: theme.accent },
      hint: { color: theme.textFaint, fontSize: clamp(h * 0.028, 13, 22), textAlign: 'center', marginTop: clamp(h * 0.018, 8, 18) },
    }),
    // Die Rohwerte begleiten die Stile: der Leser rechnet mit ihnen (wie viele
    // Zeilen passen, wie stark muss die Uebersetzung schrumpfen) und kann sie
    // aus einem fertigen StyleSheet nicht mehr auslesen.
    {
      arabischGroesse: arabSize,
      arabischZeile: arabLine,
      buehnenPolster,
      zeilenLuecke,
      translitGroesse: translitSize,
      uebersetzungGroesse: uebersetzungSize,
      uebersetzungZeile: uebersetzungLine,
    },
  );
}
