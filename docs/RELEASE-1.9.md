# Salati TV 1.9.0 / 1.9.1 — Hintergründe, Hintergrundwiedergabe, lange Verse

> Stand 2026-08-16. Ausgeliefert als **1.9.1** — Play versionCode 15,
> App Store Build 5. Vorgänger 1.8.1 ist in beiden Läden freigegeben.
>
> 1.9.0 (vc 14) ging kurz zuvor heraus und wurde noch am selben Tag durch 1.9.1
> ersetzt: danach kamen Korrekturen dazu, die der Nutzer sieht — vor allem der
> Wortabstand im Vers auf Apple TV. Am Funktionsumfang ändert 1.9.1 nichts.

Alles in dieser Fassung geht auf Beobachtungen des Nutzers am Gerät
zurück. Sie stehen hier mit dem, was tatsächlich falsch war — nicht mit dem,
was gebaut wurde.

## 1. „Es fehlt sowas wie verschiedene Hintergründe"

Die fünf Farbwelten aus `lib/theme.ts` haben nur Farbwerte getauscht; jeder
Bildschirm blieb eine gleichmäßig gefüllte Fläche. Auf einem Fernseher, der
stundenlang im Raum steht, ist das der Unterschied zwischen „Gerät an" und
„schön anzusehen".

Neu: `components/Hintergrund.tsx`, **einmal** in `App.tsx` hinter allen
Bildschirmen, mit vier Möglichkeiten — *Ruhig*, *Lichtschein*, *Verlauf*,
*Muster* (achtzackiger Rub-al-Hizb-Stern, als Raster). Die Wahl steht in den
Einstellungen unter *Anzeige* und wird gespeichert.

**Am Gerät nachgemessen, zweimal korrigiert.** Die erste Fassung des Musters
benutzte `<Pattern patternUnits="userSpaceOnUse">` und kam auf dem Android-TV-
Emulator **gar nicht an**: eine Pixelmessung über 600 Punkte der dunklen Ecke
ergab durchgehend denselben Wert (11,11,13). Der Verlauf daneben (LinearGradient,
gleiche `id`-Mechanik) kam an — es lag also an `Pattern`, nicht an der Referenz.
Das Raster wird jetzt ausgerechnet und als **ein** Pfad gezeichnet. Und der
Verlauf war mit 14 % am unteren Rand kaum wahrnehmbar; jetzt 24 %.

Bewusst **ohne Fotos**: ein 4K-Bild wären mehrere Megabyte im Paket, und die
vorhandenen Motive der Handy-App liegen bei 900 px — auf 65 Zoll hochskaliert
sehen sie weich und wie ein Fehler aus. Alles ist gezeichnet (react-native-svg),
damit in jeder Auflösung scharf und ohne Ladezeit.

## 2. „Das Menü hat manchmal verdeckte Ränder von dem gelben Quadrat"

`FocusCard` wächst im Fokus auf 1,05 und trägt einen 2 dp starken Rahmen. Ein
`ScrollView` schneidet seine Kinder an seinen Grenzen ab — der ersten und
letzten Kachel jeder Reihe fehlte damit ein Stück des goldenen Rahmens, oben und
unten allen.

Der Ausgleich ist immer dasselbe Paar: negativer Rand am ScrollView, gleich
großer Innenabstand am Inhalt. Die Schnittkante wandert nach außen, die Karten
bleiben stehen. Die Regel steht jetzt an **einer** Stelle
(`components/fokusUeberstand.ts`) und wird von sechs Bildschirmen benutzt:
Startbildschirm, die drei Medienreihen, Radio, Rezitatoren, Suren-Auswahl und
die Einstellungen.

## 3. „Koran im Hintergrund laufen lassen und im Vordergrund die Gebetsuhr"

Der Ton hing an `useVideoPlayer()` **innerhalb** von `AudioNowPlaying`, und
dieser Baustein hing im Rezitatoren-Bildschirm. Wer zur Gebetsuhr wechselte,
hängte damit den Spieler aus — die Rezitation brach mitten im Vers ab. Genau
das, wofür ein Fernseher da ist, war nicht möglich.

Der Spieler liegt jetzt **neben** dem Baum, nicht darin
(`lib/hintergrundAudio.ts`, `useSyncExternalStore`) — dasselbe Muster wie
`lib/settings.ts`, aus demselben Grund: Zustand, der länger lebt als ein
Bildschirm, darf nicht an dessen Lebensdauer hängen.

Ein schmaler Streifen am unteren Rand (`components/HintergrundStreifen.tsx`)
zeigt auf Startbildschirm und Uhr, was läuft, und hält es an. Ohne ihn wäre es
Ton aus dem Nichts: der Nutzer sähe die Uhr, hörte eine Rezitation und hätte
keinen Weg, sie zu beenden, ohne den Bereich zu suchen, aus dem sie kam.

**Nachgezogen:** seit der Ton den Bildschirmwechsel überlebt, kann er laufen,
während etwas anderes Ton macht. Der Gebetsruf (der Vorrang hat), der
Koran-Leser mit seiner Vers-Rezitation und der Video-Spieler halten die
Hintergrundwiedergabe jetzt an — angehalten, nicht beendet, damit man danach
dort weiterhört, wo man war.

## 4. „Bei langen Versen ist der Text viel zu viel für den Bildschirm"

