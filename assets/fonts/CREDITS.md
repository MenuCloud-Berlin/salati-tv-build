# Font-Lizenzen (assets/fonts)

Acht arabische Schriften, alle in der App auswählbar (Einstellungen → Koran-
Schriftart). Registry `apps/mobile/src/features/quran/fonts.ts`, geladen
nachladend über `apps/mobile/src/features/quran/useQuranFont.ts` — im Speicher
liegt immer nur die aktive Schrift.

| Datei | Font | Version | Größe | Lizenz | Herkunft |
|---|---|---|---|---|---|
| `kfgqpc-hafs.ttf` | KFGQPC HAFS Uthmanic Script | 0.18 | 237 KB | Font-interne EULA | King Fahd Glorious Quran Printing Complex, Al-Madinah Al-Munawwarah — Entwickler-Portal `qurancomplex.gov.sa/en/techquran/dev/`, bezogen über Mirror `github.com/thetruetruth/quran-data-kfgqpc` |
| `amiri-quran.ttf` | Amiri Quran | 1.003 | 134 KB | SIL OFL 1.1 | `github.com/aliftype/amiri` (über `google/fonts`) |
| `amiri.ttf` | Amiri | 1.002 | 421 KB | SIL OFL 1.1 | `github.com/aliftype/amiri` (über `google/fonts`) |
| `scheherazade-new.ttf` | Scheherazade New | 4.500 | 324 KB | SIL OFL 1.1 | SIL Global, `software.sil.org/scheherazade` |
| `lateef.ttf` | Lateef | 4.400 | 235 KB | SIL OFL 1.1 | SIL Global, `software.sil.org/lateef` |
| `harmattan.ttf` | Harmattan | 4.400 | 560 KB | SIL OFL 1.1 | SIL Global, `software.sil.org/harmattan` |
| `noto-naskh-arabic.ttf` | Noto Naskh Arabic | 2.021 | 242 KB | SIL OFL 1.1 | Noto Project, `notofonts.github.io` (hinted TTF) |
| `noto-sans-arabic.ttf` | Noto Sans Arabic | 2.013 | 229 KB | SIL OFL 1.1 | Noto Project, `notofonts.github.io` (hinted TTF) |

Zusammen 2,33 MB im Bundle. Alle Dateien werden **unverändert** weitergegeben.

## Aufnahmekriterium: der Font muss den Koran setzen können

`node scripts/pruefe-koran-fonts.mjs` liest jede Datei byteweise aus und lässt
eine Schrift nur durch, wenn ihre `cmap` den vollständigen koranischen
Zeichenvorrat abdeckt: Harakat (U+064B–U+0652), Hamza-Aufsätze (U+0653–U+0655),
Alif khanjariyya (U+0670), Alif waṣla (U+0671), Waqf-/Rezitationszeichen
(U+06D6–U+06DC, U+06DF–U+06E4, U+06EA–U+06ED), Sure-Ende (U+06DD) und die
arabischen Ziffern. Dasselbe Skript prüft, ob die Metriken in `fonts.ts` noch
zur Datei passen. Alle acht bestehen; alle acht führen `mark` und `mkmk` in
GPOS, die Positionierung der Vokalzeichen ist also in der Schrift hinterlegt.

