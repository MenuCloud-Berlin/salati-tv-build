import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

import { pausieren as hintergrundPausieren } from '@/lib/hintergrundAudio';

// Vollbild-Video-Player (expo-video → nativer ExoPlayer auf Android/Fire TV,
// löst das Decoder-/Performance-Thema aus dem Masterplan §12.A). Wiederverwendbar
// für Lern-Videos, Reels und Podcast-Videos. `onEnd`/Zurück steuert der Aufrufer.
export function VideoPlayer({ uri, onEnd }: { uri: string; onEnd?: () => void }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener('playToEnd', () => onEnd?.());
    return () => sub.remove();
  }, [player, onEnd]);

  // Eine im Hintergrund laufende Rezitation anhalten, solange dieses Video
  // spielt — sonst laegen zwei Tonspuren uebereinander. Sie bleibt stehen und
  // laesst sich vom Startbildschirm aus wieder anstossen.
  useEffect(() => {
    hintergrundPausieren();
  }, []);

  return (
    <View style={styles.root}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1 },
});
