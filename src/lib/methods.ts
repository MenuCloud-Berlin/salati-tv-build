// SPIEGELKOPIE von apps/mobile/src/features/settings/methods.ts.
//
// apps/tv ist ein eigenständiges pnpm-Projekt (eigenes Lockfile, eigener
// EAS-Build); ein Import über die App-Grenze wäre im Metro-Bundle nicht
// auflösbar. Deshalb liegt der Katalog hier als Kopie — und `methods.parity.
// test.ts` vergleicht beide Dateien Zeichen für Zeichen, damit die Kopie nicht
// still auseinanderläuft. NICHT einseitig ändern: erst die Handy-Datei, dann
// hierher kopieren.
//
// Katalog der Gebetszeit-Berechnungsmethoden.
//
// GRUNDSATZ: Eine "Berechnungsmethode" ist keine Geschmacksfrage, sondern die
// Festlegung EINER Behörde bzw. eines Verbandes — dieselbe, nach der die
// Moscheen des jeweiligen Landes ihre Kalender drucken. Deshalb steht hier zu
// jeder Methode, WER sie herausgibt, WELCHE Winkel sie festlegt und WO das
// veröffentlicht ist. Wer seine Zeiten sucht, soll sie an der Behörde
// wiedererkennen, nicht an einem Kürzel.
//
// Die IDs sind die der Aladhan-API (api.aladhan.com/v1/methods) — Salati holt
// die Zeiten primär dort und rechnet sie mit denselben Parametern lokal nach
// (features/prayer-times/calc.ts), damit die App offline dieselben Zeiten
// zeigt. Beide Pfade lesen die Winkel aus DIESER Datei; es gibt keine zweite,
// still abweichende Parameterliste mehr.
//
// Parameter zurückgelesen von api.aladhan.com/v1/methods am 2026-08-07 —
// nicht aus dem Gedächtnis geschrieben. Belege: docs/GEBETSZEITEN-QUELLEN.md.

/** Regionsgruppe für die Auswahl-Liste (Übersetzung: settings.methodRegions.*). */
export type MethodRegionId =
  | 'worldwide'
  | 'europe'
  | 'northAmerica'
  | 'arabia'
  | 'middleEast'
  | 'northAfrica'
  | 'southAsia'
  | 'southeastAsia';

/**
 * Wie eine Methode Ischa festlegt — entweder über den Sonnenstand (Winkel unter
 * dem Horizont) oder über ein festes Intervall nach Maghrib. Beides kommt in
 * der Praxis vor; Umm al-Qura z. B. rechnet 90 Minuten, im Ramadan 120.
 */
export type IshaRule = { kind: 'angle'; angle: number } | { kind: 'minutes'; minutes: number };

export interface PrayerMethod {
  /** Aladhan-Methoden-ID. Gleichzeitig der in den Einstellungen gespeicherte Wert. */
  id: number;
  /**
   * Eigenname der herausgebenden Stelle. BEWUSST NICHT ÜBERSETZT: „Diyanet
   * İşleri Başkanlığı" heißt in jeder Sprache so, und nur unter diesem Namen
   * findet man die Veröffentlichung wieder.
   */
  name: string;
  /** Kurzname für enge Zeilen (Widget, Übersicht). */
  shortName: string;
  region: MethodRegionId;
  /** Sonnenstand unter dem Horizont für Fadschr, in Grad. */
  fajrAngle: number;
  isha: IshaRule;
  /**
   * Maghrib als Winkel statt Sonnenuntergang — nur die schiitischen Methoden
   * (Dschafari/Teheran) setzen ihn, alle anderen nehmen den Sonnenuntergang.
   */
  maghribAngle?: number;
  /** Feste Minuten NACH Sonnenuntergang für Maghrib (Lissabon, Jordanien, Marokko). */
  maghribMinutes?: number;
  /**
   * Feste Minuten NACH dem Zenitdurchgang für Dhuhr — der klassische
   * Sicherheitszuschlag („temkin"/„ihtiyat"), den einige Behörden auf die
   * gedruckten Zeiten legen. Nicht in Aladhans /v1/methods ausgewiesen, aber
   * in den Antworten nachweisbar; belegt durch
   * features/prayer-times/methoden-abgleich.live.test.ts.
   */
  dhuhrMinutes?: number;
  /** Veröffentlichung, aus der die Parameter stammen. Steht im Info-Screen. */
  source: string;
  /**
   * Länder (ISO 3166-1 alpha-2), in denen diese Methode die amtliche bzw. die
   * von den großen Verbänden benutzte ist. Grundlage der Vorauswahl in
   * features/prayer-times/method-country.ts.
   */
  countries: string[];
  /**
   * true = Aladhan führt die Methode selbst als „experimental". Wird im UI
   * nicht versteckt (sie ist trotzdem die richtige für ihr Land), aber im
   * Info-Screen benannt — sonst wäre das eine verschwiegene Einschränkung.
   */
  experimental?: boolean;
}

