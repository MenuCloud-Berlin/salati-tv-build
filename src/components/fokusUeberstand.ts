/**
 * Wie weit eine fokussierte Karte ueber ihre eigene Flaeche hinauswaechst.
 *
 * `FocusCard` skaliert im Fokus auf 1,05 — also 2,5 % je Seite — und traegt
 * einen 2 dp starken Rahmen. Ein `ScrollView` schneidet seine Kinder an seinen
 * Grenzen ab: ohne Ausgleich fehlt der ersten und letzten Karte einer Reihe ein
 * Stueck des goldenen Rahmens, und oben und unten allen (Nutzerbefund
 * 2026-08-16: „das Menue hat manchmal verdeckte Raender von dem gelben
 * Quadrat").
 *
 * Der Ausgleich ist immer dasselbe Paar: ein NEGATIVER Rand am ScrollView und
 * ein gleich grosser Innenabstand am Inhalt. Die Schnittkante wandert nach
 * aussen, die Karten bleiben, wo sie sind.
 *
 *     const u = fokusUeberstand(Math.max(kartenBreite, kartenHoehe));
 *     scroll: { marginHorizontal: -u, marginVertical: -u }
 *     inhalt: { paddingHorizontal: u, paddingTop: u, paddingBottom: padV + u }
 *
 * @param kartenmass Die groessere Kantenlaenge der Karte in dp.
 */
export function fokusUeberstand(kartenmass: number): number {
  return Math.ceil(Math.max(0, kartenmass) * 0.025) + 2;
}
