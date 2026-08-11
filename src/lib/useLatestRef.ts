// Haelt einen Ref auf dem jeweils aktuellen Wert — fuer Listener, die einmal
// registriert werden (Fernbedienung, Pairing, Player-Ereignisse) und trotzdem
// den frischen Stand sehen sollen, ohne bei jeder Zustandsaenderung neu zu
// abonnieren.
//
// Die Zuweisung liegt bewusst in einem Effekt und NICHT im Render-Koerper:
// `ref.current = wert` waehrend des Renderns ist ein Seiteneffekt im Render
// (ESLint react-hooks/refs, seit der ESLint-Einrichtung 2026-07-29 sichtbar)
// und bricht unter Strict Mode / React Compiler. Fuer die genannten Faelle ist
// der Effekt gleichwertig: er laeuft, bevor der Nutzer die naechste Taste
// druecken kann.
import { useEffect, useRef, type MutableRefObject } from 'react';

export function useLatestRef<T>(wert: T): MutableRefObject<T> {
  const ref = useRef(wert);
  useEffect(() => {
    ref.current = wert;
  }, [wert]);
  return ref;
}