/**
 * Alle Methoden, die die Aladhan-API kennt (außer 99 = „Custom", das keine
 * Parameter mitbringt). Reihenfolge = Anzeigereihenfolge innerhalb der Region.
 */
export const PRAYER_METHODS: readonly PrayerMethod[] = [
  {
    id: 13,
    name: 'Diyanet İşleri Başkanlığı',
    shortName: 'Diyanet',
    region: 'europe',
    fajrAngle: 18,
    isha: { kind: 'angle', angle: 17 },
    source: 'https://namazvakitleri.diyanet.gov.tr',
    // Deutschland/Österreich/Schweiz/Benelux/Frankreich: die türkischstämmigen
    // Gemeinden (DITIB, ATIB und die ihnen nahestehenden Verbände) stellen den
    // größten Teil der Moscheen und drucken die Diyanet-Kalender.
    countries: ['TR', 'DE', 'AT', 'CH', 'NL', 'BE', 'DK', 'SE', 'NO', 'BG', 'MK', 'XK', 'CY'],
    experimental: true,
  },
  {
    id: 3,
    name: 'Muslim World League',
    shortName: 'MWL',
    region: 'worldwide',
    fajrAngle: 18,
    isha: { kind: 'angle', angle: 17 },
    source: 'https://www.themwl.org',
    countries: ['GB', 'IE', 'IT', 'ES', 'PL', 'CZ', 'GR', 'RO', 'HU', 'AU', 'NZ', 'ZA'],
  },
  {
    id: 15,
    name: 'Moonsighting Committee Worldwide',
    shortName: 'Moonsighting',
    region: 'worldwide',
    // Die Methode rechnet nicht mit einem festen Winkel, sondern mit einer
    // jahreszeitlich korrigierten Kurve (Shafaq „general"). 18°/18° ist der
    // Ausgangswert, den adhan-js und Aladhan gleichermaßen benutzen.
    fajrAngle: 18,
    isha: { kind: 'angle', angle: 18 },
    source: 'https://www.moonsighting.com/how-we.html',
    countries: [],
  },
  {
    id: 2,
    name: 'Islamic Society of North America (ISNA)',
    shortName: 'ISNA',
    region: 'northAmerica',
    fajrAngle: 15,
    isha: { kind: 'angle', angle: 15 },
    source: 'https://www.isna.net',
    countries: ['US', 'CA'],
  },
  {
    id: 12,
    name: 'Union des Organisations Islamiques de France',
    shortName: 'UOIF',
    region: 'europe',
    fajrAngle: 12,
    isha: { kind: 'angle', angle: 12 },
    source: 'https://www.mosquee-lyon.org',
    countries: ['FR'],
  },
  {
    id: 22,
    name: 'Comunidade Islâmica de Lisboa',
    shortName: 'Lissabon',
    region: 'europe',
    fajrAngle: 18,
    isha: { kind: 'minutes', minutes: 77 },
    maghribMinutes: 3,
    dhuhrMinutes: 5,
    source: 'https://comunidadeislamica.pt',
    countries: ['PT'],
  },
  {
    id: 14,
    name: 'Geistliche Verwaltung der Muslime Russlands',
    shortName: 'Russland',
    region: 'europe',
    fajrAngle: 16,
    isha: { kind: 'angle', angle: 15 },
    source: 'https://dumrf.ru',
    countries: ['RU', 'KZ', 'KG', 'UZ', 'TJ', 'AZ'],
  },
  {
    id: 4,
    name: 'Umm al-Qura University, Makkah',
    shortName: 'Umm al-Qura',
    region: 'arabia',
    fajrAngle: 18.5,
    isha: { kind: 'minutes', minutes: 90 },
    source: 'https://www.ummulqura.org.sa',
    countries: ['SA'],
  },
  {
    id: 8,
    name: 'Gulf Region',
    shortName: 'Golfregion',
    region: 'arabia',
    fajrAngle: 19.5,
    isha: { kind: 'minutes', minutes: 90 },
    source: 'https://aladhan.com/calculation-methods',
    countries: ['BH', 'OM', 'YE'],
  },
  {
    id: 16,
    name: 'General Authority of Islamic Affairs & Endowments, Dubai',
    shortName: 'Dubai',
    region: 'arabia',
    fajrAngle: 18.2,
    isha: { kind: 'angle', angle: 18.2 },
    source: 'https://www.awqaf.gov.ae',
    countries: ['AE'],
    experimental: true,
  },
  {
    id: 9,
    name: 'Ministry of Awqaf and Islamic Affairs, Kuwait',
    shortName: 'Kuwait',
    region: 'arabia',
    fajrAngle: 18,
    isha: { kind: 'angle', angle: 17.5 },
    source: 'https://www.awqaf.gov.kw',
    countries: ['KW'],
  },
  {
    id: 10,
    name: 'Ministry of Endowments and Islamic Affairs, Qatar',
    shortName: 'Katar',
    region: 'arabia',
    fajrAngle: 18,
    isha: { kind: 'minutes', minutes: 90 },
    source: 'https://www.islam.gov.qa',
    countries: ['QA'],
  },
  {
    id: 23,
    name: 'Ministry of Awqaf, Islamic Affairs and Holy Places, Jordan',
    shortName: 'Jordanien',
    region: 'middleEast',
    fajrAngle: 18,
    isha: { kind: 'angle', angle: 18 },
    maghribMinutes: 5,
    source: 'https://www.awqaf.gov.jo',
    countries: ['JO', 'PS', 'SY', 'LB', 'IQ'],
  },
  {
    id: 7,
    name: 'Institute of Geophysics, University of Tehran',
    shortName: 'Teheran',
    region: 'middleEast',
    fajrAngle: 17.7,
    isha: { kind: 'angle', angle: 14 },
    maghribAngle: 4.5,
    source: 'https://geophysics.ut.ac.ir',
    countries: ['IR'],
  },
  {
    id: 0,
    name: 'Shia Ithna-Ashari, Leva Institute, Qum',
    shortName: 'Dschafari',
    region: 'middleEast',
    fajrAngle: 16,
    isha: { kind: 'angle', angle: 14 },
    maghribAngle: 4,
    source: 'https://aladhan.com/calculation-methods',
    countries: [],
  },
  {
    id: 5,
    name: 'Egyptian General Authority of Survey',
    shortName: 'Ägypten',
    region: 'northAfrica',
    fajrAngle: 19.5,
    isha: { kind: 'angle', angle: 17.5 },
    source: 'https://www.esa.gov.eg',
    countries: ['EG', 'SD', 'LY', 'SO', 'DJ', 'ER'],
  },
  {
    id: 21,
    name: 'Ministère des Habous et des Affaires Islamiques, Maroc',
    shortName: 'Marokko',
    region: 'northAfrica',
    fajrAngle: 19,
    isha: { kind: 'angle', angle: 17 },
    maghribMinutes: 5,
    dhuhrMinutes: 5,
    source: 'https://www.habous.gov.ma',
    countries: ['MA', 'EH'],
  },
  {
    id: 19,
    name: 'Ministère des Affaires Religieuses et des Wakfs, Algérie',
    shortName: 'Algerien',
    region: 'northAfrica',
    fajrAngle: 18,
    isha: { kind: 'angle', angle: 17 },
    source: 'https://www.marw.dz',
    countries: ['DZ'],
  },
  {
    id: 18,
    name: 'Ministère des Affaires Religieuses, Tunisie',
    shortName: 'Tunesien',
    region: 'northAfrica',
    fajrAngle: 18,
    isha: { kind: 'angle', angle: 18 },
    source: 'https://www.affaires-religieuses.tn',
    countries: ['TN'],
  },
  {
    id: 1,
    name: 'University of Islamic Sciences, Karachi',
    shortName: 'Karachi',
    region: 'southAsia',
    fajrAngle: 18,
    isha: { kind: 'angle', angle: 18 },
    source: 'https://uis.edu.pk',
    countries: ['PK', 'IN', 'BD', 'AF', 'LK', 'NP', 'MV'],
  },
  {
    id: 20,
    name: 'Kementerian Agama Republik Indonesia',
    shortName: 'Kemenag',
    region: 'southeastAsia',
    fajrAngle: 20,
    isha: { kind: 'angle', angle: 18 },
    source: 'https://bimasislam.kemenag.go.id',
    countries: ['ID'],
  },
  {
    id: 17,
    name: 'Jabatan Kemajuan Islam Malaysia (JAKIM)',
    shortName: 'JAKIM',
    region: 'southeastAsia',
    fajrAngle: 20,
    isha: { kind: 'angle', angle: 18 },
    source: 'https://www.islam.gov.my',
    countries: ['MY', 'BN'],
  },
  {
    id: 11,
    name: 'Majlis Ugama Islam Singapura (MUIS)',
    shortName: 'MUIS',
    region: 'southeastAsia',
    fajrAngle: 20,
    isha: { kind: 'angle', angle: 18 },
    source: 'https://www.muis.gov.sg',
    countries: ['SG'],
  },
] as const;

