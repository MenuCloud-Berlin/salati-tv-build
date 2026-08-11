// Hidschri-Datum fuer die Gebetsuhr.
//
// SPIEGELKOPIE der beiden Teile aus apps/mobile/src/features/calendar/offline.ts,
// die der Fernseher braucht: der tabellarische Konverter und die Monatsnamen in
// allen 14 Sprachen. Die Handy-App holt das Datum bevorzugt online von Aladhan
// und nutzt diesen Rechenweg nur als Rueckfall; der Fernseher rechnet immer
// lokal — die Uhr laeuft auch ohne Netz und soll dafuer keine Netz-Abhaengigkeit
// bekommen. Die bekannte Unschaerfe von plus/minus einem Tag gegenueber dem
// mondsichtungsbasierten Kalender gilt hier also immer; deshalb steht das Datum
// als ZUSATZ neben dem gregorianischen, nicht an seiner Stelle.
//
// `hijri.parity.test.ts` vergleicht beide Rechenwege Tag fuer Tag.

import type { Locale } from '@/lib/locale';

export interface HijriYMD {
  year: number;
  month: number; // 1-12
  day: number;
}

export function gregorianToHijriOffline(date: Date): HijriYMD {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();

  let jd =
    Math.floor((1461 * (gy + 4800 + Math.floor((gm - 14) / 12))) / 4) +
    Math.floor((367 * (gm - 2 - 12 * Math.floor((gm - 14) / 12))) / 12) -
    Math.floor((3 * Math.floor((gy + 4900 + Math.floor((gm - 14) / 12)) / 100)) / 4) +
    gd -
    32075;
  jd -= 1; // Kalibrierung gegen Aladhan-Referenzwerte

  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l =
    l -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;

  return { year, month, day };
}

export const HIJRI_MONTHS: Record<Locale, string[]> = {
  de: [
    'Muharram', 'Safar', 'Rabīʿ al-Awwal', 'Rabīʿ ath-Thānī',
    'Jumādā al-Ūlā', 'Jumādā ath-Thāniyah', 'Rajab', 'Shaʿbān',
    'Ramaḍān', 'Shawwāl', 'Dhū al-Qaʿdah', 'Dhū al-Ḥijjah',
  ],
  en: [
    'Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani",
    'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab', "Sha'ban",
    'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah',
  ],
  tr: [
    'Muharrem', 'Safer', 'Rebîülevvel', 'Rebîülâhir',
    'Cemâziyelevvel', 'Cemâziyelâhir', 'Recep', 'Şaban',
    'Ramazan', 'Şevval', 'Zilkade', 'Zilhicce',
  ],
  ar: [
    'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
    'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
    'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
  ],
  es: [
    'Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Zani',
    'Yumada al-Ula', 'Yumada al-Zani', 'Rayab', 'Shaaban',
    'Ramadán', 'Shawwal', 'Du al-Qada', 'Du al-Hiyya',
  ],
  fr: [
    'Mouharram', 'Safar', 'Rabi al-Awwal', 'Rabi ath-Thani',
    'Joumada al-Oula', 'Joumada al-Akhira', 'Rajab', "Cha'ban",
    'Ramadan', 'Chawwal', "Dhou al-Qi'da", 'Dhou al-Hijja',
  ],
  id: [
    'Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir',
    'Jumadil Awal', 'Jumadil Akhir', 'Rajab', "Sya'ban",
    'Ramadhan', 'Syawal', 'Zulkaidah', 'Zulhijjah',
  ],
  bn: [
    'মুহররম', 'সফর', 'রবিউল আউয়াল', 'রবিউস সানি',
    'জমাদিউল আউয়াল', 'জমাদিউস সানি', 'রজব', 'শাবান',
    'রমজান', 'শাওয়াল', 'জিলকদ', 'জিলহজ্জ',
  ],
  fa: [
    'محرم', 'صفر', 'ربیع‌الاول', 'ربیع‌الثانی',
    'جمادی‌الاول', 'جمادی‌الثانی', 'رجب', 'شعبان',
    'رمضان', 'شوال', 'ذی‌القعده', 'ذی‌الحجه',
  ],
  ms: [
    'Muharram', 'Safar', 'Rabiulawal', 'Rabiulakhir',
    'Jamadilawal', 'Jamadilakhir', 'Rejab', 'Syaaban',
    'Ramadan', 'Syawal', 'Zulkaedah', 'Zulhijjah',
  ],
  ur: [
    'محرم', 'صفر', 'ربیع الاول', 'ربیع الثانی',
    'جمادی الاول', 'جمادی الثانی', 'رجب', 'شعبان',
    'رمضان', 'شوال', 'ذی قعدہ', 'ذی الحجہ',
  ],
  ru: [
    'Мухаррам', 'Сафар', 'Раби аль-авваль', 'Раби ас-сани',
    'Джумада аль-уля', 'Джумада аль-ахира', 'Раджаб', 'Шаабан',
    'Рамадан', 'Шавваль', 'Зуль-каада', 'Зуль-хиджа',
  ],
  sw: [
    'Muharram', 'Safar', 'Rabiul-Awwal', 'Rabiuth-Thani',
    'Jumadal-Awwal', 'Jumadath-Thani', 'Rajabu', 'Shaabani',
    'Ramadhani', 'Shawwali', 'Dhul-Qaada', 'Dhul-Hijja',
  ],
  ps: [
    'محرم', 'صفر', 'ربيع الاول', 'ربيع الثاني',
    'جمادی الاول', 'جمادی الثاني', 'رجب', 'شعبان',
    'رمضان', 'شوال', 'ذوالقعده', 'ذوالحجه',
  ],
};

/**
 * Fertige Datumszeile, z. B. „12. Safar 1448". Der Punkt nach der Zahl ist
 * eine deutsche Eigenheit und steht deshalb NICHT im Format — die
 * Uebersetzungsdatei liefert das Muster (`clock.hijriDate`), diese Funktion
 * nur die drei Bestandteile.
 */
export function hijriParts(date: Date, locale: Locale): { day: string; month: string; year: string } {
  const h = gregorianToHijriOffline(date);
  const namen = HIJRI_MONTHS[locale] ?? HIJRI_MONTHS.en;
  // Der Konverter kann an Randtagen 0 oder 13 liefern; ohne Klemme staende
  // dort `undefined` in der Zeile.
  const monat = namen[Math.min(Math.max(h.month, 1), 12) - 1];
  return { day: String(h.day), month: monat, year: String(h.year) };
}
