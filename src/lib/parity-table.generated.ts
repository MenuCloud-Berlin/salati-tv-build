// GENERIERT — nicht von Hand aendern.
//
// Soll-Gebetszeiten der HANDY-App (apps/mobile), erzeugt am 2026-07-29 durch
// direkten Aufruf von `apps/mobile/src/features/prayer-times/calc.ts`
// (computeTimings) — nicht nachgerechnet, nicht abgeschrieben. Die TV-App muss
// exakt diese Zeichenketten liefern; geprueft in `prayerTimes.parity.test.ts`.
//
// Zeitzone der Erzeugung: Europe/Berlin. Beide Apps rechnen ueber JS-`Date` in
// der Zeitzone des GERAETS; die Tabelle ist deshalb nur mit derselben Zeitzone
// vergleichbar. `jest.config.js` pinnt sie fuer den Testlauf.

export interface ParityDay {
  date: string;
  t: { Fajr: string; Sunrise: string; Dhuhr: string; Asr: string; Maghrib: string; Isha: string };
}

export interface ParityCase {
  id: string;
  lat: number;
  lon: number;
  method: number;
  madhab: 'shafi' | 'hanafi';
  highLatitude: 'auto' | 'middleOfNight' | 'seventhOfNight' | 'twilightAngle';
  days: ParityDay[];
}