/** Voreinstellung, wenn kein Land bekannt ist (s. method-country.ts). */
export const DEFAULT_METHOD_ID = 13;

const BY_ID = new Map(PRAYER_METHODS.map((m) => [m.id, m]));

export function methodById(id: number): PrayerMethod | undefined {
  return BY_ID.get(id);
}

/** Anzeigename inklusive Fallback für IDs, die der Katalog (noch) nicht kennt. */
export function methodName(id: number): string {
  return BY_ID.get(id)?.name ?? `#${id}`;
}

export function methodShortName(id: number): string {
  return BY_ID.get(id)?.shortName ?? `#${id}`;
}

/**
 * Die Parameterzeile unter dem Namen, z. B. „Fadschr 18° · Ischa 17°" oder
 * „Fadschr 18,5° · Ischa 90 Min. nach Maghrib". Die Gebetsnamen kommen von
 * außen (i18n), damit diese Datei sprachfrei bleibt.
 */
export interface MethodLabels {
  fajr: string;
  isha: string;
  /** Muster mit `{n}`, z. B. „{n} Min. nach Maghrib". */
  minutesAfterMaghrib: string;
  /** Gradzeichen — in den meisten Sprachen „°". */
  degree: string;
  /** Dezimaltrennzeichen der Sprache („," im Deutschen, „." im Englischen). */
  decimal: string;
}

