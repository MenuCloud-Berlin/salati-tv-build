import type { Locale } from '@/lib/locale';
import type { TvLocation } from '@/lib/prayerTimes';

// Voreingestellte Städte für die 10-Fuß-Auswahl (Tippen einer Adresse per
// Fernbedienung ist mühsam). Die genaueste Quelle bleibt die Kopplung mit dem
// Handy (GPS → exakte Koordinaten werden an den TV geschickt); diese Liste ist
// der Offline-/Standalone-Fallback. Methode je Region sinnvoll vorbelegt.
//
// Audit 2026-07-29 (P1): die Methode stand hier als adhan-js-NAME
// („Turkey", „UmmAlQura"), während die Handy-App mit Aladhan-IDs arbeitet.
// Jetzt beidseits dieselbe Kennung (13 = Diyanet, 4 = Umm al-Qura …), siehe
// `lib/prayerTimes.ts`. Zwei alte Namen hatten in der Handy-Liste gar keine
// Entsprechung und sind dort dokumentiert abgebildet: Dubai → 8 (Gulf Region),
// Teheran → 3 (MWL). Wer es anders will, stellt die Methode jetzt in den
// Einstellungen um — bis zu diesem Audit war sie fest an die Stadt gekoppelt.
//
// Audit 2026-07-28 (T16): die Liste war fest deutsch („Mekka", „Kairo",
// „Moskau") — in einer arabischen Oberfläche stand damit eine Spalte deutscher
// Exonyme. Jetzt trägt jede Stadt ihren Namen in allen 14 App-Sprachen.
//
// Woher die Schreibweisen kommen:
//  - Mekka, Medina und Jerusalem stehen wörtlich so, wie die Handy-App sie in
//    ihrem kuratierten Quiz-Bestand führt
//    (`apps/mobile/src/features/practice/trivia.json`, Fragen `prophet-birth-city`
//    und `qibla`) — bis hin zu den bewusst islamischen Formen
//    fa `بیت‌المقدس` / ms `Baitulmaqdis` für Jerusalem.
//    EINE Abweichung: Mekka/Medina heissen hier in en/id/ms `Makkah`/`Madinah`
//    statt `Mecca`/`Mekah`, weil die Handy-Sprachdateien selbst diese Form
//    benutzen (`study.courses.seerah.desc`: „from Makkah to Madinah") und weil
//    `DEFAULT_LOCATION.label` der TV-App seit jeher `Makkah` lautet.
//  - Alle übrigen Namen sind die übliche Exonym-Form der jeweiligen Sprache.
export interface City {
  /**
   * Stabiler Schlüssel. Er — und NICHT der Anzeigename — landet in den
   * persistierten Einstellungen: sonst stünde nach einem Sprachwechsel für
   * immer der Name in der alten Sprache im Speicher, und der Abgleich
   * „welche Kachel ist aktiv?" fiele aus.
   */
  id: string;
  /** Ortsname je App-Sprache. Vollständig — der Paritätstest erzwingt das. */
  labels: Record<Locale, string>;
  lat: number;
  lon: number;
  method: TvLocation['method'];
  /**
   * IANA-Zeitzone des Ortes (Audit-Befund P10/K5). Ohne sie zeigte der
   * Fernseher die richtigen Zeitpunkte in der FALSCHEN Zone: ein Geraet in
   * Berlin, eingestellt auf Makkah, las die Makkah-Zeiten in Berliner Zeit ab.
   */
  tz: string;
}