export const MOBILE_PARITY_TABLE: ParityCase[] = [
  {
    id: 'berlin',
    lat: 52.52,
    lon: 13.405,
    method: 13,
    madhab: 'shafi',
    highLatitude: 'auto',
    days: [
      { date: '2026-01-15', t: { Fajr: '06:06', Sunrise: '08:03', Dhuhr: '12:21', Asr: '14:08', Maghrib: '16:29', Isha: '18:19' } },
      { date: '2026-03-21', t: { Fajr: '04:10', Sunrise: '06:00', Dhuhr: '12:19', Asr: '15:36', Maghrib: '18:28', Isha: '20:11' } },
      { date: '2026-06-21', t: { Fajr: '02:34', Sunrise: '04:36', Dhuhr: '13:14', Asr: '17:37', Maghrib: '21:40', Isha: '23:35' } },
      { date: '2026-12-21', t: { Fajr: '06:07', Sunrise: '08:08', Dhuhr: '12:10', Asr: '13:43', Maghrib: '16:01', Isha: '17:55' } },
    ],
  },
  {
    id: 'berlin-hanafi',
    lat: 52.52,
    lon: 13.405,
    method: 13,
    madhab: 'hanafi',
    highLatitude: 'auto',
    days: [
      { date: '2026-01-15', t: { Fajr: '06:06', Sunrise: '08:03', Dhuhr: '12:21', Asr: '14:39', Maghrib: '16:29', Isha: '18:19' } },
      { date: '2026-03-21', t: { Fajr: '04:10', Sunrise: '06:00', Dhuhr: '12:19', Asr: '16:26', Maghrib: '18:28', Isha: '20:11' } },
      { date: '2026-06-21', t: { Fajr: '02:34', Sunrise: '04:36', Dhuhr: '13:14', Asr: '18:52', Maghrib: '21:40', Isha: '23:35' } },
      { date: '2026-12-21', t: { Fajr: '06:07', Sunrise: '08:08', Dhuhr: '12:10', Asr: '14:11', Maghrib: '16:01', Isha: '17:55' } },
    ],
  },
  {
    id: 'berlin-mwl-seventh',
    lat: 52.52,
    lon: 13.405,
    method: 3,
    madhab: 'shafi',
    highLatitude: 'seventhOfNight',
    days: [
      { date: '2026-01-15', t: { Fajr: '06:06', Sunrise: '08:10', Dhuhr: '12:16', Asr: '14:04', Maghrib: '16:22', Isha: '18:19' } },
      { date: '2026-03-21', t: { Fajr: '04:26', Sunrise: '06:07', Dhuhr: '12:14', Asr: '15:32', Maghrib: '18:21', Isha: '20:02' } },
      { date: '2026-06-21', t: { Fajr: '03:42', Sunrise: '04:43', Dhuhr: '13:09', Asr: '17:33', Maghrib: '21:33', Isha: '22:35' } },
      { date: '2026-12-21', t: { Fajr: '06:07', Sunrise: '08:15', Dhuhr: '12:05', Asr: '13:39', Maghrib: '15:54', Isha: '17:55' } },
    ],
  },
  {
    id: 'oslo',
    lat: 59.9139,
    lon: 10.7522,
    method: 3,
    madhab: 'shafi',
    highLatitude: 'auto',
    days: [
      { date: '2026-01-15', t: { Fajr: '06:28', Sunrise: '09:04', Dhuhr: '12:27', Asr: '13:38', Maghrib: '15:49', Isha: '18:18' } },
      { date: '2026-03-21', t: { Fajr: '03:50', Sunrise: '06:16', Dhuhr: '12:25', Asr: '15:34', Maghrib: '18:34', Isha: '20:51' } },
      { date: '2026-06-21', t: { Fajr: '02:21', Sunrise: '03:54', Dhuhr: '13:19', Asr: '18:00', Maghrib: '22:44', Isha: '00:12' } },
      { date: '2026-12-21', t: { Fajr: '06:32', Sunrise: '09:18', Dhuhr: '12:16', Asr: '13:07', Maghrib: '15:12', Isha: '17:49' } },
    ],
  },
  {
    id: 'tromsoe',
    lat: 69.6492,
    lon: 18.9553,
    method: 3,
    madhab: 'shafi',
    highLatitude: 'auto',
    days: [
      { date: '2026-01-15', t: { Fajr: '06:14', Sunrise: '11:22', Dhuhr: '11:54', Asr: '12:26', Maghrib: '12:26', Isha: '17:22' } },
      { date: '2026-03-21', t: { Fajr: '02:13', Sunrise: '05:39', Dhuhr: '11:52', Asr: '14:41', Maghrib: '18:06', Isha: '21:21' } },
      { date: '2026-06-21', t: { Fajr: '00:37', Sunrise: '01:05', Dhuhr: '12:51', Asr: '17:37', Maghrib: '23:58', Isha: '00:24' } },
      { date: '2026-12-21', t: { Fajr: '05:50', Sunrise: '10:57', Dhuhr: '11:32', Asr: '12:06', Maghrib: '12:06', Isha: '17:00' } },
    ],
  },
  {
    id: 'istanbul',
    lat: 41.0082,
    lon: 28.9784,
    method: 13,
    madhab: 'shafi',
    highLatitude: 'auto',
    days: [
      { date: '2026-01-15', t: { Fajr: '04:50', Sunrise: '06:20', Dhuhr: '11:19', Asr: '13:46', Maghrib: '16:07', Isha: '17:32' } },
      { date: '2026-03-21', t: { Fajr: '03:34', Sunrise: '04:59', Dhuhr: '11:17', Asr: '14:42', Maghrib: '17:24', Isha: '18:44' } },
      { date: '2026-06-21', t: { Fajr: '02:24', Sunrise: '04:25', Dhuhr: '12:11', Asr: '16:11', Maghrib: '19:47', Isha: '21:38' } },
      { date: '2026-12-21', t: { Fajr: '04:46', Sunrise: '06:18', Dhuhr: '11:08', Asr: '13:25', Maghrib: '15:46', Isha: '17:13' } },
    ],
  },
  {
    id: 'kairo',
    lat: 30.0444,
    lon: 31.2357,
    method: 5,
    madhab: 'shafi',
    highLatitude: 'auto',
    days: [
      { date: '2026-01-15', t: { Fajr: '04:21', Sunrise: '05:52', Dhuhr: '11:05', Asr: '13:58', Maghrib: '16:17', Isha: '17:39' } },
      { date: '2026-03-21', t: { Fajr: '03:31', Sunrise: '04:58', Dhuhr: '11:03', Asr: '14:30', Maghrib: '17:07', Isha: '18:25' } },
      { date: '2026-06-21', t: { Fajr: '03:08', Sunrise: '04:54', Dhuhr: '11:57', Asr: '15:32', Maghrib: '18:59', Isha: '20:33' } },
      { date: '2026-12-21', t: { Fajr: '04:14', Sunrise: '05:47', Dhuhr: '10:54', Asr: '13:41', Maghrib: '15:59', Isha: '17:23' } },
    ],
  },
  {
    id: 'makkah',
    lat: 21.4225,
    lon: 39.8262,
    method: 4,
    madhab: 'shafi',
    highLatitude: 'auto',
    days: [
      { date: '2026-01-15', t: { Fajr: '03:41', Sunrise: '05:01', Dhuhr: '10:31', Asr: '13:38', Maghrib: '15:59', Isha: '17:29' } },
      { date: '2026-03-21', t: { Fajr: '03:08', Sunrise: '04:24', Dhuhr: '10:28', Asr: '13:53', Maghrib: '16:32', Isha: '18:02' } },
      { date: '2026-06-21', t: { Fajr: '03:11', Sunrise: '04:39', Dhuhr: '11:23', Asr: '14:42', Maghrib: '18:06', Isha: '19:36' } },
      { date: '2026-12-21', t: { Fajr: '03:32', Sunrise: '04:54', Dhuhr: '10:19', Asr: '13:23', Maghrib: '15:44', Isha: '17:14' } },
    ],
  },
  {
    id: 'jakarta',
    lat: -6.2088,
    lon: 106.8456,
    method: 3,
    madhab: 'shafi',
    highLatitude: 'auto',
    days: [
      { date: '2026-01-15', t: { Fajr: '22:34', Sunrise: '23:49', Dhuhr: '06:02', Asr: '09:27', Maghrib: '12:15', Isha: '13:26' } },
      { date: '2026-03-21', t: { Fajr: '22:48', Sunrise: '23:57', Dhuhr: '06:00', Asr: '09:10', Maghrib: '12:03', Isha: '13:08' } },
      { date: '2026-06-21', t: { Fajr: '23:46', Sunrise: '01:01', Dhuhr: '06:55', Asr: '10:16', Maghrib: '12:47', Isha: '13:58' } },
      { date: '2026-12-21', t: { Fajr: '22:20', Sunrise: '23:36', Dhuhr: '05:51', Asr: '09:18', Maghrib: '12:05', Isha: '13:17' } },
    ],
  },
  {
    id: 'punta-arenas',
    lat: -53.1638,
    lon: -70.9171,
    method: 3,
    madhab: 'shafi',
    highLatitude: 'auto',
    days: [
      { date: '2026-01-15', t: { Fajr: '07:24', Sunrise: '09:42', Dhuhr: '17:54', Asr: '22:13', Maghrib: '02:03', Isha: '04:14' } },
      { date: '2026-03-21', t: { Fajr: '09:49', Sunrise: '11:47', Dhuhr: '17:51', Asr: '21:03', Maghrib: '23:53', Isha: '01:44' } },
      { date: '2026-06-21', t: { Fajr: '12:49', Sunrise: '15:00', Dhuhr: '18:46', Asr: '20:17', Maghrib: '22:31', Isha: '00:35' } },
      { date: '2026-12-21', t: { Fajr: '07:06', Sunrise: '09:13', Dhuhr: '17:42', Asr: '22:08', Maghrib: '02:11', Isha: '04:11' } },
    ],
  },
  {
    id: 'singapur',
    lat: 1.3521,
    lon: 103.8198,
    method: 11,
    madhab: 'shafi',
    highLatitude: 'auto',
    days: [
      { date: '2026-01-15', t: { Fajr: '22:50', Sunrise: '00:12', Dhuhr: '06:15', Asr: '09:39', Maghrib: '12:16', Isha: '13:29' } },
      { date: '2026-03-21', t: { Fajr: '22:52', Sunrise: '00:09', Dhuhr: '06:12', Asr: '09:14', Maghrib: '12:15', Isha: '13:24' } },
      { date: '2026-06-21', t: { Fajr: '23:36', Sunrise: '01:00', Dhuhr: '07:07', Asr: '10:33', Maghrib: '13:13', Isha: '14:28' } },
      { date: '2026-12-21', t: { Fajr: '22:37', Sunrise: '00:01', Dhuhr: '06:03', Asr: '09:28', Maghrib: '12:04', Isha: '13:19' } },
    ],
  },
  {
    id: 'dubai-gulf',
    lat: 25.2048,
    lon: 55.2708,
    method: 8,
    madhab: 'shafi',
    highLatitude: 'auto',
    days: [
      { date: '2026-01-15', t: { Fajr: '02:39', Sunrise: '04:06', Dhuhr: '09:29', Asr: '12:30', Maghrib: '14:51', Isha: '16:21' } },
      { date: '2026-03-21', t: { Fajr: '01:59', Sunrise: '03:22', Dhuhr: '09:27', Asr: '12:53', Maghrib: '15:30', Isha: '17:00' } },
      { date: '2026-06-21', t: { Fajr: '01:51', Sunrise: '03:29', Dhuhr: '10:21', Asr: '13:43', Maghrib: '17:12', Isha: '18:42' } },
      { date: '2026-12-21', t: { Fajr: '02:31', Sunrise: '04:00', Dhuhr: '09:17', Asr: '12:14', Maghrib: '14:34', Isha: '16:04' } },
    ],
  },
  {
    id: 'casablanca-moon',
    lat: 33.5731,
    lon: -7.5898,
    method: 15,
    madhab: 'shafi',
    highLatitude: 'auto',
    days: [
      { date: '2026-01-15', t: { Fajr: '07:07', Sunrise: '08:35', Dhuhr: '13:40', Asr: '16:26', Maghrib: '18:45', Isha: '20:12' } },
      { date: '2026-03-21', t: { Fajr: '06:10', Sunrise: '07:33', Dhuhr: '13:38', Asr: '17:06', Maghrib: '19:43', Isha: '20:59' } },
      { date: '2026-06-21', t: { Fajr: '05:37', Sunrise: '07:21', Dhuhr: '14:33', Asr: '18:16', Maghrib: '21:44', Isha: '23:02' } },
      { date: '2026-12-21', t: { Fajr: '07:02', Sunrise: '08:31', Dhuhr: '13:29', Asr: '16:08', Maghrib: '18:26', Isha: '19:55' } },
    ],
  },
  {
    id: 'paris-uoif',
    lat: 48.8566,
    lon: 2.3522,
    method: 12,
    madhab: 'shafi',
    highLatitude: 'auto',
    days: [
      { date: '2026-01-15', t: { Fajr: '07:24', Sunrise: '08:39', Dhuhr: '13:00', Asr: '15:03', Maghrib: '17:22', Isha: '18:37' } },
      { date: '2026-03-21', t: { Fajr: '05:43', Sunrise: '06:52', Dhuhr: '12:58', Asr: '16:20', Maghrib: '19:05', Isha: '20:14' } },
      { date: '2026-06-21', t: { Fajr: '04:13', Sunrise: '05:47', Dhuhr: '13:53', Asr: '18:10', Maghrib: '21:58', Isha: '23:32' } },
      { date: '2026-12-21', t: { Fajr: '07:23', Sunrise: '08:41', Dhuhr: '12:49', Asr: '14:39', Maghrib: '16:56', Isha: '18:14' } },
    ],
  },
  {
    id: 'moskau-ru',
    lat: 55.7558,
    lon: 37.6173,
    method: 14,
    madhab: 'shafi',
    highLatitude: 'auto',
    days: [
      { date: '2026-01-15', t: { Fajr: '04:49', Sunrise: '06:49', Dhuhr: '10:39', Asr: '12:12', Maghrib: '14:29', Isha: '16:22' } },
      { date: '2026-03-21', t: { Fajr: '02:38', Sunrise: '04:30', Dhuhr: '10:37', Asr: '13:52', Maghrib: '16:45', Isha: '18:29' } },
      { date: '2026-06-21', t: { Fajr: '01:01', Sunrise: '02:45', Dhuhr: '11:32', Asr: '16:03', Maghrib: '20:18', Isha: '21:55' } },
      { date: '2026-12-21', t: { Fajr: '04:51', Sunrise: '06:57', Dhuhr: '10:28', Asr: '11:45', Maghrib: '13:58', Isha: '15:57' } },
    ],
  },
  {
    id: 'karatschi',
    lat: 24.8607,
    lon: 67.0011,
    method: 1,
    madhab: 'shafi',
    highLatitude: 'auto',
    days: [
      { date: '2026-01-15', t: { Fajr: '01:58', Sunrise: '03:19', Dhuhr: '08:42', Asr: '11:44', Maghrib: '14:04', Isha: '15:24' } },
      { date: '2026-03-21', t: { Fajr: '01:19', Sunrise: '02:35', Dhuhr: '08:40', Asr: '12:06', Maghrib: '14:44', Isha: '16:00' } },
      { date: '2026-06-21', t: { Fajr: '01:14', Sunrise: '02:43', Dhuhr: '09:34', Asr: '12:55', Maghrib: '16:24', Isha: '17:53' } },
      { date: '2026-12-21', t: { Fajr: '01:51', Sunrise: '03:12', Dhuhr: '08:30', Asr: '11:28', Maghrib: '13:48', Isha: '15:09' } },
    ],
  },
  {
    id: 'new-york',
    lat: 40.7128,
    lon: -74.006,
    method: 2,
    madhab: 'shafi',
    highLatitude: 'auto',
    days: [
      { date: '2026-01-15', t: { Fajr: '11:58', Sunrise: '13:18', Dhuhr: '18:06', Asr: '20:35', Maghrib: '22:53', Isha: '00:14' } },
      { date: '2026-03-21', t: { Fajr: '10:42', Sunrise: '11:58', Dhuhr: '18:04', Asr: '21:30', Maghrib: '00:09', Isha: '01:25' } },
      { date: '2026-06-21', t: { Fajr: '09:45', Sunrise: '11:25', Dhuhr: '18:58', Asr: '22:58', Maghrib: '02:31', Isha: '04:11' } },
      { date: '2026-12-21', t: { Fajr: '11:54', Sunrise: '13:17', Dhuhr: '17:55', Asr: '20:14', Maghrib: '22:32', Isha: '23:54' } },
    ],
  },
  {
    id: 'doha',
    lat: 25.2854,
    lon: 51.531,
    method: 10,
    madhab: 'shafi',
    highLatitude: 'auto',
    days: [
      { date: '2026-01-15', t: { Fajr: '03:01', Sunrise: '04:21', Dhuhr: '09:44', Asr: '12:45', Maghrib: '15:05', Isha: '16:35' } },
      { date: '2026-03-21', t: { Fajr: '02:21', Sunrise: '03:37', Dhuhr: '09:42', Asr: '13:08', Maghrib: '15:45', Isha: '17:15' } },
      { date: '2026-06-21', t: { Fajr: '02:15', Sunrise: '03:44', Dhuhr: '10:36', Asr: '13:58', Maghrib: '17:27', Isha: '18:57' } },
      { date: '2026-12-21', t: { Fajr: '02:53', Sunrise: '04:15', Dhuhr: '09:32', Asr: '12:29', Maghrib: '14:49', Isha: '16:19' } },
    ],
  },
  {
    id: 'kuwait',
    lat: 29.3759,
    lon: 47.9774,
    method: 9,
    madhab: 'shafi',
    highLatitude: 'auto',
    days: [
      { date: '2026-01-15', t: { Fajr: '03:20', Sunrise: '04:43', Dhuhr: '09:58', Asr: '12:52', Maghrib: '15:12', Isha: '16:33' } },
      { date: '2026-03-21', t: { Fajr: '02:32', Sunrise: '03:51', Dhuhr: '09:56', Asr: '13:23', Maghrib: '16:00', Isha: '17:17' } },
      { date: '2026-06-21', t: { Fajr: '02:13', Sunrise: '03:49', Dhuhr: '10:50', Asr: '14:24', Maghrib: '17:51', Isha: '19:23' } },
      { date: '2026-12-21', t: { Fajr: '03:13', Sunrise: '04:38', Dhuhr: '09:47', Asr: '12:35', Maghrib: '14:54', Isha: '16:17' } },
    ],
  },
];
