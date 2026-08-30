import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Systemeinstellung „Bewegung reduzieren".
 *
 * Als eigene Datei, weil ihn drei Hintergruende brauchen (Rosette,
 * Sternenhimmel, wanderndes Foto) — und weil er sonst einen Ringschluss baut:
 * `MedienGrund` holte ihn aus `Hintergrund`, das ihn selbst wieder einbindet
 * (Geraetebefund 2026-08-30, „Require cycle" im Protokoll des Emulators).
 *
 * Eine CSS-Regel greift hier nicht: React Native kennt keine Media Query, die
 * Abfrage muss ueber `AccessibilityInfo` laufen.
 */
export function useReduzierteBewegung(): boolean {
  const [ruhig, setRuhig] = useState(false);
  useEffect(() => {
    let lebt = true;
    AccessibilityInfo.isReduceMotionEnabled().then((an) => lebt && setRuhig(an));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (an) => setRuhig(an));
    return () => {
      lebt = false;
      sub.remove();
    };
  }, []);
  return ruhig;
}
