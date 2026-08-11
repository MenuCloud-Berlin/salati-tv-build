import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AmbientGlow } from '@/components/AmbientGlow';

import {
  countdownUnits,
  fmtCountdown,
  nextPrayer,
  timesFor,
  type PrayerKey,
  type TvLocation,
} from '@/lib/prayerTimes';
import { locationLabel } from '@/data/cities';
import { hijriParts } from '@/lib/hijri';
import { useTranslation } from '@/lib/i18n';
import { DATE_LOCALE_TAGS } from '@/lib/locale';
import { calcExtras, useTvSettings } from '@/lib/settings';
import { tagAmOrt, zeitInZone, zoneWeichtAb } from '@/lib/timezone';
import type { Theme } from '@/lib/theme';
import { useTheme } from '@/lib/useTheme';

// Sechs Zeilen statt fuenf: der Sonnenaufgang ist das ENDE der Fadschr-Zeit und
// damit die einzige Zahl, nach der man morgens wirklich schaut. Er fehlte hier,
// stand aber auf dem Handy — und der Platz ist da (Bildschirmbefund 2026-08-08:
// die fuenf Zellen liessen zwischen sich mehr Luft als sie selbst breit waren).
const ROW_KEYS: PrayerKey[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

/**
 * Gebetsuhr — Default-Screen der TV-App. Große Uhr, nächstes Gebet + Countdown,
 * alle Tageszeiten als Reihe. Vollständig offline (adhan-Berechnung).
 *
 * Alle Größen sind HÖHEN-RELATIV (useWindowDimensions) statt fixer dp-Werte:
 * Android-TV-Geräte melden je nach Dichte sehr unterschiedliche dp-Höhen (der
 * Emulator läuft mit 320 dpi → nur 540 dp hoch, echte 1080p-TVs oft 1× → 1080 dp).
 * Feste Schriftgrößen (Uhr 200 dp) sprengten die 540-dp-Höhe und schoben die
 * Gebetsreihe + Brand aus dem Bild (Gerätetest-Fund 2026-07-24). Relative Größen
 * passen sich jeder Dichte an und laufen nie über.
 */
export function ClockScreen({ location: override }: { location?: TvLocation } = {}) {
  const settings = useTvSettings();
  const { t, locale, rtl } = useTranslation();
  const theme = useTheme();
  const location = override ?? settings.location;
  const is24h = settings.is24h;
  const { height, width } = useWindowDimensions();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Hochbreiten-Regel und Minuten-Korrektur muessen in die Rechnung, sonst
  // zeigt der Fernseher andere Zeiten als das Handy (Audit 2026-07-29, P1).
  const { highLatitude, offsets } = settings;
  const extras = useMemo(() => calcExtras({ highLatitude, offsets }), [highLatitude, offsets]);
  // Der Tagesplan haengt am KALENDERTAG AM ORT, nicht an der Sekunde und nicht
  // am Datum des Fernsehers: um 23:30 in Berlin ist in Jakarta laengst der
  // naechste Tag (s. lib/timezone.ts). Ohne das rechnete die Uhr dort den
  // Vortag.
  const tagesSchluessel = tagAmOrt(now, location.tz).toDateString();
  const today = useMemo(
    () => timesFor(location, new Date(tagesSchluessel), extras),
    [location, extras, tagesSchluessel],
  );
  const next = useMemo(() => nextPrayer(location, now, extras), [location, extras, now]);

  // Alle Uhrzeiten in der Zone des ORTES. Die Zeitpunkte waren nie falsch, nur
  // in der Zone des Fernsehers abgelesen (Audit-Befund P10).
  const zeit = (d: Date) => zeitInZone(d, location.tz, is24h);
  const clock = zeit(now);
  // Sekunden sind in jeder Zone gleich — nur Minuten-Offsets (Indien +5:30,
  // Nepal +5:45) verschieben die Minute, nie die Sekunde.
  const seconds = now.getSeconds().toString().padStart(2, '0');
  // Datum in der eingestellten Sprache (vorher fest 'de-DE' — die Uhr blieb
  // damit auch bei tuerkischer oder arabischer Oberflaeche deutsch).
  const dateLabel = formatDate(new Date(tagesSchluessel), DATE_LOCALE_TAGS[locale]);
  // Das Hidschri-Datum stand bisher nur auf dem Handy. Es wird lokal gerechnet
  // (s. lib/hijri.ts) und hat deshalb die bekannte Unschaerfe von plus/minus
  // einem Tag — es steht als ZUSATZ neben dem gregorianischen Datum, nicht an
  // seiner Stelle.
  const hijri = useMemo(() => hijriParts(new Date(tagesSchluessel), locale), [tagesSchluessel, locale]);
  // Hinweis nur, wenn die Zone des Ortes wirklich von der des Fernsehers
  // abweicht — im Normalfall waere er nur Laerm.
  const andereZone = zoneWeichtAb(now, location.tz);

  const s = useMemo(() => makeStyles(height, width, rtl, theme), [height, width, rtl, theme]);
  // Countdown-Einheiten in der Oberflaechensprache (Audit 2026-07-28, T17) —
  // vorher stand „1h 55m" auch mitten im arabischen Satz. Bewusst ohne useMemo:
  // `t` ist bei jedem Render eine neue Closure, ein Memo auf [t] wuerde nie
  // greifen, und drei Woerterbuch-Zugriffe je Sekundentakt sind kostenlos.
  const units = countdownUnits(t);
  const atem = useAtem();
  // Groesse des Scheins — auch hier gebraucht, nicht nur im Style.
  const aura = Math.min(width * 0.85, height * 1.15);

  return (
    <View style={s.root}>
      {/* Ruhiger, langsam atmender Lichtschein hinter der Uhr. Er laeuft ueber
          den nativen Treiber (Opazitaet + Skalierung), kostet also keinen
          JS-Takt — der Bildschirm ist der Standard-Screensaver der App und darf
          nicht wie ein Standbild wirken. Weicher Verlauf statt runder Flaeche:
          s. components/AmbientGlow.tsx. */}
      <Animated.View
        pointerEvents="none"
        style={[s.aura, { opacity: atem.opacity, transform: [{ scale: atem.scale }] }]}>
        <AmbientGlow color={theme.accent} size={aura} intensity={0.16} />
      </Animated.View>

      {/* Kopf: Standort + Datum (gregorianisch und Hidschri) */}
      <View style={s.header}>
        {/* Audit 2026-07-28 (T16): stand hier fest deutsch („Mekka") — auch in
            arabischer Oberflaeche. */}
        <Text style={s.location} numberOfLines={1}>{locationLabel(location, locale)}</Text>
        <View style={s.dateBlock}>
          <Text style={s.date} numberOfLines={1}>{dateLabel}</Text>
          <Text style={s.hijri} numberOfLines={1}>
            {t('clock.hijriDate', { day: hijri.day, month: hijri.month, year: hijri.year })}
          </Text>
        </View>
      </View>

      {/* Große Uhr */}
      <View style={s.clockBlock}>
        <Text style={s.clock} numberOfLines={1} adjustsFontSizeToFit>{clock}</Text>
        <Text style={s.seconds}>{seconds}</Text>
      </View>

      {/* Nächstes Gebet + Countdown */}
      <View style={s.nextBlock}>
        <Text style={s.nextLabel}>{t('clock.next')}</Text>
        <Text style={s.nextName} numberOfLines={1}>
          {t(`prayers.${next.key}`)} · {zeit(next.at)}
        </Text>
        <View style={s.pill}>
          <Text style={s.pillText}>
            {t('clock.timeLeft', { time: fmtCountdown(next.diffMs, units) })}
          </Text>
        </View>
      </View>

      {/* Tageszeiten */}
      <View style={s.timesRow}>
        {ROW_KEYS.map((key) => {
          const active = key === next.key && !next.tomorrow;
          return (
            <View key={key} style={[s.timeCell, active && s.timeCellActive]}>
              <Text style={[s.timeName, active && s.timeActiveText]} numberOfLines={1}>
                {t(`prayers.${key}Short`)}
              </Text>
              <Text style={[s.timeValue, active && s.timeActiveText]} numberOfLines={1}>
                {zeit(today[key])}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={s.footer}>
        <Text style={s.brand}>SALATI</Text>
        <Text style={s.hint}>
          {andereZone ? t('clock.localTime', { city: locationLabel(location, locale) }) : t('clock.openMenu')}
        </Text>
      </View>
    </View>
  );
}

/**
 * Der „Atem" hinter der Uhr: 9 s hin, 9 s zurueck, endlos.
 *
 * Bewusst NUR Opazitaet und Skalierung — beides laeuft mit `useNativeDriver`
 * komplett im UI-Thread. Eine Animation auf Farbe oder Groesse muesste je Bild
 * ueber die Bruecke und wuerde auf schwachen Fire-TV-Sticks genau das
 * verursachen, was sie verhindern soll: ein ruckelndes Bild.
 */
function useAtem(): { opacity: Animated.Value; scale: Animated.Value } {
  const [opacity] = useState(() => new Animated.Value(0.55));
  const [scale] = useState(() => new Animated.Value(0.94));

  useEffect(() => {
    const takt = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.55, duration: 9000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.06, duration: 9000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.94, duration: 9000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ]),
    );
    takt.start();
    return () => takt.stop();
  }, [opacity, scale]);

  return { opacity, scale };
}

/** Datum formatieren; faellt auf Englisch zurueck, falls die Android-ICU des
 *  Fernsehers das Sprach-Tag nicht kennt (aeltere Fire-TV-Firmwares). */
function formatDate(now: Date, tag: string): string {
  const opts = { weekday: 'long', day: 'numeric', month: 'long' } as const;
  try {
    return now.toLocaleDateString(tag, opts);
  } catch {
    return now.toLocaleDateString('en-US', opts);
  }
}

/** Höhen-/breiten-relative Styles — fit-by-design auf jeder TV-Dichte. */
function makeStyles(h: number, w: number, rtl: boolean, theme: Theme) {
  // Clamp gegen Extremwerte (sehr kleine/große dp-Flächen).
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const padV = clamp(h * 0.055, 24, 72);
  const padH = clamp(w * 0.06, 32, 120);
  const clockSize = clamp(h * 0.24, 92, 280);
  // Buchstabenabstand zerreisst arabische/persische Ligaturen — im RTL-Layout
  // deshalb auf 0. Die lateinische Wortmarke „SALATI" behaelt ihren Abstand.
  const track = rtl ? 0 : undefined;

  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.bg,
      paddingHorizontal: padH,
      paddingVertical: padV,
      justifyContent: 'space-between',
      overflow: 'hidden',
    },
    // Groesszuegig bemessen: der Verlauf laeuft zum Rand hin auf null aus, es
    // gibt also keine Kante, die auffallen koennte.
    aura: {
      position: 'absolute',
      alignSelf: 'center',
      top: h * 0.06,
      width: Math.min(w * 0.85, h * 1.15),
      height: Math.min(w * 0.85, h * 1.15),
    },
    header: { flexDirection: rtl ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    location: { color: theme.accent, fontSize: clamp(h * 0.055, 20, 40), fontWeight: '700', letterSpacing: track ?? 1, flexShrink: 1 },
    dateBlock: { alignItems: rtl ? 'flex-start' : 'flex-end', flexShrink: 1 },
    date: { color: theme.textMuted, fontSize: clamp(h * 0.042, 15, 32), textAlign: rtl ? 'left' : 'right' },
    hijri: { color: theme.textFaint, fontSize: clamp(h * 0.032, 12, 24), marginTop: 2, textAlign: rtl ? 'left' : 'right' },
    clockBlock: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
    clock: { color: theme.text, fontSize: clockSize, fontWeight: '200', letterSpacing: 2, lineHeight: clockSize * 1.02 },
    seconds: { color: theme.accent, fontSize: clockSize * 0.3, fontWeight: '300', marginBottom: clockSize * 0.14, marginLeft: 10 },
    nextBlock: { alignItems: 'center', gap: clamp(h * 0.012, 4, 12) },
    nextLabel: { color: theme.textMuted, fontSize: clamp(h * 0.035, 14, 26), letterSpacing: track ?? 2, textTransform: 'uppercase' },
    nextName: { color: theme.text, fontSize: clamp(h * 0.07, 26, 56), fontWeight: '700' },
    pill: {
      backgroundColor: theme.accentSoft,
      borderRadius: 999,
      paddingHorizontal: clamp(w * 0.018, 16, 32),
      paddingVertical: clamp(h * 0.012, 6, 12),
      marginTop: 2,
    },
    pillText: { color: theme.accent, fontSize: clamp(h * 0.044, 18, 34), fontWeight: '600' },
    timesRow: { flexDirection: rtl ? 'row-reverse' : 'row', justifyContent: 'space-between', gap: clamp(w * 0.01, 8, 16) },
    timeCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: clamp(h * 0.018, 8, 20),
      paddingHorizontal: 4,
      borderRadius: 20,
      backgroundColor: theme.surface,
    },
    timeCellActive: { backgroundColor: theme.accentSoft },
    timeName: { color: theme.textMuted, fontSize: clamp(h * 0.03, 12, 24), letterSpacing: track ?? 1, marginBottom: clamp(h * 0.008, 3, 8) },
    timeValue: { color: theme.text, fontSize: clamp(h * 0.046, 18, 40), fontWeight: '600' },
    timeActiveText: { color: theme.accent },
    // Eigener Abstand nach oben: die Reihe stiess vorher direkt an die
    // Wortmarke, weil `space-between` den Rest verteilt und unten nichts uebrig
    // blieb (Bildschirmbefund 2026-08-08).
    footer: { alignItems: 'center', gap: clamp(h * 0.008, 3, 8), marginTop: clamp(h * 0.022, 8, 20) },
    brand: { color: theme.accent, opacity: 0.75, fontSize: clamp(h * 0.03, 14, 26), letterSpacing: 12, textAlign: 'center' },
    hint: { color: theme.textFaint, fontSize: clamp(h * 0.024, 12, 20), letterSpacing: 1, textAlign: 'center' },
  });
}