export const CITIES: City[] = [
  // ── Deutschsprachiger Raum (Diyanet ist für DE-Gemeinden gängig) ──────────
  {
    id: 'berlin',
    tz: 'Europe/Berlin',
    lat: 52.52,
    lon: 13.405,
    method: 13,
    labels: {
      de: 'Berlin', en: 'Berlin', tr: 'Berlin', ar: 'برلين', es: 'Berlín', fr: 'Berlin',
      id: 'Berlin', bn: 'বার্লিন', fa: 'برلین', ms: 'Berlin', ur: 'برلن', ru: 'Берлин',
      sw: 'Berlin', ps: 'برلین',
    },
  },
  {
    id: 'hamburg',
    tz: 'Europe/Berlin',
    lat: 53.5511,
    lon: 9.9937,
    method: 13,
    labels: {
      de: 'Hamburg', en: 'Hamburg', tr: 'Hamburg', ar: 'هامبورغ', es: 'Hamburgo', fr: 'Hambourg',
      id: 'Hamburg', bn: 'হামবুর্গ', fa: 'هامبورگ', ms: 'Hamburg', ur: 'ہیمبرگ', ru: 'Гамбург',
      sw: 'Hamburg', ps: 'هامبورګ',
    },
  },
  {
    id: 'muenchen',
    tz: 'Europe/Berlin',
    lat: 48.1351,
    lon: 11.582,
    method: 13,
    labels: {
      de: 'München', en: 'Munich', tr: 'Münih', ar: 'ميونخ', es: 'Múnich', fr: 'Munich',
      id: 'München', bn: 'মিউনিখ', fa: 'مونیخ', ms: 'Munich', ur: 'میونخ', ru: 'Мюнхен',
      sw: 'Munich', ps: 'میونخ',
    },
  },
  {
    id: 'koeln',
    tz: 'Europe/Berlin',
    lat: 50.9375,
    lon: 6.9603,
    method: 13,
    labels: {
      de: 'Köln', en: 'Cologne', tr: 'Köln', ar: 'كولونيا', es: 'Colonia', fr: 'Cologne',
      id: 'Köln', bn: 'কোলন', fa: 'کلن', ms: 'Cologne', ur: 'کولون', ru: 'Кёльн',
      sw: 'Cologne', ps: 'کلن',
    },
  },
  {
    id: 'frankfurt',
    tz: 'Europe/Berlin',
    lat: 50.1109,
    lon: 8.6821,
    method: 13,
    labels: {
      de: 'Frankfurt', en: 'Frankfurt', tr: 'Frankfurt', ar: 'فرانكفورت', es: 'Fráncfort',
      fr: 'Francfort', id: 'Frankfurt', bn: 'ফ্রাঙ্কফুর্ট', fa: 'فرانکفورت', ms: 'Frankfurt',
      ur: 'فرینکفرٹ', ru: 'Франкфурт', sw: 'Frankfurt', ps: 'فرانکفورت',
    },
  },
  {
    id: 'stuttgart',
    tz: 'Europe/Berlin',
    lat: 48.7758,
    lon: 9.1829,
    method: 13,
    labels: {
      de: 'Stuttgart', en: 'Stuttgart', tr: 'Stuttgart', ar: 'شتوتغارت', es: 'Stuttgart',
      fr: 'Stuttgart', id: 'Stuttgart', bn: 'স্টুটগার্ট', fa: 'اشتوتگارت', ms: 'Stuttgart',
      ur: 'شٹٹگارٹ', ru: 'Штутгарт', sw: 'Stuttgart', ps: 'شتوتګارت',
    },
  },
  {
    id: 'duesseldorf',
    tz: 'Europe/Berlin',
    lat: 51.2277,
    lon: 6.7735,
    method: 13,
    labels: {
      de: 'Düsseldorf', en: 'Düsseldorf', tr: 'Düsseldorf', ar: 'دوسلدورف', es: 'Düsseldorf',
      fr: 'Düsseldorf', id: 'Düsseldorf', bn: 'ডুসেলডর্ফ', fa: 'دوسلدورف', ms: 'Düsseldorf',
      ur: 'ڈسلڈورف', ru: 'Дюссельдорф', sw: 'Düsseldorf', ps: 'دوسلدورف',
    },
  },
  {
    id: 'wien',
    tz: 'Europe/Vienna',
    lat: 48.2082,
    lon: 16.3738,
    method: 13,
    labels: {
      de: 'Wien', en: 'Vienna', tr: 'Viyana', ar: 'فيينا', es: 'Viena', fr: 'Vienne',
      id: 'Wina', bn: 'ভিয়েনা', fa: 'وین', ms: 'Vienna', ur: 'ویانا', ru: 'Вена',
      sw: 'Vienna', ps: 'ویانا',
    },
  },
  {
    id: 'zuerich',
    tz: 'Europe/Zurich',
    lat: 47.3769,
    lon: 8.5417,
    method: 3,
    labels: {
      de: 'Zürich', en: 'Zurich', tr: 'Zürih', ar: 'زيورخ', es: 'Zúrich', fr: 'Zurich',
      id: 'Zurich', bn: 'জুরিখ', fa: 'زوریخ', ms: 'Zurich', ur: 'زیورخ', ru: 'Цюрих',
      sw: 'Zurich', ps: 'زیوریخ',
    },
  },

  // ── Europa ────────────────────────────────────────────────────────────────
  {
    id: 'london',
    tz: 'Europe/London',
    lat: 51.5072,
    lon: -0.1276,
    method: 3,
    labels: {
      de: 'London', en: 'London', tr: 'Londra', ar: 'لندن', es: 'Londres', fr: 'Londres',
      id: 'London', bn: 'লন্ডন', fa: 'لندن', ms: 'London', ur: 'لندن', ru: 'Лондон',
      sw: 'London', ps: 'لندن',
    },
  },
  {
    id: 'paris',
    tz: 'Europe/Paris',
    lat: 48.8566,
    lon: 2.3522,
    method: 3,
    labels: {
      de: 'Paris', en: 'Paris', tr: 'Paris', ar: 'باريس', es: 'París', fr: 'Paris',
      id: 'Paris', bn: 'প্যারিস', fa: 'پاریس', ms: 'Paris', ur: 'پیرس', ru: 'Париж',
      sw: 'Paris', ps: 'پاریس',
    },
  },
  {
    id: 'amsterdam',
    tz: 'Europe/Amsterdam',
    lat: 52.3676,
    lon: 4.9041,
    method: 3,
    labels: {
      de: 'Amsterdam', en: 'Amsterdam', tr: 'Amsterdam', ar: 'أمستردام', es: 'Ámsterdam',
      fr: 'Amsterdam', id: 'Amsterdam', bn: 'আমস্টারডাম', fa: 'آمستردام', ms: 'Amsterdam',
      ur: 'ایمسٹرڈیم', ru: 'Амстердам', sw: 'Amsterdam', ps: 'امستردام',
    },
  },
  {
    id: 'bruessel',
    tz: 'Europe/Brussels',
    lat: 50.8503,
    lon: 4.3517,
    method: 3,
    labels: {
      de: 'Brüssel', en: 'Brussels', tr: 'Brüksel', ar: 'بروكسل', es: 'Bruselas',
      fr: 'Bruxelles', id: 'Brussel', bn: 'ব্রাসেলস', fa: 'بروکسل', ms: 'Brussels',
      ur: 'برسلز', ru: 'Брюссель', sw: 'Brussels', ps: 'بروکسل',
    },
  },
  {
    id: 'stockholm',
    tz: 'Europe/Stockholm',
    lat: 59.3293,
    lon: 18.0686,
    method: 3,
    labels: {
      de: 'Stockholm', en: 'Stockholm', tr: 'Stockholm', ar: 'ستوكهولم', es: 'Estocolmo',
      fr: 'Stockholm', id: 'Stockholm', bn: 'স্টকহোম', fa: 'استکهلم', ms: 'Stockholm',
      ur: 'اسٹاک ہوم', ru: 'Стокгольм', sw: 'Stockholm', ps: 'ستاکهولم',
    },
  },
  {
    id: 'madrid',
    tz: 'Europe/Madrid',
    lat: 40.4168,
    lon: -3.7038,
    method: 3,
    labels: {
      de: 'Madrid', en: 'Madrid', tr: 'Madrid', ar: 'مدريد', es: 'Madrid', fr: 'Madrid',
      id: 'Madrid', bn: 'মাদ্রিদ', fa: 'مادرید', ms: 'Madrid', ur: 'میڈرڈ', ru: 'Мадрид',
      sw: 'Madrid', ps: 'مادرید',
    },
  },
  {
    id: 'rom',
    tz: 'Europe/Rome',
    lat: 41.9028,
    lon: 12.4964,
    method: 3,
    labels: {
      de: 'Rom', en: 'Rome', tr: 'Roma', ar: 'روما', es: 'Roma', fr: 'Rome',
      id: 'Roma', bn: 'রোম', fa: 'رم', ms: 'Rom', ur: 'روم', ru: 'Рим',
      sw: 'Roma', ps: 'روم',
    },
  },
  {
    id: 'istanbul',
    tz: 'Europe/Istanbul',
    lat: 41.0082,
    lon: 28.9784,
    method: 13,
    labels: {
      de: 'Istanbul', en: 'Istanbul', tr: 'İstanbul', ar: 'إسطنبول', es: 'Estambul',
      fr: 'Istanbul', id: 'Istanbul', bn: 'ইস্তাম্বুল', fa: 'استانبول', ms: 'Istanbul',
      ur: 'استنبول', ru: 'Стамбул', sw: 'Istanbul', ps: 'استانبول',
    },
  },
  {
    id: 'sarajevo',
    tz: 'Europe/Sarajevo',
    lat: 43.8563,
    lon: 18.4131,
    method: 13,
    labels: {
      de: 'Sarajevo', en: 'Sarajevo', tr: 'Saraybosna', ar: 'سراييفو', es: 'Sarajevo',
      fr: 'Sarajevo', id: 'Sarajevo', bn: 'সারায়েভো', fa: 'سارایوو', ms: 'Sarajevo',
      ur: 'سرائیوو', ru: 'Сараево', sw: 'Sarajevo', ps: 'سرايوو',
    },
  },
  {
    id: 'moskau',
    tz: 'Europe/Moscow',
    lat: 55.7558,
    lon: 37.6173,
    method: 3,
    labels: {
      de: 'Moskau', en: 'Moscow', tr: 'Moskova', ar: 'موسكو', es: 'Moscú', fr: 'Moscou',
      id: 'Moskwa', bn: 'মস্কো', fa: 'مسکو', ms: 'Moscow', ur: 'ماسکو', ru: 'Москва',
      sw: 'Moscow', ps: 'مسکو',
    },
  },

  // ── Naher Osten / Nordafrika ──────────────────────────────────────────────
  {
    id: 'makkah',
    tz: 'Asia/Riyadh',
    lat: 21.4225,
    lon: 39.8262,
    method: 4,
    labels: {
      de: 'Mekka', en: 'Makkah', tr: 'Mekke', ar: 'مكة', es: 'La Meca', fr: 'La Mecque',
      id: 'Makkah', bn: 'মক্কা', fa: 'مکه', ms: 'Makkah', ur: 'مکہ', ru: 'Мекка',
      sw: 'Makka', ps: 'مکه',
    },
  },
  {
    id: 'madinah',
    tz: 'Asia/Riyadh',
    lat: 24.4709,
    lon: 39.6142,
    method: 4,
    labels: {
      de: 'Medina', en: 'Madinah', tr: 'Medine', ar: 'المدينة', es: 'Medina', fr: 'Médine',
      id: 'Madinah', bn: 'মদিনা', fa: 'مدینه', ms: 'Madinah', ur: 'مدینہ', ru: 'Медина',
      sw: 'Madina', ps: 'مدینه',
    },
  },
  {
    id: 'riad',
    tz: 'Asia/Riyadh',
    lat: 24.7136,
    lon: 46.6753,
    method: 4,
    labels: {
      de: 'Riad', en: 'Riyadh', tr: 'Riyad', ar: 'الرياض', es: 'Riad', fr: 'Riyad',
      id: 'Riyadh', bn: 'রিয়াদ', fa: 'ریاض', ms: 'Riyadh', ur: 'ریاض', ru: 'Эр-Рияд',
      sw: 'Riyadh', ps: 'ریاض',
    },
  },
  {
    id: 'dubai',
    tz: 'Asia/Dubai',
    lat: 25.2048,
    lon: 55.2708,
    method: 8,
    labels: {
      de: 'Dubai', en: 'Dubai', tr: 'Dubai', ar: 'دبي', es: 'Dubái', fr: 'Dubaï',
      id: 'Dubai', bn: 'দুবাই', fa: 'دبی', ms: 'Dubai', ur: 'دبئی', ru: 'Дубай',
      sw: 'Dubai', ps: 'دوبۍ',
    },
  },
  {
    id: 'kairo',
    tz: 'Africa/Cairo',
    lat: 30.0444,
    lon: 31.2357,
    method: 5,
    labels: {
      de: 'Kairo', en: 'Cairo', tr: 'Kahire', ar: 'القاهرة', es: 'El Cairo', fr: 'Le Caire',
      id: 'Kairo', bn: 'কায়রো', fa: 'قاهره', ms: 'Kaherah', ur: 'قاہرہ', ru: 'Каир',
      sw: 'Kairo', ps: 'قاهره',
    },
  },
  {
    id: 'istanbul-asien',
    tz: 'Europe/Istanbul',
    lat: 40.9923,
    lon: 29.0275,
    method: 13,
    labels: {
      de: 'Istanbul (Asien)', en: 'Istanbul (Asia)', tr: 'İstanbul (Anadolu)',
      ar: 'إسطنبول (آسيا)', es: 'Estambul (Asia)', fr: 'Istanbul (Asie)',
      id: 'Istanbul (Asia)', bn: 'ইস্তাম্বুল (এশিয়া)', fa: 'استانبول (آسیا)',
      ms: 'Istanbul (Asia)', ur: 'استنبول (ایشیا)', ru: 'Стамбул (Азия)',
      sw: 'Istanbul (Asia)', ps: 'استانبول (آسیا)',
    },
  },
  {
    id: 'jerusalem',
    tz: 'Asia/Jerusalem',
    lat: 31.7683,
    lon: 35.2137,
    method: 3,
    labels: {
      de: 'Jerusalem', en: 'Jerusalem', tr: 'Kudüs', ar: 'القدس', es: 'Jerusalén',
      fr: 'Jérusalem', id: 'Yerusalem', bn: 'জেরুজালেম', fa: 'بیت‌المقدس',
      ms: 'Baitulmaqdis', ur: 'یروشلم', ru: 'Иерусалим', sw: 'Yerusalemu',
      ps: 'بیت المقدس',
    },
  },
  {
    id: 'doha',
    tz: 'Asia/Qatar',
    lat: 25.2854,
    lon: 51.531,
    method: 10,
    labels: {
      de: 'Doha', en: 'Doha', tr: 'Doha', ar: 'الدوحة', es: 'Doha', fr: 'Doha',
      id: 'Doha', bn: 'দোহা', fa: 'دوحه', ms: 'Doha', ur: 'دوحہ', ru: 'Доха',
      sw: 'Doha', ps: 'دوحه',
    },
  },
  {
    id: 'kuwait',
    tz: 'Asia/Kuwait',
    lat: 29.3759,
    lon: 47.9774,
    method: 9,
    labels: {
      de: 'Kuwait', en: 'Kuwait City', tr: 'Kuveyt', ar: 'الكويت', es: 'Kuwait',
      fr: 'Koweït', id: 'Kuwait', bn: 'কুয়েত সিটি', fa: 'کویت', ms: 'Kuwait',
      ur: 'کویت', ru: 'Эль-Кувейт', sw: 'Kuwait', ps: 'کویت',
    },
  },
  {
    id: 'teheran',
    tz: 'Asia/Tehran',
    lat: 35.6892,
    lon: 51.389,
    method: 3,
    labels: {
      de: 'Teheran', en: 'Tehran', tr: 'Tahran', ar: 'طهران', es: 'Teherán', fr: 'Téhéran',
      id: 'Teheran', bn: 'তেহরান', fa: 'تهران', ms: 'Tehran', ur: 'تہران', ru: 'Тегеран',
      sw: 'Tehran', ps: 'تهران',
    },
  },
  {
    id: 'casablanca',
    tz: 'Africa/Casablanca',
    lat: 33.5731,
    lon: -7.5898,
    method: 15,
    labels: {
      de: 'Casablanca', en: 'Casablanca', tr: 'Kazablanka', ar: 'الدار البيضاء',
      es: 'Casablanca', fr: 'Casablanca', id: 'Casablanca', bn: 'কাসাব্লাঙ্কা',
      fa: 'کازابلانکا', ms: 'Casablanca', ur: 'کاسابلانکا', ru: 'Касабланка',
      sw: 'Casablanca', ps: 'کازابلانکا',
    },
  },

  // ── Süd-/Südostasien ──────────────────────────────────────────────────────
  {
    id: 'karatschi',
    tz: 'Asia/Karachi',
    lat: 24.8607,
    lon: 67.0011,
    method: 1,
    labels: {
      de: 'Karatschi', en: 'Karachi', tr: 'Karaçi', ar: 'كراتشي', es: 'Karachi',
      fr: 'Karachi', id: 'Karachi', bn: 'করাচি', fa: 'کراچی', ms: 'Karachi',
      ur: 'کراچی', ru: 'Карачи', sw: 'Karachi', ps: 'کراچي',
    },
  },
  {
    id: 'lahore',
    tz: 'Asia/Karachi',
    lat: 31.5204,
    lon: 74.3587,
    method: 1,
    labels: {
      de: 'Lahore', en: 'Lahore', tr: 'Lahor', ar: 'لاهور', es: 'Lahore', fr: 'Lahore',
      id: 'Lahore', bn: 'লাহোর', fa: 'لاهور', ms: 'Lahore', ur: 'لاہور', ru: 'Лахор',
      sw: 'Lahore', ps: 'لاهور',
    },
  },
  {
    id: 'delhi',
    tz: 'Asia/Kolkata',
    lat: 28.6139,
    lon: 77.209,
    method: 1,
    labels: {
      de: 'Delhi', en: 'Delhi', tr: 'Delhi', ar: 'دلهي', es: 'Delhi', fr: 'Delhi',
      id: 'Delhi', bn: 'দিল্লি', fa: 'دهلی', ms: 'Delhi', ur: 'دہلی', ru: 'Дели',
      sw: 'Delhi', ps: 'ډیلي',
    },
  },
  {
    id: 'dhaka',
    tz: 'Asia/Dhaka',
    lat: 23.8103,
    lon: 90.4125,
    method: 1,
    labels: {
      de: 'Dhaka', en: 'Dhaka', tr: 'Dakka', ar: 'دكا', es: 'Daca', fr: 'Dacca',
      id: 'Dhaka', bn: 'ঢাকা', fa: 'داکا', ms: 'Dhaka', ur: 'ڈھاکہ', ru: 'Дакка',
      sw: 'Dhaka', ps: 'ډاکا',
    },
  },
  {
    id: 'jakarta',
    tz: 'Asia/Jakarta',
    lat: -6.2088,
    lon: 106.8456,
    method: 3,
    labels: {
      de: 'Jakarta', en: 'Jakarta', tr: 'Cakarta', ar: 'جاكرتا', es: 'Yakarta',
      fr: 'Jakarta', id: 'Jakarta', bn: 'জাকার্তা', fa: 'جاکارتا', ms: 'Jakarta',
      ur: 'جکارتہ', ru: 'Джакарта', sw: 'Jakarta', ps: 'جاکارتا',
    },
  },
  {
    id: 'kuala-lumpur',
    tz: 'Asia/Kuala_Lumpur',
    lat: 3.139,
    lon: 101.6869,
    method: 3,
    labels: {
      de: 'Kuala Lumpur', en: 'Kuala Lumpur', tr: 'Kuala Lumpur', ar: 'كوالالمبور',
      es: 'Kuala Lumpur', fr: 'Kuala Lumpur', id: 'Kuala Lumpur', bn: 'কুয়ালালামপুর',
      fa: 'کوالالامپور', ms: 'Kuala Lumpur', ur: 'کوالالمپور', ru: 'Куала-Лумпур',
      sw: 'Kuala Lumpur', ps: 'کوالالمپور',
    },
  },
  {
    id: 'singapur',
    tz: 'Asia/Singapore',
    lat: 1.3521,
    lon: 103.8198,
    method: 11,
    labels: {
      de: 'Singapur', en: 'Singapore', tr: 'Singapur', ar: 'سنغافورة', es: 'Singapur',
      fr: 'Singapour', id: 'Singapura', bn: 'সিঙ্গাপুর', fa: 'سنگاپور', ms: 'Singapura',
      ur: 'سنگاپور', ru: 'Сингапур', sw: 'Singapore', ps: 'سنګاپور',
    },
  },

  // ── Nordamerika ───────────────────────────────────────────────────────────
  {
    id: 'new-york',
    tz: 'America/New_York',
    lat: 40.7128,
    lon: -74.006,
    method: 2,
    labels: {
      de: 'New York', en: 'New York', tr: 'New York', ar: 'نيويورك', es: 'Nueva York',
      fr: 'New York', id: 'New York', bn: 'নিউ ইয়র্ক', fa: 'نیویورک', ms: 'New York',
      ur: 'نیو یارک', ru: 'Нью-Йорк', sw: 'New York', ps: 'نیویارک',
    },
  },
  {
    id: 'toronto',
    tz: 'America/Toronto',
    lat: 43.6532,
    lon: -79.3832,
    method: 2,
    labels: {
      de: 'Toronto', en: 'Toronto', tr: 'Toronto', ar: 'تورونتو', es: 'Toronto',
      fr: 'Toronto', id: 'Toronto', bn: 'টরন্টো', fa: 'تورنتو', ms: 'Toronto',
      ur: 'ٹورانٹو', ru: 'Торонто', sw: 'Toronto', ps: 'تورنټو',
    },
  },
  {
    id: 'chicago',
    tz: 'America/Chicago',
    lat: 41.8781,
    lon: -87.6298,
    method: 2,
    labels: {
      de: 'Chicago', en: 'Chicago', tr: 'Chicago', ar: 'شيكاغو', es: 'Chicago',
      fr: 'Chicago', id: 'Chicago', bn: 'শিকাগো', fa: 'شیکاگو', ms: 'Chicago',
      ur: 'شکاگو', ru: 'Чикаго', sw: 'Chicago', ps: 'شیکاګو',
    },
  },
  {
    id: 'los-angeles',
    tz: 'America/Los_Angeles',
    lat: 34.0522,
    lon: -118.2437,
    method: 2,
    labels: {
      de: 'Los Angeles', en: 'Los Angeles', tr: 'Los Angeles', ar: 'لوس أنجلوس',
      es: 'Los Ángeles', fr: 'Los Angeles', id: 'Los Angeles', bn: 'লস অ্যাঞ্জেলেস',
      fa: 'لس‌آنجلس', ms: 'Los Angeles', ur: 'لاس اینجلس', ru: 'Лос-Анджелес',
      sw: 'Los Angeles', ps: 'لاس انجلس',
    },
  },
];

