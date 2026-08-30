import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';

import { FocusCard } from '@/components/FocusCard';
import { fokusUeberstand } from '@/components/fokusUeberstand';
import {
  AZAN_AUS,
  AZAN_CHOICES,
  AZAN_LIZENZEN,
  AZAN_PRAYERS,
  AZAN_VORSCHLAG,
  azanNummer,
  type AzanChoice,
} from '@/lib/azan';
import { azanSpielen, azanStoppen, useAzanLauf } from '@/lib/azanRuf';
import { CITIES, cityForLocation, cityLabel } from '@/data/cities';
import { useTranslation } from '@/lib/i18n';
import { LOCALE_ENDONYMS, SUPPORTED_LOCALES } from '@/lib/locale';
import { METHOD_REGION_ORDER, PRAYER_METHODS } from '@/lib/methods';
import { SETTINGS_BEREICHE, type SettingsBereich } from '@/lib/nav';
import {
  HIGH_LATITUDE_SETTINGS,
  METHOD_FULL_NAMES,
  METHOD_LABELS,
  PRAYER_KEYS,
  type HighLatitudeSetting,
} from '@/lib/prayerTimes';
import { SURAHS } from '@/data/surahs';
import {
  alleLoeschen,
  belegung,
  formatBytes,
  gespeicherteListe,
  sureLoeschen,
  useOfflineAudio,
} from '@/lib/offlineAudio';
import { QURAN_FONTS, adaptQuranText } from '@/lib/quranFonts';
import {
  adjustOffset,
  CLOCK_SCALES,
  DIMMUNGEN,
  READER_SCALES,
  resetOffsets,
  setAzanAlle,
  setAzanChoice,
  setAzanVolume,
  setClockScale,
  setHighLatitude,
  setIs24h,
  setJumuaModusAktiv,
  setLanguage,
  setLocation,
  setQuranFont,
  setQuranSukun,
  setReaderScale,
  setVersDesTagesAktiv,
  setWetterAktiv,
  AUSBLEND_ZEITEN,
  setAkzent,
  setBedienungAusblenden,
  setFotoBewegung,
  setHintergrund,
  setHintergrundDimmung,
  setTheme,
  setUhrGewicht,
  setUhrSekunden,
  setUhrStil,
  UHR_GEWICHTE,
  UHR_STILE,
  toggleReaderOption,
  useTvSettings,
} from '@/lib/settings';
import { HINTERGRUENDE, hintergrundNameKey, medienId } from '@/lib/hintergruende';
import {
  fetchHintergrundMedien,
  istGespeichert as istMediumGespeichert,
  medienBelegung,
  mediumHerunterladen,
  mediumLoeschen,
  useHintergrundMedien,
  type HintergrundMedium,
} from '@/lib/hintergrundMedien';
import { AKZENTE, THEMES } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useAllQuranFonts } from '@/lib/useQuranFont';
import { useTheme } from '@/lib/useTheme';

/** Vorschautext der Schriftauswahl — kurz genug fuer eine Kachel und lang
 *  genug, dass Ligatur, Vokalzeichen und Alif-Wasla sichtbar werden. */
const BISMILLAH = 'بِسْمِ ٱللَّهِ';

/** Locale-Schluessel der vier Hochbreiten-Regeln — Namen wie in der Handy-App. */
const HIGH_LAT_KEYS: Record<HighLatitudeSetting, string> = {
  auto: 'settings.highLatitude.auto',
  middleOfNight: 'settings.highLatitude.middleOfNight',
  seventhOfNight: 'settings.highLatitude.seventhOfNight',
  twilightAngle: 'settings.highLatitude.twilightAngle',
};

/**
 * Die fünf Bereiche der Einstellungen.
 *
 * WARUM SIE ES JETZT GIBT (Audit-Befund D4, vom Nutzer am 2026-08-08 als
 * „Menü-Problem" bestätigt): Die Seite war EINE durchgehende Liste. Vor der
 * Berechnungsmethode lagen 14 Sprachen und 40 Städte — mit der Fernbedienung
 * rund 15 Mal DPAD_DOWN, nur um dorthin zu kommen. Mit den neuen Darstellungs-
 * und Leser-Einstellungen wären es mehr als 90 fokussierbare Kacheln in einer
 * einzigen Spalte geworden.
 *
 * Jetzt: links eine feste Bereichsspalte, rechts nur der gewählte Bereich. Der
 * Weg zu jeder Einstellung ist damit höchstens zwei Ebenen tief.
 */
// Die Liste steht in lib/nav.ts, nicht hier: sie wird auch fuer das
// Startargument `-salatiBereich` gebraucht, und zwei getrennte Listen laufen
// frueher oder spaeter auseinander — genau der Fehler, den SCREENS dort schon
// einmal hatte.
const SECTIONS = SETTINGS_BEREICHE;
type SectionId = SettingsBereich;

const SECTION_KEYS: Record<SectionId, string> = {
  language: 'settings.language',
  location: 'settings.location',
  prayer: 'settings.sections.prayer',
  azan: 'settings.sections.azan',
  display: 'settings.sections.display',
  hintergrund: 'settings.sections.background',
  reader: 'settings.sections.reader',
  storage: 'settings.sections.storage',
};

