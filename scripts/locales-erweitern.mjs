// Ergaenzt die 14 TV-Sprachdateien um die Schluessel, die mit den
// Darstellungs- und Leser-Einstellungen dazugekommen sind (2026-08-08).
//
// GRUNDSATZ: Wo die Handy-App denselben Begriff schon fuehrt, wird ihr Wortlaut
// UEBERNOMMEN statt neu uebersetzt — der Nutzer soll auf beiden Geraeten
// dieselben Woerter lesen. Nur was es auf dem Handy gar nicht gibt (Themen-
// Namen, Bedienhinweise der Fernbedienung), steht hier als Tabelle.
//
// Einmal-Skript, aber bewusst versioniert und wiederholbar (idempotent): beim
// naechsten Mal ist nachvollziehbar, WOHER jeder Text kam.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const TV = join(HIER, '..', 'src', 'locales');
const HANDY = join(HIER, '..', '..', 'mobile', 'src', 'locales');

const SPRACHEN = ['de', 'en', 'tr', 'ar', 'es', 'fr', 'id', 'bn', 'fa', 'ms', 'ur', 'ru', 'sw', 'ps'];

/** Aus der Handy-Datei uebernommene Schluessel: [Ziel im TV, Quelle im Handy]. */
const UEBERNAHMEN = [
  ['settings.sections.prayer', 'settings.notificationsOverview.groupPrayerTimes'],
  ['settings.sections.display', 'settings.appearance'],
  ['settings.sections.reader', 'nav.quran'],
  ['settings.readerScale.title', 'settings.fontSize'],
  ['settings.readerScale.small', 'settings.fontSmall'],
  ['settings.readerScale.medium', 'settings.fontMedium'],
  ['settings.readerScale.large', 'settings.fontLarge'],
  ['settings.readerScale.xlarge', 'settings.fontXLarge'],
  ['settings.readerTranslit', 'quran.transliteration'],
  ['settings.readerTranslation', 'quran.translation'],
  ['settings.quranFont.title', 'settings.quranFont.title'],
  ['settings.quranFont.hint.kfgqpc', 'settings.quranFont.hint.kfgqpc'],
  ['settings.quranFont.hint.amiriQuran', 'settings.quranFont.hint.amiriQuran'],
  ['settings.quranFont.hint.amiri', 'settings.quranFont.hint.amiri'],
  ['settings.quranFont.hint.scheherazade', 'settings.quranFont.hint.scheherazade'],
  ['settings.quranFont.hint.lateef', 'settings.quranFont.hint.lateef'],
  ['settings.quranFont.hint.harmattan', 'settings.quranFont.hint.harmattan'],
  ['settings.quranFont.hint.noto', 'settings.quranFont.hint.noto'],
  ['settings.quranFont.hint.notoSans', 'settings.quranFont.hint.notoSans'],
  ['settings.sukun.title', 'settings.quranSukun.title'],
  ['settings.sukun.madina', 'settings.quranSukun.madina'],
  ['settings.sukun.kreis', 'settings.quranSukun.kreis'],
  ['settings.sukun.hint', 'settings.quranSukun.hint'],
  ['settings.methodRegions.worldwide', 'settings.methodRegions.worldwide'],
  ['settings.methodRegions.europe', 'settings.methodRegions.europe'],
  ['settings.methodRegions.northAmerica', 'settings.methodRegions.northAmerica'],
  ['settings.methodRegions.arabia', 'settings.methodRegions.arabia'],
  ['settings.methodRegions.middleEast', 'settings.methodRegions.middleEast'],
  ['settings.methodRegions.northAfrica', 'settings.methodRegions.northAfrica'],
  ['settings.methodRegions.southAsia', 'settings.methodRegions.southAsia'],
  ['settings.methodRegions.southeastAsia', 'settings.methodRegions.southeastAsia'],
];