const BY_ID = new Map(CITIES.map((c) => [c.id, c]));
// Rückfall für Einstellungen, die VOR diesem Audit gespeichert wurden: dort
// steht nur der deutsche Name, kein `cityId`. Ohne diese Abbildung sähe ein
// arabischer Nutzer nach dem Update weiterhin „Kairo" in der Kopfzeile der
// Gebetsuhr, und keine Kachel wäre als aktiv markiert.
const BY_LEGACY_LABEL = new Map(CITIES.map((c) => [c.labels.de, c]));

export function cityById(id: string | undefined): City | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** Anzeigename einer Stadt in der App-Sprache. */
export function cityLabel(city: City, locale: Locale): string {
  return city.labels[locale] || city.labels.en;
}

/**
 * Die Stadt hinter einem gespeicherten Standort — oder `undefined`, wenn der
 * Standort vom gekoppelten Handy per GPS kommt (dann ist `label` ein
 * Geocoder-Ergebnis und gehört keiner Stadt aus dieser Liste).
 */
export function cityForLocation(loc: Pick<TvLocation, 'cityId' | 'label'>): City | undefined {
  return cityById(loc.cityId) ?? BY_LEGACY_LABEL.get(loc.label);
}

/**
 * Beschriftung des aktuellen Standorts. Voreinstellungs-Städte werden
 * übersetzt, ein per Handy gesetzter GPS-Standort bleibt unverändert stehen —
 * seinen Namen kann die TV-App nicht übersetzen, und ein englischer Rückfall
 * wäre dort falscher als der Originalname.
 */
export function locationLabel(loc: Pick<TvLocation, 'cityId' | 'label'>, locale: Locale): string {
  const city = cityForLocation(loc);
  return city ? cityLabel(city, locale) : loc.label;
}