// Einstellungen: Sprache, Standort, Gebetszeit-Rechnung, Darstellung und
// Koran-Leser. Die Gebetsuhr rechnet on-device mit adhan — hier gewählte Werte
// wirken sofort auf Clock/Countdown. Standort per Fernbedienung: Städteliste
// statt Tastatureingabe (die exakteste Quelle bleibt die Handy-Kopplung).
//
// Audit 2026-07-28 (T13): die Sprachwahl gab es hier gar nicht — die TV-App war
// fest deutsch, während die Handy-App 14 Sprachen kann. Sie steht bewusst als
// ERSTER Bereich und trägt den Initialfokus: wer die Oberfläche nicht lesen
// kann, muss sie zuerst finden.
export function SettingsScreen({ startBereich }: { startBereich?: SectionId | null } = {}) {
  // `startBereich` setzt nur den ANFANG. Die Leiste bleibt wie sie ist, und wer
  // von Hand wechselt, bekommt seinen Bereich (s. lib/nav.ts — gebraucht wird
  // es fuer die Bildschirmfoto-Automatik, die keine Fernbedienung hat).
  const [section, setSection] = useState<SectionId>(startBereich ?? 'language');
  const { width, height } = useWindowDimensions();
  const { t, rtl } = useTranslation();
  const theme = useTheme();
  const s = useMemo(() => makeStyles(width, height, rtl, theme), [width, height, rtl, theme]);

  return (
    <View style={s.root}>
      <View style={s.rail}>
        <Text style={s.title}>{t('settings.title')}</Text>
        {SECTIONS.map((id, i) => {
          const active = id === section;
          return (
            <FocusCard
              key={id}
              hasTVPreferredFocus={i === 0}
              onPress={() => setSection(id)}
              style={[s.railCard, active && s.activeCard]}>
              <Text style={[s.railLabel, active && s.activeText]} numberOfLines={2}>
                {t(SECTION_KEYS[id])}
              </Text>
            </FocusCard>
          );
        })}
        <Text style={s.railHint}>{t('settings.railHint')}</Text>
      </View>

      {/* `key` erzwingt einen frischen Inhaltsbereich je Bereich: ohne ihn
          behielte die ScrollView beim Wechsel ihre alte Scrollposition und der
          neue Bereich begänne mittendrin. */}
      <ScrollView key={section} style={s.pane} contentContainerStyle={s.paneContent} showsVerticalScrollIndicator={false}>
        {section === 'language' && <LanguageSection s={s} />}
        {section === 'location' && <LocationSection s={s} />}
        {section === 'prayer' && <PrayerSection s={s} />}
        {section === 'azan' && <AzanSection s={s} />}
        {section === 'display' && <DisplaySection s={s} />}
        {section === 'hintergrund' && <HintergrundSection s={s} />}
        {section === 'reader' && <ReaderSection s={s} />}
        {section === 'storage' && <StorageSection s={s} />}
      </ScrollView>
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function LanguageSection({ s }: { s: Styles }) {
  const { language } = useTvSettings();
  const { t } = useTranslation();
  return (
    <>
      <Text style={s.section}>{t('settings.language')}</Text>
      <View style={s.grid}>
        {SUPPORTED_LOCALES.map((code) => {
          const active = code === language;
          return (
            <FocusCard
              key={code}
              onPress={() => setLanguage(code)}
              style={[s.card, active && s.activeCard]}>
              {/* Immer die Eigenbezeichnung — eine Sprachliste in einer Sprache,
                  die man nicht liest, hilft genau dann nicht, wenn man sie
                  braucht. */}
              <Text style={[s.cardLabel, active && s.activeText]} numberOfLines={1}>
                {LOCALE_ENDONYMS[code]}
              </Text>
            </FocusCard>
          );
        })}
      </View>
    </>
  );
}

function LocationSection({ s }: { s: Styles }) {
  const { location } = useTvSettings();
  const { t, locale } = useTranslation();
  // Audit 2026-07-28 (T16): Der Abgleich lief ueber den Anzeigenamen. Sobald
  // der uebersetzt ist, passt er nicht mehr zum gespeicherten Namen — deshalb
  // vergleicht die aktive Kachel jetzt den stabilen Stadt-Schluessel.
  const activeCity = cityForLocation(location);
  return (
    <>
      <Text style={s.section}>{t('settings.location')}</Text>
      <Text style={s.current}>
        {t('settings.current')}: {activeCity ? cityLabel(activeCity, locale) : location.label} ·{' '}
        {METHOD_LABELS[location.method]}
      </Text>
      <View style={s.grid}>
        {CITIES.map((c) => {
          const active = c.id === activeCity?.id;
          return (
            <FocusCard
              key={c.id}
              onPress={() =>
                setLocation({
                  ...location,
                  lat: c.lat,
                  lon: c.lon,
                  // `label` bleibt der deutsche Name: er ist nur noch der
                  // Rueckfall, wandert aber in den Speicher — ein uebersetzter
                  // Name dort wuerde bei jedem Sprachwechsel veralten.
                  label: c.labels.de,
                  cityId: c.id,
                  method: c.method,
                  tz: c.tz,
                })
              }
              style={[s.card, active && s.activeCard]}>
              <Text style={[s.cardLabel, active && s.activeText]} numberOfLines={1}>
                {cityLabel(c, locale)}
              </Text>
            </FocusCard>
          );
        })}
      </View>
    </>
  );
}

function PrayerSection({ s }: { s: Styles }) {
  const { location, is24h, highLatitude, offsets } = useTvSettings();
  const { t } = useTranslation();
  return (
    <>
      {/* Audit 2026-07-29 (P1): Die Berechnungsmethode war gar nicht waehlbar —
          sie hing fest an der gewaehlten Stadt. Wer in Berlin nach Muslim World
          League statt Diyanet betet, konnte das am Fernseher nicht einstellen,
          auf dem Handy schon.

          Seit der Katalog alle 23 Behoerden fuehrt, ist die flache Liste zu
          lang geworden — sie ist deshalb nach Regionen gruppiert, in derselben
          Ordnung wie in der Handy-App. Auf den Kacheln steht der Kurzname
          („Diyanet"), darueber der volle Behoerdenname der aktiven Wahl. */}
      <Text style={s.section}>{t('settings.method')}</Text>
      <Text style={s.current}>{METHOD_FULL_NAMES[location.method] ?? METHOD_LABELS[location.method]}</Text>
      {METHOD_REGION_ORDER.map((region) => {
        const methoden = PRAYER_METHODS.filter((m) => m.region === region);
        if (methoden.length === 0) return null;
        return (
          <View key={region}>
            <Text style={s.groupLabel}>{t(`settings.methodRegions.${region}`)}</Text>
            <View style={s.grid}>
              {methoden.map((m) => {
                const active = location.method === m.id;
                return (
                  <FocusCard
                    key={m.id}
                    onPress={() => setLocation({ ...location, method: m.id })}
                    style={[s.wideCard, active && s.activeCard]}>
                    <Text style={[s.cardLabel, active && s.activeText]} numberOfLines={2}>
                      {m.shortName}
                    </Text>
                  </FocusCard>
                );
              })}
            </View>
          </View>
        );
      })}

      {/* Die Regel, die den groessten Unterschied macht (in Berlin ueber eine
          Stunde bei Fadschr/Ischa). */}
      <Text style={s.section}>{t('settings.highLatitude.title')}</Text>
      <Text style={s.hint}>{t('settings.highLatitude.hint')}</Text>
      <View style={s.grid}>
        {HIGH_LATITUDE_SETTINGS.map((rule) => {
          const active = highLatitude === rule;
          return (
            <FocusCard
              key={rule}
              onPress={() => setHighLatitude(rule)}
              style={[s.wideCard, active && s.activeCard]}>
              <Text style={[s.cardLabel, active && s.activeText]} numberOfLines={2}>
                {t(HIGH_LAT_KEYS[rule])}
              </Text>
            </FocusCard>
          );
        })}
      </View>

      <Text style={s.section}>{t('settings.asrSchool')}</Text>
      <View style={s.row}>
        {(['shafi', 'hanafi'] as const).map((m) => {
          const active = location.madhab === m;
          return (
            <FocusCard
              key={m}
              onPress={() => setLocation({ ...location, madhab: m })}
              style={[s.toggleCard, active && s.activeCard]}>
              <Text style={[s.toggleLabel, active && s.activeText]} numberOfLines={2}>
                {m === 'shafi' ? t('settings.asrEarlier') : t('settings.asrLater')}
              </Text>
            </FocusCard>
          );
        })}
      </View>

      {/* Minuten-Korrektur je Gebet — dieselbe Funktion wie in der Handy-App,
          damit sich beide Geraete auf dieselbe Moschee justieren lassen. */}
      <Text style={s.section}>{t('settings.timeAdjust.title')}</Text>
      <View style={s.grid}>
        {PRAYER_KEYS.map((key) => (
          <View key={key} style={s.offsetRow}>
            <Text style={s.offsetName} numberOfLines={1}>
              {t(`prayers.${key}`)}
            </Text>
            <FocusCard onPress={() => adjustOffset(key, -1)} style={s.stepCard}>
              <Text style={s.stepLabel}>−</Text>
            </FocusCard>
            <Text style={s.offsetValue}>
              {offsets[key] > 0 ? `+${offsets[key]}` : offsets[key]} {t('settings.timeAdjust.minutesShort')}
            </Text>
            <FocusCard onPress={() => adjustOffset(key, 1)} style={s.stepCard}>
              <Text style={s.stepLabel}>+</Text>
            </FocusCard>
          </View>
        ))}
      </View>
      <View style={s.row}>
        <FocusCard onPress={resetOffsets} style={s.toggleCard}>
          <Text style={s.toggleLabel} numberOfLines={2}>
            {t('settings.timeAdjust.reset')}
          </Text>
        </FocusCard>
      </View>

      <Text style={s.section}>{t('settings.timeFormat')}</Text>
      <View style={s.row}>
        {[true, false].map((v) => {
          const active = is24h === v;
          return (
            <FocusCard
              key={String(v)}
              onPress={() => setIs24h(v)}
              style={[s.toggleCard, active && s.activeCard]}>
              <Text style={[s.toggleLabel, active && s.activeText]} numberOfLines={2}>
                {v ? t('settings.format24') : t('settings.format12')}
              </Text>
            </FocusCard>
          );
        })}
      </View>
    </>
  );
}

/**
 * Gebetsruf — seit 1.8.0. Bis dahin lag in `apps/tv/assets` KEINE einzige
 * Audiodatei: die Uhr zeigte die Gebetszeit an und schwieg dazu, waehrend die
 * Handy-App den Ruf laengst konnte.
 *
 * Zwei Entscheidungen, die man am Bildschirm nicht sieht:
 *
 *  1. Es gibt keinen Gesamtschalter, sondern eine Wahl JE GEBET. In vielen
 *     Haushalten soll Fadschr still bleiben und Maghrib nicht — ein einzelner
 *     Schalter zwingt zu „alles oder nichts".
 *  2. Neben jeder Zeile steht „Probehoeren". Eine Aufnahme, die man erst zur
 *     Gebetszeit zum ersten Mal hoert, ist auf einem Wohnzimmer-Fernseher die
 *     falsche Ueberraschung — samt Lautstaerke.
 */
function AzanSection({ s }: { s: Styles }) {
  const { azan, azanVolume } = useTvSettings();
  const { t } = useTranslation();
  const lauf = useAzanLauf();

  // Beschriftung einer Wahl: „Aus" oder „Adhan 1..3". Die Nummer kommt aus der
  // Katalog-Reihenfolge, damit Fernseher und Handy dieselbe Aufnahme gleich
  // benennen (s. lib/azan.ts).
  const label = (c: AzanChoice) =>
    c === 'aus' ? t('settings.azan.off') : t('settings.azan.recording', { n: azanNummer(c) });

  return (
    <>
      <Text style={s.section}>{t('settings.azan.title')}</Text>
      <Text style={s.hint}>{t('settings.azan.hint')}</Text>

      {AZAN_PRAYERS.map((prayer) => (
        <View key={prayer} style={s.azanRow}>
          <Text style={s.azanName} numberOfLines={1}>
            {t(`prayers.${prayer}`)}
          </Text>
          {AZAN_CHOICES.map((c) => {
            const active = azan[prayer] === c;
            return (
              <FocusCard
                key={c}
                onPress={() => setAzanChoice(prayer, c)}
                style={[s.azanChoice, active && s.activeCard]}>
                <Text style={[s.azanChoiceLabel, active && s.activeText]} numberOfLines={1}>
                  {label(c)}
                </Text>
              </FocusCard>
            );
          })}
          {/* Probehoeren spielt IMMER die Wahl dieser Zeile — bei „aus" gibt es
              nichts zu hoeren, deshalb bleibt der Knopf dann ohne Wirkung und
              zeigt das auch (gedaempfte Schrift). */}
          <FocusCard
            onPress={() => {
              const c = azan[prayer];
              if (c === 'aus') return;
              azanSpielen({ prayer, choice: c, zeit: new Date() }, azanVolume);
            }}
            style={s.azanChoice}>
            <Text
              style={[s.azanChoiceLabel, azan[prayer] === 'aus' && s.azanChoiceOff]}
              numberOfLines={1}>
              {t('settings.azan.preview')}
            </Text>
          </FocusCard>
        </View>
      ))}

      <Text style={s.hint}>{t('settings.azan.tathwib')}</Text>

      <View style={s.row}>
        <FocusCard onPress={() => setAzanAlle(AZAN_AUS)} style={s.toggleCard}>
          <Text style={s.toggleLabel} numberOfLines={2}>
            {t('settings.azan.allOff')}
          </Text>
        </FocusCard>
        <FocusCard onPress={() => setAzanAlle(AZAN_VORSCHLAG)} style={s.toggleCard}>
          <Text style={s.toggleLabel} numberOfLines={2}>
            {t('settings.azan.suggest')}
          </Text>
        </FocusCard>
        {/* Der Beenden-Knopf steht nur da, wenn wirklich etwas laeuft — sonst
            waere er ein Knopf ohne Aufgabe. Die Zurueck-Taste kann dasselbe
            (s. App.tsx), aber wer gerade in den Einstellungen steht, sucht sie
            hier. */}
        {lauf ? (
          <FocusCard onPress={azanStoppen} style={s.toggleCard}>
            <Text style={s.toggleLabel} numberOfLines={2}>
              {t('settings.azan.stop')}
            </Text>
          </FocusCard>
        ) : null}
      </View>

      <Text style={s.section}>{t('settings.azan.volume')}</Text>
      <View style={s.offsetRow}>
        <Text style={s.offsetName} numberOfLines={1}>
          {t('settings.azan.volume')}
        </Text>
        <FocusCard onPress={() => setAzanVolume(azanVolume - 0.1)} style={s.stepCard}>
          <Text style={s.stepLabel}>−</Text>
        </FocusCard>
        <Text style={s.offsetValue}>{Math.round(azanVolume * 100)} %</Text>
        <FocusCard onPress={() => setAzanVolume(azanVolume + 0.1)} style={s.stepCard}>
          <Text style={s.stepLabel}>+</Text>
        </FocusCard>
      </View>

      {/* Namensnennung. Zwei der drei Aufnahmen stehen unter CC BY bzw.
          CC BY-SA — sie mitzuliefern, ohne die Urheber zu nennen, waere ein
          Lizenzbruch. Deshalb steht das hier im Geraet und nicht nur im
          Quelltext. */}
      <Text style={s.section}>{t('settings.azan.licenses')}</Text>
      <Text style={s.hint}>{t('settings.azan.licenseHint')}</Text>
      {AZAN_LIZENZEN.map((l) => (
        <View key={l.choice} style={s.lizenzBlock}>
          <Text style={s.lizenzTitel}>
            {t('settings.azan.recording', { n: azanNummer(l.choice) })} · {l.titel}
          </Text>
          <Text style={s.lizenzZeile}>
            {l.urheber} · {l.lizenz}
          </Text>
          <Text style={s.lizenzZeile}>{l.quelle}</Text>
        </View>
      ))}
    </>
  );
}

/**
 * Darstellung — bis 1.3.0 gab es hier gar nichts: Hintergrund und Akzentfarbe
 * standen fest im Quelltext jedes einzelnen Bildschirms. Ein Fernseher steht
 * aber in sehr unterschiedlichen Räumen; „Tiefschwarz" ist auf OLED etwas
 * anderes als „Papier" in einem hellen Wohnzimmer.
 */
function DisplaySection({ s }: { s: Styles }) {
  const {
    theme: aktiv,
    akzent,
    bedienungAusblenden,
    clockScale,
    uhrStil,
    uhrGewicht,
    uhrSekunden,
    versDesTagesAktiv,
    jumuaModusAktiv,
    wetterAktiv,
  } = useTvSettings();
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <>
      <Text style={s.section}>{t('settings.theme.title')}</Text>
      <Text style={s.hint}>{t('settings.theme.hint')}</Text>
      <View style={s.grid}>
        {THEMES.map((th) => {
          const active = th.id === aktiv;
          return (
            <FocusCard
              key={th.id}
              onPress={() => setTheme(th.id)}
              style={[s.themeCard, active && s.activeCard]}>
              {/* Farbprobe statt nur Text: der Name allein sagt niemandem, wie
                  „Nachtblau" aussieht. Die drei Punkte zeigen Grundflaeche,
                  Karte und Akzent des Themas — genau die drei Farben, die den
                  Unterschied ausmachen. */}
              <View style={s.swatchRow}>
                <View style={[s.swatch, { backgroundColor: th.bg, borderColor: th.accent }]} />
                <View style={[s.swatch, { backgroundColor: th.accent, borderColor: th.accent }]} />
                <View style={[s.swatch, { backgroundColor: th.text, borderColor: th.accent }]} />
              </View>
              <Text style={[s.cardLabel, active && s.activeText]} numberOfLines={1}>
                {t(th.nameKey)}
              </Text>
            </FocusCard>
          );
        })}
      </View>

      {/* Der Akzent ist seit 2026-08-30 von der Farbwelt geloest (s. theme.ts):
          wer den dunklen Grund mag, aber lieber Tuerkis als Gold sieht, musste
          vorher die ganze Welt wechseln. */}
      <Text style={s.section}>{t('settings.akzent.title')}</Text>
      <Text style={s.hint}>{t('settings.akzent.hint')}</Text>
      <View style={s.row}>
        {AKZENTE.map((a) => {
          const active = a.id === akzent;
          // Die Probe zeigt die Farbe, die auf DIESEM Untergrund gilt — auf
          // „Papier" ist es die dunkle Fassung.
          const probe = a.id === 'thema' ? theme.accent : theme.dark ? a.hell : a.dunkel;
          return (
            <FocusCard
              key={a.id}
              onPress={() => setAkzent(a.id)}
              style={[s.akzentCard, active && s.activeCard]}>
              <View style={[s.swatch, s.akzentProbe, { backgroundColor: probe, borderColor: probe }]} />
              <Text style={[s.akzentLabel, active && s.activeText]} numberOfLines={1}>
                {t(a.nameKey)}
              </Text>
            </FocusCard>
          );
        })}
      </View>

      <Text style={s.section}>{t('settings.uhr.title')}</Text>
      <Text style={s.hint}>{t('settings.uhr.hint')}</Text>
      <Text style={s.groupLabel}>{t('settings.uhr.stil')}</Text>
      <View style={s.row}>
        {UHR_STILE.map((stil) => {
          const active = stil === uhrStil;
          return (
            <FocusCard key={stil} onPress={() => setUhrStil(stil)} style={[s.stepWide, active && s.activeCard]}>
              <Text style={[s.toggleLabel, active && s.activeText]} numberOfLines={1}>
                {t(`settings.uhr.${stil}`)}
              </Text>
            </FocusCard>
          );
        })}
      </View>

      <Text style={s.groupLabel}>{t('settings.uhr.gewicht')}</Text>
      <View style={s.row}>
        {UHR_GEWICHTE.map((g) => {
          const active = g === uhrGewicht;
          return (
            <FocusCard key={g} onPress={() => setUhrGewicht(g)} style={[s.stepWide, active && s.activeCard]}>
              <Text style={[s.toggleLabel, active && s.activeText]} numberOfLines={1}>
                {t(`settings.uhr.${g}`)}
              </Text>
            </FocusCard>
          );
        })}
      </View>

      <Text style={s.groupLabel}>{t('settings.clockScale.title')}</Text>
      <View style={s.row}>
        {CLOCK_SCALES.map((v, i) => {
          const active = clockScale === v;
          return (
            <FocusCard
              key={v}
              onPress={() => setClockScale(v)}
              style={[s.stepWide, active && s.activeCard]}>
              <Text style={[s.toggleLabel, active && s.activeText]} numberOfLines={1}>
                {t(`settings.clockScale.${['small', 'medium', 'large', 'xlarge'][i]}`)}
              </Text>
            </FocusCard>
          );
        })}
      </View>

      <Text style={s.section}>{t('settings.screensaverContent')}</Text>
      <View style={s.row}>
        {(
          [
            [uhrSekunden, setUhrSekunden, 'settings.uhr.sekunden'],
            [versDesTagesAktiv, setVersDesTagesAktiv, 'settings.versDesTages'],
            [jumuaModusAktiv, setJumuaModusAktiv, 'settings.jumuaModus'],
            [wetterAktiv, setWetterAktiv, 'settings.wetter'],
          ] as const
        ).map(([an, setter, labelKey]) => (
          <FocusCard
            key={labelKey}
            onPress={() => setter(!an)}
            style={[s.toggleCard, an && s.activeCard]}>
            <Text style={[s.toggleLabel, an && s.activeText]} numberOfLines={2}>
              {t(labelKey)}
            </Text>
            <Text style={[s.toggleState, an && s.activeText]}>{an ? '✓' : '—'}</Text>
          </FocusCard>
        ))}
      </View>

      {/* Bedienhinweise ausblenden. Nutzerwunsch 2026-08-16: ein Fernseher
          steht stundenlang im Raum, und Zeilen wie „OK oeffnet das Menue" oder
          „OK = Pause" sind beim ersten Mal noetig und danach nur noch Text auf
          einem Bild, das sonst nichts sagen will. Jede Taste holt sie zurueck.
          Ab Werk verschwindet nichts: wer die App nicht kennt, soll die
          Bedienung nicht suchen muessen. */}
      <Text style={s.section}>{t('settings.autoHide.title')}</Text>
      <Text style={s.hint}>{t('settings.autoHide.hint')}</Text>
      <View style={s.grid}>
        {AUSBLEND_ZEITEN.map((sek) => {
          const active = sek === bedienungAusblenden;
          return (
            <FocusCard
              key={sek}
              onPress={() => setBedienungAusblenden(sek)}
              style={[s.themeCard, active && s.activeCard]}>
              <Text style={[s.cardLabel, active && s.activeText]} numberOfLines={1}>
                {sek === 0 ? t('settings.autoHide.never') : t('settings.autoHide.after', { n: sek })}
              </Text>
            </FocusCard>
          );
        })}
      </View>
    </>
  );
}

/**
 * Hintergrund — gezeichnet oder ein Motiv.
 *
 * Der Bereich wurde am 2026-08-30 aus „Darstellung" herausgeloest: mit Fotos
 * und Videos sind es zu viele Kacheln fuer eine Seite, und jede zusaetzliche
 * Kachel ist mit der Fernbedienung ein Tastendruck.
 *
 * Ein Motiv wird beim Waehlen HERUNTERGELADEN und danach von der Platte
 * gespielt (der Grund steht in lib/hintergrundMedien.ts). Bis die Datei liegt,
 * steht schon das Standbild hinter der Uhr — es ist also nie ein leerer
 * Zustand zu sehen, nur ein noch nicht bewegter.
 */
function HintergrundSection({ s }: { s: Styles }) {
  const { hintergrund, hintergrundDimmung, fotoBewegung } = useTvSettings();
  const { t } = useTranslation();
  const { katalog, speicher } = useHintergrundMedien();
  const [fehler, setFehler] = useState(false);
  // Fortschritt je Motiv (0…1), nur waehrend des Ladens gesetzt.
  const [laedt, setLaedt] = useState<Record<string, number>>({});

  useEffect(() => {
    let lebt = true;
    fetchHintergrundMedien().catch(() => {
      if (lebt) setFehler(true);
    });
    return () => {
      lebt = false;
    };
  }, []);

  async function waehlen(m: HintergrundMedium) {
    setFehler(false);
    // ZUERST setzen, dann laden: der Nutzer soll sofort sehen, dass seine Wahl
    // angekommen ist — das Standbild steht ja schon.
    setHintergrund(medienId(m.id));
    if (speicher[m.id]) return;
    setLaedt((v) => ({ ...v, [m.id]: 0 }));
    try {
      await mediumHerunterladen(m, (anteil) => setLaedt((v) => ({ ...v, [m.id]: anteil })));
    } catch {
      setFehler(true);
    } finally {
      setLaedt((v) => {
        const rest = { ...v };
        delete rest[m.id];
        return rest;
      });
    }
  }

  const fotos = katalog?.filter((m) => m.art === 'foto') ?? [];
  const videos = katalog?.filter((m) => m.art === 'video') ?? [];

  return (
    <>
      <Text style={s.section}>{t('settings.background.title')}</Text>
      <Text style={s.hint}>{t('settings.background.hint')}</Text>
      <Text style={s.groupLabel}>{t('settings.background.gezeichnet')}</Text>
      <View style={s.grid}>
        {HINTERGRUENDE.map((hg) => {
          const active = hg === hintergrund;
          return (
            <FocusCard
              key={hg}
              onPress={() => setHintergrund(hg)}
              style={[s.themeCard, active && s.activeCard]}>
              <Text style={[s.cardLabel, active && s.activeText]} numberOfLines={2}>
                {t(hintergrundNameKey(hg))}
              </Text>
            </FocusCard>
          );
        })}
      </View>

      <Text style={s.groupLabel}>{t('settings.background.videos')}</Text>
      {videos.length === 0 ? (
        <Text style={s.hint}>{fehler ? t('settings.background.ladeFehler') : t('common.loading')}</Text>
      ) : (
        <View style={s.grid}>
          {videos.map((m) => (
            <MediumKachel
              key={m.id}
              s={s}
              medium={m}
              aktiv={hintergrund === medienId(m.id)}
              gespeichert={!!speicher[m.id]}
              fortschritt={laedt[m.id]}
              onPress={() => void waehlen(m)}
            />
          ))}
        </View>
      )}

      <Text style={s.groupLabel}>{t('settings.background.fotos')}</Text>
      {fotos.length === 0 ? (
        <Text style={s.hint}>{fehler ? t('settings.background.ladeFehler') : t('common.loading')}</Text>
      ) : (
        <View style={s.grid}>
          {fotos.map((m) => (
            <MediumKachel
              key={m.id}
              s={s}
              medium={m}
              aktiv={hintergrund === medienId(m.id)}
              gespeichert={!!speicher[m.id]}
              fortschritt={laedt[m.id]}
              onPress={() => void waehlen(m)}
            />
          ))}
        </View>
      )}

      <Text style={s.section}>{t('settings.dimmung.title')}</Text>
      <Text style={s.hint}>{t('settings.dimmung.hint')}</Text>
      <View style={s.row}>
        {DIMMUNGEN.map((d, i) => {
          const active = d === hintergrundDimmung;
          return (
            <FocusCard
              key={d}
              onPress={() => setHintergrundDimmung(d)}
              style={[s.stepWide, active && s.activeCard]}>
              <Text style={[s.toggleLabel, active && s.activeText]} numberOfLines={1}>
                {t(`settings.dimmung.${['leicht', 'mittel', 'stark', 'sehrStark'][i]}`)}
              </Text>
            </FocusCard>
          );
        })}
      </View>

      <View style={s.row}>
        <FocusCard
          onPress={() => setFotoBewegung(!fotoBewegung)}
          style={[s.toggleCard, fotoBewegung && s.activeCard]}>
          <Text style={[s.toggleLabel, fotoBewegung && s.activeText]} numberOfLines={2}>
            {t('settings.fotoBewegung')}
          </Text>
          <Text style={[s.toggleState, fotoBewegung && s.activeText]}>{fotoBewegung ? '✓' : '—'}</Text>
        </FocusCard>
      </View>

      {/* Bildnachweis. Die Motive stehen unter freien Lizenzen (CC0, CC BY,
          CC BY-SA); CC BY verlangt die Nennung von Urheber und Lizenz, und die
          gehoert dorthin, wo der Nutzer die Bilder sieht — nicht in eine Datei
          im Quelltext. */}
      {katalog && katalog.length > 0 ? (
        <>
          <Text style={s.section}>{t('settings.background.nachweis')}</Text>
          {katalog.map((m) => (
            <View key={m.id} style={s.lizenzBlock}>
              <Text style={s.lizenzTitel}>{m.nameKey ? t(m.nameKey) : m.name}</Text>
              <Text style={s.lizenzZeile}>
                {[m.autor, m.lizenz, m.quelle].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ))}
        </>
      ) : null}
    </>
  );
}

/**
 * Eine Motiv-Kachel: Standbild, Name und der Speicherzustand.
 *
 * Das Standbild ist der Punkt — ein Name wie „Kaaba bei Nacht" sagt nichts
 * darueber, wie das Bild hinter der Uhr wirkt. Der Zustand steht als Zeichen
 * daneben: „↓" noch nicht geladen, Prozent waehrend des Ladens, „✓" auf dem
 * Geraet.
 */
function MediumKachel({
  s,
  medium,
  aktiv,
  gespeichert,
  fortschritt,
  onPress,
}: {
  s: Styles;
  medium: HintergrundMedium;
  aktiv: boolean;
  gespeichert: boolean;
  fortschritt?: number;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <FocusCard onPress={onPress} style={[s.medienCard, aktiv && s.activeCard]}>
      <Image source={{ uri: medium.posterUrl }} style={s.medienBild} contentFit="cover" transition={300} />
      <View style={s.medienZeile}>
        <Text style={[s.medienName, aktiv && s.activeText]} numberOfLines={1}>
          {medium.nameKey ? t(medium.nameKey) : medium.name}
        </Text>
        <Text style={[s.medienZustand, aktiv && s.activeText]}>
          {fortschritt !== undefined ? `${Math.round(fortschritt * 100)}%` : gespeichert ? '✓' : '↓'}
        </Text>
      </View>
    </FocusCard>
  );
}

/**
 * Koran-Leser — Schrift, Schriftgrad und was unter dem Vers steht.
 *
 * Die Schriftliste ist wortgleich die der Handy-App (`lib/quranFonts.ts` ist
 * eine geprüfte Spiegelkopie). Jede Kachel zeigt die Bismillah IN DER SCHRIFT,
 * um die es geht — ein Schriftname sagt nichts darüber, wie sie aussieht.
 */
function ReaderSection({ s }: { s: Styles }) {
  const { quranFont, quranSukun, readerScale, readerTranslit, readerTranslation, readerAutoAdvance } =
    useTvSettings();
  const { t } = useTranslation();
  // Alle Schriften, damit jede Kachel ihre EIGENE zeigt (s. useAllQuranFonts).
  const geladen = useAllQuranFonts();
  const aktiveSchrift = QURAN_FONTS.find((f) => f.id === quranFont);

  return (
    <>
      <Text style={s.section}>{t('settings.quranFont.title')}</Text>
      <Text style={s.hint}>{aktiveSchrift ? t(aktiveSchrift.hintKey) : ''}</Text>
      <View style={s.grid}>
        {QURAN_FONTS.map((f) => {
          const active = f.id === quranFont;
          return (
            <FocusCard
              key={f.id}
              onPress={() => setQuranFont(f.id)}
              style={[s.fontCard, active && s.activeCard]}>
              {/* Jede Kachel in IHRER Schrift und mit IHRER Kodierung: die
                  KFGQPC-Ausgabe schreibt dieselben Zeichen anders als
                  api.quran.com, und nur so zeigt die Vorschau wirklich, was
                  der Vers spaeter zeichnet. Solange eine Schrift noch laedt,
                  steht dort die Systemschrift statt einer leeren Kachel. */}
              <Text
                style={[s.fontPreview, geladen.has(f.id) ? { fontFamily: f.family } : null]}
                numberOfLines={1}>
                {adaptQuranText(BISMILLAH, f, quranSukun)}
              </Text>
              <Text style={[s.fontName, active && s.activeText]} numberOfLines={2}>
                {f.name}
              </Text>
            </FocusCard>
          );
        })}
      </View>

      {/* Nur sinnvoll, solange eine Schrift mit KFGQPC-Kodierung gewaehlt ist —
          alle anderen zeichnen ihr Sukun ohnehin selbst. Deshalb steht die
          Einstellung nur dann da; sonst waere sie ein Schalter ohne Wirkung. */}
      {aktiveSchrift?.textEncoding === 'kfgqpc' ? (
        <>
          <Text style={s.section}>{t('settings.sukun.title')}</Text>
          <Text style={s.hint}>{t('settings.sukun.hint')}</Text>
          <View style={s.row}>
            {(['madina', 'kreis'] as const).map((v) => {
              const active = quranSukun === v;
              return (
                <FocusCard
                  key={v}
                  onPress={() => setQuranSukun(v)}
                  style={[s.toggleCard, active && s.activeCard]}>
                  <Text style={[s.toggleLabel, active && s.activeText]} numberOfLines={2}>
                    {t(`settings.sukun.${v}`)}
                  </Text>
                </FocusCard>
              );
            })}
          </View>
        </>
      ) : null}

      <Text style={s.section}>{t('settings.readerScale.title')}</Text>
      <View style={s.row}>
        {READER_SCALES.map((v, i) => {
          const active = readerScale === v;
          return (
            <FocusCard
              key={v}
              onPress={() => setReaderScale(v)}
              style={[s.stepWide, active && s.activeCard]}>
              <Text style={[s.toggleLabel, active && s.activeText]} numberOfLines={1}>
                {t(`settings.readerScale.${['small', 'medium', 'large', 'xlarge'][i]}`)}
              </Text>
            </FocusCard>
          );
        })}
      </View>

      <Text style={s.section}>{t('settings.readerContent')}</Text>
      <View style={s.row}>
        {(
          [
            ['readerTranslit', readerTranslit, 'settings.readerTranslit'],
            ['readerTranslation', readerTranslation, 'settings.readerTranslation'],
            ['readerAutoAdvance', readerAutoAdvance, 'settings.readerAutoAdvance'],
          ] as const
        ).map(([key, an, labelKey]) => (
          <FocusCard
            key={key}
            onPress={() => toggleReaderOption(key)}
            style={[s.toggleCard, an && s.activeCard]}>
            <Text style={[s.toggleLabel, an && s.activeText]} numberOfLines={2}>
              {t(labelKey)}
            </Text>
            {/* Zeichen statt Wort: „An"/„Aus" haette 14 weitere Uebersetzungen
                gebraucht und ist aus drei Metern schlechter zu erfassen als ein
                Haken. Die Karte ist zusaetzlich eingefaerbt, wenn der Schalter
                an ist — die Aussage haengt also nicht am Zeichen allein. */}
            <Text style={[s.toggleState, an && s.activeText]}>{an ? '✓' : '—'}</Text>
          </FocusCard>
        ))}
      </View>
    </>
  );
}

/**
 * Speicher — gespeicherte Rezitationen ansehen und wieder loswerden.
 *
 * Ohne diesen Bereich waere das Herunterladen eine Einbahnstrasse: Wer zwanzig
 * Suren gespeichert hat, muesste jede einzeln im Rezitatoren-Bereich
 * wiederfinden, um Platz zu schaffen. Auf einem Fernseher mit 8 GB internem
 * Speicher ist das keine Kleinigkeit.
 */
function StorageSection({ s }: { s: Styles }) {
  const { t } = useTranslation();
  useOfflineAudio();
  const liste = gespeicherteListe();
  const { anzahl, bytes } = belegung();
  // Hintergrund-Motive belegen denselben Speicher und gehoeren deshalb in
  // dieselbe Uebersicht — sonst waere ein voller Fernseher nicht erklaerbar.
  const { katalog } = useHintergrundMedien();
  const medien = medienBelegung();

  return (
    <>
      <Text style={s.section}>{t('settings.storage.title')}</Text>
      <Text style={s.hint}>{t('settings.storage.hint')}</Text>
      <Text style={s.current}>
        {anzahl === 0
          ? t('settings.storage.empty')
          : anzahl === 1
            ? // „1 Suren" ist in jeder Sprache falsch; die Einzahl steht eigens da.
              t('settings.storage.usedOne', { size: formatBytes(bytes) })
            : t('settings.storage.used', { n: String(anzahl), size: formatBytes(bytes) })}
      </Text>

      {liste.length > 0 ? (
        <>
          <View style={s.grid}>
            {liste.map((e) => (
              <FocusCard
                key={`${e.reciterId}|${e.surah}`}
                onPress={() => void sureLoeschen(e.reciterId, e.surah)}
                style={s.wideCard}>
                <Text style={s.cardLabel} numberOfLines={1}>
                  {e.surah}. {SURAHS.find((x) => x.n === e.surah)?.en ?? ''}
                </Text>
                <Text style={s.toggleState} numberOfLines={1}>
                  {e.reciterName} · {formatBytes(e.bytes)} · {t('settings.storage.deleteHint')}
                </Text>
              </FocusCard>
            ))}
          </View>
          <View style={s.row}>
            <FocusCard onPress={() => void alleLoeschen()} style={s.toggleCard}>
              <Text style={s.toggleLabel} numberOfLines={2}>
                {t('settings.storage.deleteAll')}
              </Text>
            </FocusCard>
          </View>
        </>
      ) : null}

      <Text style={s.section}>{t('settings.storage.motive')}</Text>
      <Text style={s.current}>
        {medien.anzahl === 0
          ? t('settings.storage.motiveLeer')
          : t('settings.storage.motiveBelegt', {
              n: String(medien.anzahl),
              size: formatBytes(medien.bytes),
            })}
      </Text>
      {medien.anzahl > 0 && katalog ? (
        <View style={s.grid}>
          {katalog
            .filter((m) => istMediumGespeichert(m.id))
            .map((m) => (
              <FocusCard key={m.id} onPress={() => void mediumLoeschen(m)} style={s.wideCard}>
                <Text style={s.cardLabel} numberOfLines={1}>
                  {m.nameKey ? t(m.nameKey) : m.name}
                </Text>
                <Text style={s.toggleState} numberOfLines={1}>
                  {t(`settings.background.${m.art}`)} · {t('settings.storage.deleteHint')}
                </Text>
              </FocusCard>
            ))}
        </View>
      ) : null}
    </>
  );
}

/** Dichte-relative Styles (Audit 2026-07-28, T12): vorher fest
 *  `paddingHorizontal: 56`, Titel `fontSize: 40` und Karten `200×72`. Die
 *  Spaltenzahl kommt aus der echten dp-Breite, mit derselben −1-dp-Marge
 *  gegen Sub-Pixel-Umbruch wie in HomeScreen/RecitersScreen — jetzt bezogen auf
 *  die Breite des INHALTSBEREICHS, nicht mehr auf den ganzen Bildschirm. */
function makeStyles(w: number, h: number, rtl: boolean, theme: Theme) {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const padH = clamp(w * 0.04, 24, 64);
  const gap = clamp(w * 0.011, 10, 18);
  const align = rtl ? ('right' as const) : ('left' as const);
  // Die Bereichsspalte bekommt einen festen Anteil; der Rest ist Inhalt.
  //
  // `- gap` zweimal: einmal fuer den Abstand zwischen Spalte und Inhalt, einmal
  // fuer den Innenabstand des Inhaltsbereichs selbst (`paneContent`, gap/2 je
  // Seite). Ohne den zweiten Abzug rechnete die Spaltenzahl mit rund 10 dp mehr
  // Platz, als wirklich da war — die dritte Kachel passte rechnerisch und brach
  // am Bildschirm um, sodass statt drei nur zwei Spalten standen
  // (Bildschirmbefund 2026-08-08).
  const railW = clamp(w * 0.2, 150, 320);
  const paneW = w - railW - padH * 2 - gap * 2;
  const cols = paneW >= 1000 ? 5 : paneW >= 700 ? 4 : 3;
  const cardW = Math.floor((paneW - gap * (cols - 1)) / cols) - 1;
  const cardH = clamp(h * 0.13, 56, 90);
  // Gebetsruf-Zeile: Name + vier Wahlkacheln + Probehoeren, alles nebeneinander.
  const azanGap = clamp(gap * 0.6, 6, 12);
  const azanNameW = clamp(paneW * 0.16, 80, 210);
  const azanW = Math.floor((paneW - gap - azanNameW - azanGap * 5) / 5) - 1;
  // Die breiteste Karte im Bereich ist die volle Bahn (paneW - gap); danach
  // richtet sich der Ausgleich, damit auch ihr Rahmen ganz zu sehen ist.
  const ueber = fokusUeberstand(paneW);
  return StyleSheet.create({
    root: {
      flex: 1,
      flexDirection: rtl ? 'row-reverse' : 'row',
      paddingHorizontal: padH,
      paddingVertical: clamp(h * 0.045, 18, 44),
      gap,
    },
    rail: { width: railW, gap: clamp(h * 0.014, 6, 12) },
    railCard: {
      minHeight: clamp(h * 0.1, 44, 72),
      paddingHorizontal: clamp(railW * 0.09, 12, 22),
      paddingVertical: clamp(h * 0.014, 6, 12),
      justifyContent: 'center',
    },
    railLabel: { color: theme.text, fontSize: clamp(h * 0.03, 14, 24), fontWeight: '600', textAlign: align },
    railHint: {
      color: theme.textFaint,
      fontSize: clamp(h * 0.022, 11, 17),
      lineHeight: clamp(h * 0.032, 15, 24),
      marginTop: clamp(h * 0.02, 8, 16),
      textAlign: align,
    },
    pane: { flex: 1, marginHorizontal: -ueber, marginVertical: -ueber },
    paneContent: {
      paddingTop: ueber,
      paddingBottom: clamp(h * 0.06, 24, 60) + ueber,
      paddingHorizontal: gap / 2 + ueber,
    },
    title: {
      color: theme.accent,
      fontSize: clamp(h * 0.045, 22, 40),
      fontWeight: '800',
      letterSpacing: rtl ? 0 : 2,
      marginBottom: clamp(h * 0.024, 10, 22),
      textAlign: align,
    },
    section: {
      color: theme.text,
      fontSize: clamp(h * 0.033, 18, 28),
      fontWeight: '700',
      marginTop: clamp(h * 0.03, 12, 28),
      marginBottom: clamp(h * 0.012, 6, 12),
      textAlign: align,
    },
    groupLabel: {
      color: theme.textFaint,
      fontSize: clamp(h * 0.024, 12, 19),
      fontWeight: '600',
      letterSpacing: rtl ? 0 : 1,
      textTransform: 'uppercase',
      marginTop: clamp(h * 0.02, 8, 18),
      marginBottom: clamp(h * 0.01, 4, 10),
      textAlign: align,
    },
    current: {
      color: theme.textMuted,
      fontSize: clamp(h * 0.026, 14, 22),
      marginBottom: clamp(h * 0.016, 8, 16),
      textAlign: align,
    },
    hint: {
      color: theme.textFaint,
      fontSize: clamp(h * 0.022, 12, 18),
      lineHeight: clamp(h * 0.032, 17, 26),
      marginBottom: clamp(h * 0.016, 8, 16),
      textAlign: align,
    },
    grid: { flexDirection: rtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap },
    row: { flexDirection: rtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap },
    // Methoden- und Regel-Namen sind Eigennamen und brauchen mehr Platz als
    // eine Stadt („Egyptian General Authority" passt in keine Stadt-Kachel).
    wideCard: {
      width: cardW * 2 + gap,
      minHeight: cardH,
      paddingHorizontal: clamp(cardW * 0.06, 12, 20),
      paddingVertical: clamp(cardH * 0.12, 6, 12),
      justifyContent: 'center',
    },
    // Eine Zeile je Gebet: Name, vier Wahlkacheln, Probehoeren. Die Kacheln
    // teilen sich die Restbreite des Inhaltsbereichs zu gleichen Teilen —
    // sonst braeche die fuenfte auf einem 720p-Fernseher um.
    azanRow: {
      width: paneW - gap,
      minHeight: cardH,
      flexDirection: rtl ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: azanGap,
      marginBottom: clamp(h * 0.008, 4, 10),
    },
    azanName: { color: theme.text, fontSize: clamp(cardH * 0.26, 13, 21), width: azanNameW, textAlign: align },
    azanChoice: {
      width: azanW,
      minHeight: clamp(cardH * 0.82, 44, 74),
      paddingHorizontal: clamp(azanW * 0.06, 6, 14),
      alignItems: 'center',
      justifyContent: 'center',
    },
    azanChoiceLabel: { color: theme.text, fontSize: clamp(cardH * 0.22, 11, 18), fontWeight: '600', textAlign: 'center' },
    azanChoiceOff: { color: theme.textFaint },
    lizenzBlock: { marginBottom: clamp(h * 0.018, 8, 18) },
    lizenzTitel: { color: theme.textMuted, fontSize: clamp(h * 0.024, 12, 19), fontWeight: '600', textAlign: align },
    lizenzZeile: { color: theme.textFaint, fontSize: clamp(h * 0.021, 11, 17), textAlign: align },
    offsetRow: {
      width: cardW * 2 + gap,
      minHeight: cardH,
      flexDirection: rtl ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: clamp(gap * 0.6, 6, 12),
    },
    offsetName: { color: theme.text, fontSize: clamp(cardH * 0.24, 13, 20), flex: 1, textAlign: align },
    offsetValue: {
      color: theme.accent,
      fontSize: clamp(cardH * 0.24, 13, 20),
      fontWeight: '700',
      minWidth: clamp(cardW * 0.42, 60, 110),
      textAlign: 'center',
    },
    stepCard: {
      width: clamp(cardH * 0.9, 48, 76),
      height: clamp(cardH * 0.7, 40, 62),
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepWide: {
      width: cardW,
      minHeight: cardH,
      paddingHorizontal: clamp(cardW * 0.08, 10, 18),
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepLabel: { color: theme.text, fontSize: clamp(cardH * 0.36, 18, 30), fontWeight: '800' },
    card: {
      width: cardW,
      height: cardH,
      paddingHorizontal: clamp(cardW * 0.09, 12, 20),
      justifyContent: 'center',
    },
    cardLabel: { color: theme.text, fontSize: clamp(cardH * 0.28, 14, 22), fontWeight: '600', textAlign: align },
    themeCard: {
      width: cardW,
      minHeight: cardH * 1.35,
      paddingHorizontal: clamp(cardW * 0.09, 12, 20),
      paddingVertical: clamp(cardH * 0.16, 8, 14),
      justifyContent: 'center',
      gap: clamp(cardH * 0.1, 5, 10),
    },
    swatchRow: { flexDirection: 'row', gap: 6 },
    akzentCard: {
      width: cardW,
      minHeight: cardH,
      paddingHorizontal: clamp(cardW * 0.08, 10, 18),
      flexDirection: rtl ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: clamp(cardW * 0.05, 8, 14),
    },
    akzentProbe: { width: clamp(cardH * 0.34, 18, 30), height: clamp(cardH * 0.34, 18, 30) },
    akzentLabel: { color: theme.text, fontSize: clamp(cardH * 0.24, 12, 19), fontWeight: '600', flexShrink: 1 },
    // Die Kachel eines Motivs ist im Wesentlichen sein Standbild: 16:9, damit
    // sie zeigt, was spaeter auch am Bildschirm steht. GENAU zwei je Reihe:
    // drei gewoehnliche Kacheln fuellen die Reihe, also ist die Haelfte davon
    // `1,5 × Kachel + halber Abstand`. Mit `1,6 ×` passte nur eine, und die
    // Kachel wurde dann zwei Drittel des Bildschirms hoch (Emulator-Befund).
    medienCard: {
      width: cardW * 1.5 + gap / 2,
      paddingBottom: clamp(cardH * 0.1, 6, 12),
      overflow: 'hidden',
    },
    medienBild: {
      width: '100%',
      height: ((cardW * 1.5 + gap / 2) * 9) / 16,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
    },
    medienZeile: {
      flexDirection: rtl ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingHorizontal: clamp(cardW * 0.07, 10, 18),
      paddingTop: clamp(cardH * 0.1, 6, 12),
    },
    medienName: { color: theme.text, fontSize: clamp(cardH * 0.24, 12, 19), fontWeight: '600', flexShrink: 1, textAlign: align },
    medienZustand: { color: theme.textFaint, fontSize: clamp(cardH * 0.24, 12, 19), fontWeight: '700' },
    swatch: { width: clamp(cardH * 0.24, 14, 22), height: clamp(cardH * 0.24, 14, 22), borderRadius: 999, borderWidth: 1 },
    fontCard: {
      width: cardW,
      minHeight: cardH * 1.5,
      paddingHorizontal: clamp(cardW * 0.08, 10, 18),
      paddingVertical: clamp(cardH * 0.16, 8, 14),
      justifyContent: 'center',
      gap: clamp(cardH * 0.08, 4, 8),
    },
    fontPreview: { color: theme.accent, fontSize: clamp(cardH * 0.42, 20, 34), textAlign: 'center' },
    fontName: { color: theme.textMuted, fontSize: clamp(cardH * 0.2, 11, 17), textAlign: 'center' },
    toggleCard: {
      width: cardW * 1.6 + gap,
      minHeight: cardH,
      paddingHorizontal: clamp(cardW * 0.09, 12, 22),
      paddingVertical: clamp(cardH * 0.14, 8, 14),
      justifyContent: 'center',
    },
    toggleLabel: { color: theme.text, fontSize: clamp(cardH * 0.26, 13, 20), fontWeight: '600', textAlign: align },
    toggleState: { color: theme.textFaint, fontSize: clamp(cardH * 0.22, 11, 17), marginTop: 2, textAlign: align },
    activeCard: { borderColor: theme.accent, borderWidth: 2, backgroundColor: theme.cardActive },
    activeText: { color: theme.accent },
  });
}
