/**
 * Zeiten in der Zeitzone des GEWÄHLTEN ORTES statt in der des Fernsehers.
 *
 * DER BEFUND (Audit 2026-07-29, P10/K5; bis 1.5.0 offen): Beide Apps rechnen
 * über JS-`Date`, also in der Gerätezeitzone. Wer am Fernseher eine Stadt in
 * einer anderen Zone wählt — ein Fernseher in Berlin, eingestellt auf Makkah —
 * bekam die richtigen ZEITPUNKTE, aber abgelesen in Berliner Zeit. Am Emulator
 * war das mit Händen zu greifen: bei Gerätezeitzone GMT stand Berlin-Fadschr
 * als 00:51 statt 02:51.
 *
 * Die Zeitpunkte waren nie falsch — nur die Beschriftung. Genau deshalb fällt
 * es niemandem auf, der nicht nachrechnet.
 *
 * WARUM MIT FÄHIGKEITSPRÜFUNG: `Intl.DateTimeFormat` mit `timeZone` braucht
 * eine vollständige ICU. Hermes bringt sie auf aktuellen Android-Versionen mit,
 * ältere Fire-TV-Firmwares aber nicht — dort wirft die Umrechnung entweder oder
 * ignoriert die Zone still. Das Stille ist das Gefährliche: die App zeigte dann
 * wieder Gerätezeit und behauptete Ortszeit. Deshalb wird die Fähigkeit EINMAL
 * an einem Fall mit bekanntem Ergebnis gemessen, nicht angenommen.
 */

/** Ergebnis der einmaligen Messung; `null` = noch nicht gemessen. */
let faehig: boolean | null = null;

/**
 * Kann dieses Gerät in eine fremde Zeitzone umrechnen?
 *
 * Gemessen an einem Zeitpunkt, dessen Ergebnis feststeht: Der 1. Januar 2026,
 * 12:00 UTC ist in Tokio (UTC+9, keine Sommerzeit) 21:00. Kommt etwas anderes
 * heraus — oder wirft es —, wird die Zone ignoriert und die Umrechnung ist
 * unbrauchbar.
 */
export function zeitzonenFaehig(): boolean {
  if (faehig !== null) return faehig;
  try {
    const probe = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(Date.UTC(2026, 0, 1, 12, 0, 0)));
    faehig = probe.startsWith('21');
  } catch {
    faehig = false;
  }
  return faehig;
}

/** Nur für Tests: setzt die Messung zurück. */
export function zeitzonenMessungZuruecksetzen(): void {
  faehig = null;
}

/**
 * Uhrzeit im angegebenen IANA-Zonennamen. Ohne Zone — oder auf einem Gerät
 * ohne die nötige ICU — die Gerätezeit, damit nie eine leere Zeile entsteht.
 */
export function zeitInZone(date: Date, tz: string | undefined, is24h: boolean): string {
  if (!tz || !zeitzonenFaehig()) return standardZeit(date, is24h);
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: !is24h,
    })
      .format(date)
      .replace(/\s?(am|pm)/i, (m) => m.toUpperCase().trim().padStart(3, ' '));
  } catch {
    return standardZeit(date, is24h);
  }
}

/** Rückfall: dieselbe Formatierung wie vor der Zeitzonen-Unterstützung. */
function standardZeit(date: Date, is24h: boolean): string {
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, '0');
  if (is24h) return `${h.toString().padStart(2, '0')}:${m}`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * Der KALENDERTAG am Ort — als `Date` in der Gerätezeitzone, mit den
 * Jahr/Monat/Tag-Werten des Ortes.
 *
 * Gebraucht, weil die Gebetszeit-Rechnung (adhan) aus einem `Date` nur
 * Jahr, Monat und Tag liest und den Rest selbst aus den Koordinaten bestimmt.
 * Ohne diese Umrechnung berechnete ein Fernseher in Berlin um 23:30 für einen
 * Ort in Jakarta noch den Vortag — dort ist längst der nächste Tag.
 */
export function tagAmOrt(now: Date, tz: string | undefined): Date {
  if (!tz || !zeitzonenFaehig()) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  try {
    const teile = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now); // en-CA liefert YYYY-MM-DD
    const [j, m, t] = teile.split('-').map(Number);
    if (!j || !m || !t) throw new Error('unlesbar');
    return new Date(j, m - 1, t);
  } catch {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
}

/**
 * Weicht die Zone des Ortes gerade von der des Fernsehers ab?
 *
 * Nur dann ist ein Hinweis am Bildschirm sinnvoll — im Normalfall (Fernseher
 * und Ort in derselben Zone) wäre er nur Lärm.
 */
export function zoneWeichtAb(now: Date, tz: string | undefined): boolean {
  if (!tz || !zeitzonenFaehig()) return false;
  return zeitInZone(now, tz, true) !== standardZeit(now, true);
}