/** Neue Texte, die es auf dem Handy nicht gibt (Fernseher-eigene Begriffe). */
const NEU = {
  de: {
    'settings.railHint': 'Rechts wählen · Zurück-Taste verlässt die Einstellungen',
    'settings.theme.title': 'Farbwelt',
    'settings.theme.hint': 'Wirkt auf alle Bereiche. „Papier" ist der einzige helle Untergrund — gedacht für helle Räume und zum Lesen am Tag.',
    'settings.theme.mitternacht': 'Mitternacht',
    'settings.theme.tiefschwarz': 'Tiefschwarz (OLED)',
    'settings.theme.nachtblau': 'Nachtblau',
    'settings.theme.smaragd': 'Smaragd',
    'settings.theme.papier': 'Papier',
    'settings.readerContent': 'Unter dem Vers',
    'settings.readerAutoAdvance': 'Weiter zur nächsten Sure',
    'reader.controlHint': 'OK = Pause · ⏮ ⏭ Vers · ↻ Vers wiederholen',
    'reader.repeatOn': 'Vers wird wiederholt · ↻ beendet die Wiederholung',
    'clock.hijriDate': '{day}. {month} {year}',
  },
  en: {
    'settings.railHint': 'Choose on the right · Back leaves settings',
    'settings.theme.title': 'Colour scheme',
    'settings.theme.hint': 'Applies everywhere. “Paper” is the only light background — made for bright rooms and daytime reading.',
    'settings.theme.mitternacht': 'Midnight',
    'settings.theme.tiefschwarz': 'Deep black (OLED)',
    'settings.theme.nachtblau': 'Night blue',
    'settings.theme.smaragd': 'Emerald',
    'settings.theme.papier': 'Paper',
    'settings.readerContent': 'Below the verse',
    'settings.readerAutoAdvance': 'Continue to next surah',
    'reader.controlHint': 'OK = pause · ⏮ ⏭ verse · ↻ repeat verse',
    'reader.repeatOn': 'Repeating this verse · ↻ stops repeating',
    'clock.hijriDate': '{day} {month} {year}',
  },
  tr: {
    'settings.railHint': 'Sağdan seç · Geri tuşu ayarlardan çıkar',
    'settings.theme.title': 'Renk dünyası',
    'settings.theme.hint': 'Tüm bölümlerde geçerlidir. “Kâğıt” tek açık zemindir — aydınlık odalar ve gündüz okuma için.',
    'settings.theme.mitternacht': 'Gece yarısı',
    'settings.theme.tiefschwarz': 'Derin siyah (OLED)',
    'settings.theme.nachtblau': 'Gece mavisi',
    'settings.theme.smaragd': 'Zümrüt',
    'settings.theme.papier': 'Kâğıt',
    'settings.readerContent': 'Ayetin altında',
    'settings.readerAutoAdvance': 'Sonraki sureye geç',
    'reader.controlHint': 'OK = duraklat · ⏮ ⏭ ayet · ↻ ayeti tekrarla',
    'reader.repeatOn': 'Ayet tekrarlanıyor · ↻ tekrarı bitirir',
    'clock.hijriDate': '{day} {month} {year}',
  },
  ar: {
    'settings.railHint': 'اختر من اليسار · زر الرجوع يغادر الإعدادات',
    'settings.theme.title': 'نظام الألوان',
    'settings.theme.hint': 'يسري على جميع الأقسام. «ورق» هي الخلفية الفاتحة الوحيدة — للغرف المضيئة وللقراءة نهاراً.',
    'settings.theme.mitternacht': 'منتصف الليل',
    'settings.theme.tiefschwarz': 'أسود عميق (OLED)',
    'settings.theme.nachtblau': 'أزرق ليلي',
    'settings.theme.smaragd': 'زمردي',
    'settings.theme.papier': 'ورق',
    'settings.readerContent': 'تحت الآية',
    'settings.readerAutoAdvance': 'المتابعة إلى السورة التالية',
    'reader.controlHint': 'موافق = إيقاف مؤقت · ⏮ ⏭ آية · ↻ تكرار الآية',
    'reader.repeatOn': 'يتم تكرار الآية · ↻ ينهي التكرار',
    'clock.hijriDate': '{day} {month} {year}',
  },
  es: {
    'settings.railHint': 'Elige a la derecha · Atrás sale de los ajustes',
    'settings.theme.title': 'Combinación de colores',
    'settings.theme.hint': 'Se aplica a todas las secciones. «Papel» es el único fondo claro, pensado para salas luminosas y lectura de día.',
    'settings.theme.mitternacht': 'Medianoche',
    'settings.theme.tiefschwarz': 'Negro profundo (OLED)',
    'settings.theme.nachtblau': 'Azul noche',
    'settings.theme.smaragd': 'Esmeralda',
    'settings.theme.papier': 'Papel',
    'settings.readerContent': 'Debajo del versículo',
    'settings.readerAutoAdvance': 'Continuar a la siguiente sura',
    'reader.controlHint': 'OK = pausa · ⏮ ⏭ versículo · ↻ repetir versículo',
    'reader.repeatOn': 'Repitiendo el versículo · ↻ detiene la repetición',
    'clock.hijriDate': '{day} {month} {year}',
  },
  fr: {
    'settings.railHint': 'Choisis à droite · Retour quitte les réglages',
    'settings.theme.title': 'Palette de couleurs',
    'settings.theme.hint': 'S’applique à toutes les sections. « Papier » est le seul fond clair — pour les pièces lumineuses et la lecture de jour.',
    'settings.theme.mitternacht': 'Minuit',
    'settings.theme.tiefschwarz': 'Noir profond (OLED)',
    'settings.theme.nachtblau': 'Bleu nuit',
    'settings.theme.smaragd': 'Émeraude',
    'settings.theme.papier': 'Papier',
    'settings.readerContent': 'Sous le verset',
    'settings.readerAutoAdvance': 'Continuer vers la sourate suivante',
    'reader.controlHint': 'OK = pause · ⏮ ⏭ verset · ↻ répéter le verset',
    'reader.repeatOn': 'Verset répété · ↻ arrête la répétition',
    'clock.hijriDate': '{day} {month} {year}',
  },
  id: {
    'settings.railHint': 'Pilih di sebelah kanan · Tombol kembali keluar dari pengaturan',
    'settings.theme.title': 'Skema warna',
    'settings.theme.hint': 'Berlaku di semua bagian. “Kertas” adalah satu-satunya latar terang — untuk ruangan terang dan membaca di siang hari.',
    'settings.theme.mitternacht': 'Tengah malam',
    'settings.theme.tiefschwarz': 'Hitam pekat (OLED)',
    'settings.theme.nachtblau': 'Biru malam',
    'settings.theme.smaragd': 'Zamrud',
    'settings.theme.papier': 'Kertas',
    'settings.readerContent': 'Di bawah ayat',
    'settings.readerAutoAdvance': 'Lanjut ke surah berikutnya',
    'reader.controlHint': 'OK = jeda · ⏮ ⏭ ayat · ↻ ulangi ayat',
    'reader.repeatOn': 'Ayat diulang · ↻ menghentikan pengulangan',
    'clock.hijriDate': '{day} {month} {year}',
  },
  bn: {
    'settings.railHint': 'ডানদিকে বেছে নিন · ব্যাক বোতাম সেটিংস থেকে বেরিয়ে যায়',
    'settings.theme.title': 'রঙের ধরন',
    'settings.theme.hint': 'সব অংশে প্রযোজ্য। “কাগজ” একমাত্র হালকা পটভূমি — উজ্জ্বল ঘর ও দিনের বেলা পড়ার জন্য।',
    'settings.theme.mitternacht': 'মধ্যরাত',
    'settings.theme.tiefschwarz': 'গাঢ় কালো (OLED)',
    'settings.theme.nachtblau': 'রাতের নীল',
    'settings.theme.smaragd': 'পান্না',
    'settings.theme.papier': 'কাগজ',
    'settings.readerContent': 'আয়াতের নিচে',
    'settings.readerAutoAdvance': 'পরবর্তী সূরায় যান',
    'reader.controlHint': 'OK = বিরতি · ⏮ ⏭ আয়াত · ↻ আয়াত পুনরাবৃত্তি',
    'reader.repeatOn': 'আয়াত পুনরাবৃত্তি হচ্ছে · ↻ থামায়',
    'clock.hijriDate': '{day} {month} {year}',
  },
  fa: {
    'settings.railHint': 'از سمت چپ انتخاب کنید · دکمهٔ بازگشت از تنظیمات خارج می‌شود',
    'settings.theme.title': 'طرح رنگ',
    'settings.theme.hint': 'در همهٔ بخش‌ها اثر دارد. «کاغذ» تنها زمینهٔ روشن است — برای اتاق‌های روشن و خواندن در روز.',
    'settings.theme.mitternacht': 'نیمه‌شب',
    'settings.theme.tiefschwarz': 'سیاه عمیق (OLED)',
    'settings.theme.nachtblau': 'آبی شب',
    'settings.theme.smaragd': 'زمرد',
    'settings.theme.papier': 'کاغذ',
    'settings.readerContent': 'زیر آیه',
    'settings.readerAutoAdvance': 'ادامه به سورهٔ بعد',
    'reader.controlHint': 'تأیید = مکث · ⏮ ⏭ آیه · ↻ تکرار آیه',
    'reader.repeatOn': 'آیه تکرار می‌شود · ↻ تکرار را پایان می‌دهد',
    'clock.hijriDate': '{day} {month} {year}',
  },
  ms: {
    'settings.railHint': 'Pilih di sebelah kanan · Butang kembali keluar dari tetapan',
    'settings.theme.title': 'Skema warna',
    'settings.theme.hint': 'Berkuat kuasa di semua bahagian. “Kertas” ialah satu-satunya latar cerah — untuk bilik terang dan bacaan waktu siang.',
    'settings.theme.mitternacht': 'Tengah malam',
    'settings.theme.tiefschwarz': 'Hitam pekat (OLED)',
    'settings.theme.nachtblau': 'Biru malam',
    'settings.theme.smaragd': 'Zamrud',
    'settings.theme.papier': 'Kertas',
    'settings.readerContent': 'Di bawah ayat',
    'settings.readerAutoAdvance': 'Teruskan ke surah seterusnya',
    'reader.controlHint': 'OK = jeda · ⏮ ⏭ ayat · ↻ ulang ayat',
    'reader.repeatOn': 'Ayat diulang · ↻ menghentikan ulangan',
    'clock.hijriDate': '{day} {month} {year}',
  },
  ur: {
    'settings.railHint': 'بائیں جانب سے منتخب کریں · واپسی کا بٹن ترتیبات سے نکل جاتا ہے',
    'settings.theme.title': 'رنگ سکیم',
    'settings.theme.hint': 'تمام حصوں پر لاگو ہوتا ہے۔ ”کاغذ“ واحد روشن پس منظر ہے — روشن کمروں اور دن میں پڑھنے کے لیے۔',
    'settings.theme.mitternacht': 'نصف شب',
    'settings.theme.tiefschwarz': 'گہرا سیاہ (OLED)',
    'settings.theme.nachtblau': 'رات کا نیلا',
    'settings.theme.smaragd': 'زمرد',
    'settings.theme.papier': 'کاغذ',
    'settings.readerContent': 'آیت کے نیچے',
    'settings.readerAutoAdvance': 'اگلی سورت پر جائیں',
    'reader.controlHint': 'OK = وقفہ · ⏮ ⏭ آیت · ↻ آیت دہرائیں',
    'reader.repeatOn': 'آیت دہرائی جا رہی ہے · ↻ دہرانا ختم کرتا ہے',
    'clock.hijriDate': '{day} {month} {year}',
  },
  ru: {
    'settings.railHint': 'Выбирайте справа · Кнопка «Назад» выходит из настроек',
    'settings.theme.title': 'Цветовая схема',
    'settings.theme.hint': 'Действует во всех разделах. «Бумага» — единственный светлый фон, для светлых комнат и чтения днём.',
    'settings.theme.mitternacht': 'Полночь',
    'settings.theme.tiefschwarz': 'Глубокий чёрный (OLED)',
    'settings.theme.nachtblau': 'Ночная синь',
    'settings.theme.smaragd': 'Изумруд',
    'settings.theme.papier': 'Бумага',
    'settings.readerContent': 'Под аятом',
    'settings.readerAutoAdvance': 'Переходить к следующей суре',
    'reader.controlHint': 'OK = пауза · ⏮ ⏭ аят · ↻ повторить аят',
    'reader.repeatOn': 'Аят повторяется · ↻ прекращает повтор',
    'clock.hijriDate': '{day} {month} {year} г.',
  },
  sw: {
    'settings.railHint': 'Chagua upande wa kulia · Kitufe cha kurudi hutoka kwenye mipangilio',
    'settings.theme.title': 'Mpangilio wa rangi',
    'settings.theme.hint': 'Hutumika kila sehemu. “Karatasi” ndio mandharinyuma pekee angavu — kwa vyumba vyenye mwanga na kusoma mchana.',
    'settings.theme.mitternacht': 'Usiku wa manane',
    'settings.theme.tiefschwarz': 'Nyeusi nzito (OLED)',
    'settings.theme.nachtblau': 'Buluu ya usiku',
    'settings.theme.smaragd': 'Zumaridi',
    'settings.theme.papier': 'Karatasi',
    'settings.readerContent': 'Chini ya aya',
    'settings.readerAutoAdvance': 'Endelea kwenye sura inayofuata',
    'reader.controlHint': 'OK = sitisha · ⏮ ⏭ aya · ↻ rudia aya',
    'reader.repeatOn': 'Aya inarudiwa · ↻ husitisha kurudia',
    'clock.hijriDate': '{day} {month} {year}',
  },
  ps: {
    'settings.railHint': 'له کیڼ اړخه وټاکئ · د شاتګ تڼۍ له تنظیماتو وځي',
    'settings.theme.title': 'د رنګ بڼه',
    'settings.theme.hint': 'په ټولو برخو کې کار کوي. «کاغذ» یوازینۍ روښانه شاليد ده — د روښانه خونو او د ورځې لوستلو لپاره.',
    'settings.theme.mitternacht': 'نيمه شپه',
    'settings.theme.tiefschwarz': 'ژور تور (OLED)',
    'settings.theme.nachtblau': 'د شپې شین',
    'settings.theme.smaragd': 'زمرد',
    'settings.theme.papier': 'کاغذ',
    'settings.readerContent': 'د آیت لاندې',
    'settings.readerAutoAdvance': 'بلې سورې ته دوام',
    'reader.controlHint': 'OK = ځنډ · ⏮ ⏭ آیت · ↻ آیت تکرار',
    'reader.repeatOn': 'آیت تکراریږي · ↻ تکرار پای ته رسوي',
    'clock.hijriDate': '{day} {month} {year}',
  },
};