export function methodParamsLabel(m: PrayerMethod, labels: MethodLabels): string {
  const fajr = `${labels.fajr} ${formatDegrees(m.fajrAngle, labels)}`;
  const isha =
    m.isha.kind === 'angle'
      ? `${labels.isha} ${formatDegrees(m.isha.angle, labels)}`
      : `${labels.isha} ${labels.minutesAfterMaghrib.replace('{n}', String(m.isha.minutes))}`;
  return `${fajr} · ${isha}`;
}

/**
 * Gradzahl mit dem Dezimalzeichen der Sprache: `18` bleibt `18°`, `18.5` wird
 * im Deutschen zu `18,5°`. Bewusst NICHT über `toLocaleString()` — Hermes
 * liefert je nach Build unterschiedliche Ergebnisse, und ein Testlauf würde
 * dann etwas anderes prüfen als das Gerät zeigt.
 */
function formatDegrees(value: number, labels: MethodLabels): string {
  return `${String(value).replace('.', labels.decimal)}${labels.degree}`;
}

export const METHOD_REGION_ORDER: readonly MethodRegionId[] = [
  'worldwide',
  'europe',
  'northAmerica',
  'arabia',
  'middleEast',
  'northAfrica',
  'southAsia',
  'southeastAsia',
];

export const SCHOOLS = [
  { id: 0, name: 'Früher (Shafi/Maliki/Hanbali — Standard)' },
  { id: 1, name: 'Später (Hanafi)' },
] as const;

/**
 * Rückwärtskompatible Kurzform `{ id, name }` — apps/device und ältere
 * Call-Sites erwarten genau diese Form.
 */
export const METHODS = PRAYER_METHODS.map((m) => ({ id: m.id, name: m.name }));