Der Vers lag in einer Fläche mit `flex: 1` und mittiger Ausrichtung. Wächst der
Inhalt darüber hinaus, schiebt er in React Native nicht, sondern läuft über. Der
Wurzel-View hat `overflow: 'hidden'`, also verschwand der Anfang oben, das Ende
unten, und Umschrift und Übersetzung lagen auf der Bedienleiste.

Die Zahlen: bei der größten Schriftstufe misst ein Vers 150 px Schriftgrad bei
210 px Zeilenhöhe. Auf einem 1080er Panel bleiben der Bühne rund 700 px — also
drei Zeilen. Sure 2, Vers 282 hat 128 Wörter und braucht dort über dreißig. Der
Vers war zu 90 % unsichtbar.

`lib/versSeiten.ts` rechnet jetzt, was hineinpasst:

- Erst wird die Schrift kleiner, in vier Stufen bis 64 %. Darunter nicht — auf
  drei Meter Abstand wäre der Vers sonst nicht mehr lesbar.
- Reicht das nicht, wird der Vers in **Abschnitte** geteilt, die je vollständig
  zu sehen sind. Die Kopfzeile zeigt „Abschnitt 2 / 4".
- Die Wiedergabe blättert von selbst mit (die Wort-Zeitstempel sagen, in welchem
  Abschnitt sie steht); ⏮ ⏭ blättert von Hand und nimmt die Rezitation mit.
  Erst am Ende des Verses wechseln sie zum nächsten.
- Die Übersetzung wird der Länge nach mitverteilt, statt nach vier Zeilen
  abgeschnitten zu werden. Die Zuordnung ist ungefähr, nicht wortgenau — das ist
  im Code so vermerkt.

**Bewusst kein Scrollen:** eine Bildlaufleiste braucht auf dem Fernseher den
Fokus, und der gehört der Bedienleiste.

Durchgerechnet über alle vier Schriftstufen und beide Belegungen: 12 Wörter (der
Mittelwert im Koran) bleiben überall in einem Stück, 25 Wörter in fast allen
Fällen; erst die wirklich langen Verse werden geteilt.

## 5. „Man soll einstellen können, ob man lateinische Buchstaben oder Übersetzung haben möchte"

Beide Schalter gab es — aber nur in den Einstellungen, zwei Bildschirme vom
Lesen entfernt, und beim Zurückkommen war die Sure weg. Sie stehen jetzt
zusätzlich in der Bedienleiste des Lesers, beschriftet statt als Zeichen: „Aa"
versteht auf drei Meter Abstand niemand. Der Wert wird gespeichert wie zuvor,
es ist derselbe Schalter.

## 6. „Dass man Home, Zurück usw. — also Optionen — ausblenden kann"

Ein Fernseher steht stundenlang im Raum. Die Gebetsuhr ist dafür gemacht — die
Zeile darunter („OK öffnet das Menü") ist es nicht: beim ersten Mal nötig,
danach nur noch Text auf einem Bild, das sonst nichts sagen will. Dasselbe gilt
für „OK = Pause · Zurück = Liste" im Rezitatoren-Bildschirm und die Bedienleiste
des Lesers.

Neu unter *Anzeige* → **Bedienhinweise**: *Immer sichtbar* (ab Werk), *Nach 10
Sekunden*, *Nach 30 Sekunden*. Jeder Tastendruck holt sie zurück und beginnt die
Wartezeit von vorn.

Zwei bewusste Entscheidungen:

- **Ausgeblendet wird über die Deckkraft, nicht durch Ausbauen.** Die Knöpfe
  bleiben an ihrem Platz und fokussierbar; wären sie weg, spränge der Fokus beim
  Wiedereinblenden irgendwohin und der erste Tastendruck ginge ins Leere.
- **Ab Werk verschwindet nichts.** Wer die App nicht kennt, soll die Bedienung
  nicht suchen müssen. Die Einstellung steht dafür direkt neben dem Hintergrund.

Der Zustand liegt neben dem Baum (`lib/bedienungSichtbar.ts`): die
Tastenereignisse kommen in `App.tsx` an, gebraucht wird die Antwort in vier
Bildschirmen, und keiner davon ist Elternteil eines anderen.

## Prüfstand

    npx tsc --noEmit    0 Fehler
    npm run lint        0 Errors
    npx jest            631 Tests, 30 Suiten

Neu geprüft wird unter anderem: dass beim Aufteilen kein Wort verloren geht oder
doppelt erscheint, dass kein Abschnitt mehr Zeilen braucht als hineinpassen,
dass die Übersetzung eines langen Verses vollständig erreichbar ist, dass die
Schalter im Leser wirklich in die Einstellungen durchschlagen, und dass eine
laufende Rezitation angehalten wird, wenn der Gebetsruf kommt.

## Bauweg

Nicht über EAS — dort bricht der Build seit dem 2026-08-16 reproduzierbar nach
13 Sekunden mit `UNKNOWN_ERROR` und ohne Fehlerzeile ab. Gebaut wird über
GitHub Actions im öffentlichen Mirror:

    GH_TOKEN=… bash scripts/sync-public-build.sh
    gh workflow run "Android TV APK"   -R MenuCloud-Berlin/salati-tv-build -f art=aab
    gh workflow run "tvOS Release IPA" -R MenuCloud-Berlin/salati-tv-build -f buildNummer=2

`eas.json` steht seit 1.9.0 auf `appVersionSource: "local"`: die Fernzählung von
EAS stand bei 8, Play aber bei 13 — jeder Upload wäre abgelehnt worden.