function lies(obj, pfad) {
  return pfad.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
}

function schreibe(obj, pfad, wert) {
  const teile = pfad.split('.');
  let cur = obj;
  for (const k of teile.slice(0, -1)) {
    if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
    cur = cur[k];
  }
  cur[teile[teile.length - 1]] = wert;
}

/** Schluessel eines Objekts rekursiv sortieren — die TV-Dateien sind sortiert,
 *  und ein unsortierter Nachtrag machte jeden kuenftigen Diff unlesbar. */
function sortiere(o) {
  if (Array.isArray(o) || typeof o !== 'object' || o === null) return o;
  return Object.fromEntries(
    Object.keys(o)
      .sort()
      .map((k) => [k, sortiere(o[k])]),
  );
}

let fehlend = 0;
for (const lang of SPRACHEN) {
  const tvPfad = join(TV, `${lang}.json`);
  const handyPfad = join(HANDY, `${lang}.json`);
  const tv = JSON.parse(readFileSync(tvPfad, 'utf8'));
  const handy = existsSync(handyPfad) ? JSON.parse(readFileSync(handyPfad, 'utf8')) : {};

  for (const [ziel, quelle] of UEBERNAHMEN) {
    const wert = lies(handy, quelle);
    if (typeof wert === 'string') schreibe(tv, ziel, wert);
    else {
      console.warn(`  ${lang}: Handy-Schluessel fehlt → ${quelle}`);
      fehlend++;
    }
  }

  for (const [ziel, wert] of Object.entries(NEU[lang])) schreibe(tv, ziel, wert);

  // Kurznamen der Gebete fuer die sechs Zellen der Uhr. ABGELEITET statt neu
  // uebersetzt: fuer fajr/dhuhr/asr/maghrib/isha steht dort ohnehin schon der
  // kurze Eigenname; nur beim Sonnenaufgang traegt die Zeile eine Erklaerung in
  // Klammern („Shuruq (Sonnenaufgang)"), die in eine Zelle nicht passt.
  const gebete = tv.prayers ?? {};
  for (const key of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'sunrise']) {
    const voll = gebete[key];
    if (typeof voll !== 'string') continue;
    schreibe(tv, `prayers.${key}Short`, voll.replace(/\s*[（(].*$/u, '').trim());
  }

  writeFileSync(tvPfad, JSON.stringify(sortiere(tv), null, 2) + '\n', 'utf8');
  console.log(`  ${lang}: aktualisiert`);
}

if (fehlend > 0) {
  console.error(`\n${fehlend} Handy-Schluessel fehlten — die betroffenen TV-Texte sind NICHT gesetzt.`);
  process.exit(1);
}
console.log('\nAlle 14 Sprachdateien ergaenzt.');
