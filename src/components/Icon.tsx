import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

// Eigene, marken-konsistente Linien-Icons (react-native-svg — schon als Dep
// vorhanden, keine Emoji mehr). Stroke-basiert, 24er-Viewbox, erben Größe+Farbe.
// Bewusst kein Icon-Font/Drittanbieter: volle Kontrolle über den 10-Fuß-Look
// (kräftige Linien, gold), und ein Build-Risiko weniger.
export type IconName =
  | 'clock'
  | 'book'
  | 'reader'
  | 'radio'
  | 'video'
  | 'headphones'
  | 'bolt'
  | 'quiz'
  | 'phone'
  | 'settings'
  | 'play'
  | 'pause'
  | 'back'
  | 'up'
  | 'down'
  | 'left'
  | 'right';

export function Icon({ name, size = 28, color = '#d4af37' }: { name: IconName; size?: number; color?: string }) {
  const sw = Math.max(1.4, size * 0.075); // Strichstärke skaliert mit der Größe
  const p = { stroke: color, strokeWidth: sw, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'clock' && (
        <>
          <Circle cx={12} cy={12} r={9} {...p} />
          <Polyline points="12,7 12,12 15.5,14" {...p} />
        </>
      )}
      {name === 'book' && (
        <>
          <Path d="M12 6.2C9.8 4.7 6.8 4.4 3.5 5v13c3.3-.6 6.3-.3 8.5 1.2" {...p} />
          <Path d="M12 6.2C14.2 4.7 17.2 4.4 20.5 5v13c-3.3-.6-6.3-.3-8.5 1.2" {...p} />
        </>
      )}
      {name === 'reader' && (
        <>
          <Path d="M4 4.5h6a2.5 2.5 0 0 1 2 1 2.5 2.5 0 0 1 2-1h6v13h-6a2.5 2.5 0 0 0-2 1 2.5 2.5 0 0 0-2-1H4v-13Z" {...p} />
          <Line x1={6.5} y1={8} x2={9.5} y2={8} {...p} />
          <Line x1={14.5} y1={8} x2={17.5} y2={8} {...p} />
          <Line x1={6.5} y1={11} x2={9.5} y2={11} {...p} />
          <Line x1={14.5} y1={11} x2={17.5} y2={11} {...p} />
        </>
      )}
      {name === 'radio' && (
        <>
          <Circle cx={12} cy={13} r={2.4} {...p} />
          <Path d="M8.5 9.5a5 5 0 0 0 0 7M15.5 9.5a5 5 0 0 1 0 7" {...p} />
          <Path d="M6 7a8.5 8.5 0 0 0 0 12M18 7a8.5 8.5 0 0 1 0 12" {...p} />
        </>
      )}
      {name === 'video' && (
        <>
          <Rect x={3} y={5} width={18} height={14} rx={2.5} {...p} />
          <Path d="M10.5 9.2 15 12l-4.5 2.8V9.2Z" {...p} fill={color} />
        </>
      )}
      {name === 'headphones' && (
        <>
          <Path d="M4 13v-1a8 8 0 0 1 16 0v1" {...p} />
          <Rect x={3} y={13} width={4} height={6} rx={1.6} {...p} />
          <Rect x={17} y={13} width={4} height={6} rx={1.6} {...p} />
        </>
      )}
      {name === 'bolt' && <Path d="M13 3 5 13h5l-1 8 8-11h-5l1-7Z" {...p} fill={color} />}
      {name === 'quiz' && (
        <>
          <Circle cx={12} cy={12} r={9} {...p} />
          <Path d="M9.2 9.3a2.8 2.8 0 0 1 5.3 1.2c0 1.9-2.7 2.3-2.7 4" {...p} />
          <Circle cx={11.8} cy={16.6} r={0.6} fill={color} stroke={color} />
        </>
      )}
      {name === 'phone' && (
        <>
          <Rect x={7} y={2.5} width={10} height={19} rx={2.5} {...p} />
          <Line x1={10.5} y1={18.5} x2={13.5} y2={18.5} {...p} />
        </>
      )}
      {name === 'settings' && (
        <>
          <Circle cx={12} cy={12} r={3} {...p} />
          <Path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
            {...p}
          />
        </>
      )}
      {name === 'play' && <Path d="M8 5.5 18 12 8 18.5V5.5Z" {...p} fill={color} />}
      {/* Zwei Balken statt zweier schmaler Rechtecke mit Rahmen: gefuellt
          bleibt die Pause aus drei Metern erkennbar, ein Umriss nicht. */}
      {name === 'pause' && <Path d="M8.5 5.5h2.6v13H8.5V5.5Zm4.4 0h2.6v13h-2.6V5.5Z" {...p} fill={color} />}
      {name === 'back' && (
        <>
          <Polyline points="10,7 5,12 10,17" {...p} />
          <Path d="M5 12h9a5 5 0 0 1 0 10h-1" {...p} />
        </>
      )}
      {name === 'up' && <Polyline points="6,15 12,9 18,15" {...p} />}
      {name === 'down' && <Polyline points="6,9 12,15 18,9" {...p} />}
      {name === 'left' && <Polyline points="15,6 9,12 15,18" {...p} />}
      {name === 'right' && <Polyline points="9,6 15,12 9,18" {...p} />}
    </Svg>
  );
}