**Ein cmap-Eintrag beweist aber nicht, dass die Schrift das Zeichen zeichnen
kann.** Der KFGQPC-Font trägt 171 Codepoints ein, die er nicht unterstützt, und
zeigt für alle denselben Platzhalter — einen ausgefüllten Punkt in einem
gepunkteten Kreis. Drei davon stehen im Uthmani-Text: U+06DF (in 2.240 der
6.236 Verse, z. B. „كَفَرُوا۟"), U+06E3 (52:37) und U+06EB (12:11). Seit dem
2026-07-31 vergleicht das Skript deshalb zusätzlich die Glyph-Umrisse: teilen
sich im Bereich U+0600–U+06FF zehn oder mehr Codepoints denselben Umriss, ist
das ein Platzhalter und kein Buchstabe.

Die Ursache ist keine kaputte Datei, sondern eine andere Textausgabe: Die
KFGQPC-Schrift ist für die **hauseigene** Textausgabe des King Fahd Complex
gezeichnet, die App zeigt den Uthmani-Text von api.quran.com. Beide schreiben
dieselben Zeichen unterschiedlich. Weil die EULA (§1) jede Veränderung der
Schriftdatei verbietet, wird der **Text** an die Schrift angepasst statt
umgekehrt — `adaptQuranText()` in `features/quran/fonts.ts`, Zuordnung Stelle
für Stelle aus der offiziellen KFGQPC-Ausgabe `hafsData_v18` abgelesen. Geprüft
wurden auch die offizielle Version 2.2 (`UthmanicHafs_V22`) und „Hafs Smart":
V2.2 hat exakt dieselben Platzhalter, „Hafs Smart" ist PUA-kodiert und als
Unicode-Schrift unbrauchbar.

**Fünf naheliegende Kandidaten sind an dieser Prüfung gescheitert** (Stand
2026-07-31) und deshalb NICHT dabei — sie hätten mitten im Vers Tofu-Kästchen
erzeugt:

| Kandidat | Fehlende Pflichtzeichen |
|---|---|
| Noto Nastaliq Urdu (OFL) | 19 Waqf-/Rezitationszeichen |
| Gulzar (OFL, Nastaliq) | 23 |
| Markazi Text (OFL) | alle 24 + Sure-Ende U+06DD |
| Mirza (OFL) | U+06E5 (kleines Waw) |
| Alkalami (OFL) | 21 + Alif waṣla |

Bemerkenswert daran: **keine der geprüften Nastaliq-Schriften kann Uthmani-Text
darstellen.** Für Leser, die Nastaliq gewohnt sind, ist das kein Versäumnis der
App, sondern der Stand der freien Schriften — Scheherazade New und Lateef sind
die license-saubere Antwort für den südasiatischen Raum (SIL hat beide
ausdrücklich dafür mitentworfen).

## Metriken — gemessen, nicht geschätzt

`fonts.ts` enthält je Schrift zwei aus der Datei ausgelesene Zahlen:

* `lineBoxEm` = `OS/2 usWinAscent + usWinDescent` / `unitsPerEm` — die Box, die
  die Schrift selbst als „hier liegt meine ganze Tinte" angibt. Android bemisst
  die Zeilenhöhe mit `includeFontPadding` über genau diese Werte. Gestapelte
  Koran-Zeichen (Shadda + Fatha + Waqf-Zeichen darüber) liegen bei mehreren
  Schriften außerhalb der knapperen `hhea`-Box; wird die Zeilenhöhe danach
  bemessen, schneidet Android sie oben ab.
* `sizeFactor` = `0.633 / eigene Alif-Höhe` (glyf-Bounding-Box von U+0627,
  Referenz ist KFGQPC HAFS). Ohne ihn wirkt derselbe Schriftgrad je Schrift
  unterschiedlich groß — Harmattan zeichnet 19 % kleiner, Amiri 14 % größer.

## Lizenzpflichten

* **SIL OFL 1.1** (sieben Schriften) — §1 erlaubt Bündeln und Weitergabe mit
  Software, §2 verlangt Lizenztext und Urhebervermerk bei jeder Kopie: Volltext
  in `public/licenses/ofl-1.1.txt` (im App-Bundle als
  `src/features/licenses/texts.json`, auf der Webseite unter `/licenses/`),
  Vermerke in `public/licenses/NOTICE.txt` Abschnitt 2. §3 verbietet die
  Reserved Font Names für veränderte Fassungen — wir verändern keine.
* **KFGQPC HAFS** — die im Font eingebettete EULA (Name-ID 13) gestattet
  Nutzung, Kopie und Weitergabe kostenfrei, sofern der Lizenztext mitgeliefert
  wird; er liegt als `public/licenses/kfgqpc-hafs-font-eula.txt` bei. Die
  Einbindung erfolgte auf ausdrückliche Anweisung des Produktinhabers (Session
  2026-07-18), der die zuvor bestehende Lizenz-Blockade als geklärt erklärt hat;
  bei Rückfragen zur kommerziellen Distribution vor Store-Veröffentlichung
  erneut prüfen.

## Bewusst NICHT eingebunden

**KFGQPC Uthman Taha Naskh**: der offizielle Download
(`fonts.qurancomplex.gov.sa`) war am 2026-07-31 nicht erreichbar, und die
kursierenden Spiegel sind nicht als authentische Fassung belegbar. Der
Uthmani-Standard desselben Hauses liegt mit `kfgqpc-hafs.ttf` bereits bei.

**IndoPak-Schriften** (PDMS Saleem, Me Quran, AlQalam, Noorehira u. a.):
durchweg ohne klare, belegbare Weitergabe-Lizenz — dieselbe Rechtekette-Frage,
an der schon der Hadith-Bestand hing (Release 1.43.0). Für den
IndoPak-Schriftstil (`mushafStyle: 'indopak'`) sind Scheherazade New und Lateef
vorgesehen.
