import { useCallback, useEffect, useRef } from 'react';

import { anmelden, fokusGemeldet, fokusVerloren, lageGemeldet, type Lage } from '@/lib/fernfokus';
import { useLatestRef } from '@/lib/useLatestRef';

/** Was react-native-tvos an eine fokussierbare View haengt. */
export interface TvView {
  requestTVFocus?: () => void;
  measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
}

/**
 * Meldet ein fokussierbares Element beim Fokus-Verzeichnis an (s.
 * lib/fernfokus.ts) und liefert die vier Anschluesse, die es dafuer braucht.
 *
 * Zwei Aufrufer: `FocusCard` (jede Kachel der App) und die Uhr-Flaeche in
 * App.tsx. Sie ist die einzige fokussierbare Stelle ausserhalb der Karten —
 * ohne sie fuehrte das Steuerkreuz des Handys auf der Uhr in den
 * Hintergrund-Streifen und nicht wieder heraus.
 */
export function useFernFokusKarte(onPress?: () => void) {
  const viewRef = useRef<TvView | null>(null);
  const idRef = useRef<number | null>(null);
  // Der Handler darf nicht an einer alten Closure haengen: das Verzeichnis
  // haelt das Element ueber seine ganze Lebensdauer, `onPress` wechselt aber
  // bei jedem Render (Listen erzeugen ihre Rueckrufe neu).
  const pressRef = useLatestRef(onPress);

  const messen = useCallback(
    () =>
      new Promise<Lage | null>((fertig) => {
        const el = viewRef.current;
        if (!el?.measureInWindow) {
          fertig(null);
          return;
        }
        // Kommt die Antwort nicht (Element im selben Takt ausgehaengt), bleibt
        // es bei der zuletzt bekannten Lage — der Aufrufer faellt darauf zurueck.
        const wecker = setTimeout(() => fertig(null), 250);
        el.measureInWindow((x, y, w, h) => {
          clearTimeout(wecker);
          fertig({ x, y, w, h });
        });
      }),
    [],
  );

  useEffect(() => {
    const { id, abmelden } = anmelden({
      messen,
      fokussieren: () => viewRef.current?.requestTVFocus?.(),
      ausloesen: () => pressRef.current?.(),
    });
    idRef.current = id;
    return () => {
      idRef.current = null;
      abmelden();
    };
  }, [messen, pressRef]);

  // `unknown` statt `TvView`: React typisiert den Ref eines Pressable auf
  // `View`, und `requestTVFocus` steht in keiner der oeffentlichen Typen von
  // react-native-tvos — es ist ein natives Kommando, das die Plattform der
  // Instanz zur Laufzeit anhaengt (s. Libraries/Components/View/View.js).
  const setzeRef = useCallback((el: unknown) => {
    viewRef.current = (el ?? null) as TvView | null;
  }, []);

  const beiLayout = useCallback(() => {
    // Die Lage schon beim Aufbau melden, nicht erst beim ersten Tastendruck:
    // sonst faende die erste Richtungstaste nach dem Bildschirmwechsel noch
    // nichts vor.
    const id = idRef.current;
    if (id === null) return;
    void messen().then((l) => {
      if (l && idRef.current === id) lageGemeldet(id, l);
    });
  }, [messen]);

  const beiFokus = useCallback(() => {
    if (idRef.current !== null) fokusGemeldet(idRef.current);
  }, []);

  const beiFokusVerlust = useCallback(() => {
    if (idRef.current !== null) fokusVerloren(idRef.current);
  }, []);

  return { setzeRef, beiLayout, beiFokus, beiFokusVerlust };
}
