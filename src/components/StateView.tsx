import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { FocusCard } from '@/components/FocusCard';
import { useTranslation } from '@/lib/i18n';
import { useTheme } from '@/lib/useTheme';

// Gemeinsame Lade-/Fehler-/Leer-Flaeche fuer alle TV-Screens.
//
// WARUM ES DIESE KOMPONENTE GIBT (Audit 2026-07-28): Lade- und Fehlerzustaende
// waren vorher reine View/Text-Baeume OHNE ein einziges fokussierbares Element.
// Auf Android TV / Fire TV bekommt die Fernbedienung dann keinen Fokus-Anker:
// D-Pad und OK laufen ins Leere und der Bildschirm fuehlt sich tot an — exakt
// der Fehler, der am 2026-07-24 schon einmal am Clock-Screensaver auftrat.
// Zusaetzlich war ein Fehlschlag endgueltig: `setError(true)` liess sich ohne
// Verlassen und Neubetreten des Bereichs nicht zuruecknehmen, obwohl kein
// einziger Netz-Abruf der App einen Timeout hat.
//
// Deshalb: JEDER Zustand hier bringt eine fokussierbare Karte mit
// `hasTVPreferredFocus` mit — beim Fehler als „Erneut versuchen", beim Laden
// als Abbruch-/Zurueck-Anker.
//
// Beschriftungen kommen aus der Uebersetzungsschicht (Audit 2026-07-28, T13):
// die Aktion ist IMMER „Erneut versuchen", die Ladezeile immer „Wird
// geladen…" — beide Texte stammen woertlich aus den Handy-Locales
// (`common.retry`, `common.loading`). Nur die fachliche Fehlermeldung
// uebergibt der jeweilige Screen als Schluessel.
export function StateView({
  messageKey,
  loading = false,
  onAction,
}: {
  messageKey?: string;
  loading?: boolean;
  onAction: () => void;
}) {
  const { height, width } = useWindowDimensions();
  const { t } = useTranslation();
  const theme = useTheme();
  const message = loading ? t('common.loading') : messageKey ? t(messageKey) : undefined;
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const msgSize = clamp(height * 0.04, 18, 30);
  const btnSize = clamp(height * 0.036, 16, 26);

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.bg, paddingHorizontal: clamp(width * 0.06, 32, 120) },
      ]}>
      {loading ? <ActivityIndicator color={theme.accent} size="large" /> : null}
      {message ? (
        <Text
          style={[styles.msg, { color: theme.textMuted, fontSize: msgSize }]}
          accessibilityRole={loading ? undefined : 'alert'}>
          {message}
        </Text>
      ) : null}
      <FocusCard
        hasTVPreferredFocus
        onPress={onAction}
        style={[styles.action, { paddingVertical: clamp(height * 0.025, 12, 22) }]}>
        <Text style={[styles.actionLabel, { color: theme.text, fontSize: btnSize }]}>{t('common.retry')}</Text>
      </FocusCard>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  msg: { textAlign: 'center' },
  action: { paddingHorizontal: 40, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontWeight: '700' },
});
