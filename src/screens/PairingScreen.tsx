import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { FocusCard } from '@/components/FocusCard';
import { useTranslation } from '@/lib/i18n';
import { pairPayload, rotateToken, startPairing, stopPairing, usePairingState } from '@/lib/pairing';
import type { Theme } from '@/lib/theme';
import { useTheme } from '@/lib/useTheme';

// „Verbinden": öffnet den LAN-Pairing-Server und zeigt einen QR-Code. Das Handy
// (Salati-App → Bereich „TV") scannt ihn und verbindet sich direkt im selben
// WLAN — danach dient es als Fernbedienung und Zweitschirm fürs Quiz. Kein
// Backend, keine Cloud: die Verbindung ist rein lokal.
//
// Audit 2026-07-28 — drei echte Fehler in diesem Screen:
//  1) Er hatte KEIN einziges fokussierbares Element. Auf Android TV / Fire TV
//     bekommt die Fernbedienung damit keinen Fokus-Anker; D-Pad und OK laufen
//     ins Leere. Genau dieser Fehler trat am 2026-07-24 schon einmal am
//     Clock-Screensaver auf. Jetzt: eine fokussierte „Verbindung neu starten"-
//     Karte mit hasTVPreferredFocus.
//  2) Ohne brauchbare LAN-IP (kein WLAN, Captive Portal) blieb der Text
//     dauerhaft auf „QR wird erzeugt …" stehen — pairPayload() liefert dann
//     null, aber der Status war weiter 'listening'. startPairing() meldet
//     diesen Fall jetzt als 'error' (s. lib/pairing.ts), und der Screen sagt
//     klar „Kein WLAN" statt endlos zu warten.
//  3) Sämtliche Beschriftungen waren fest deutsch (T13) — jetzt übersetzt.
export function PairingScreen() {
  const state = usePairingState();
  const payload = pairPayload(state);
  const { width, height } = useWindowDimensions();
  const { t, rtl } = useTranslation();
  const theme = useTheme();

  // Zwei Dinge beim Oeffnen:
  //
  // 1) `startPairing()` — idempotent. Es LAEUFT normalerweise schon (App.tsx
  //    startet den Server fuer die gesamte App-Laufzeit). Aber: bei einer
  //    Android-Konfigurationsaenderung (Dichte, Sprache, Docking) wird die
  //    Activity neu erzeugt, der React-Baum neu gemountet — und die Aufraeum-
  //    Funktion des ALTEN Baums (`stopPairing()`) kann NACH dem Start des neuen
  //    laufen. Dann war der Server aus, und dieser Bildschirm stand dauerhaft
  //    auf „Wird gestartet …", ohne je einen QR-Code zu zeigen (am Emulator mit
  //    `wm density 160` reproduziert, Audit 2026-07-29). Der Aufruf hier heilt
  //    genau diesen Fall — an der Stelle, an der es darauf ankommt.
  // 2) Frischer Kopplungs-Token (s. `rotateToken` in lib/pairing.ts): ein Code,
  //    den ein Gast einmal gesehen hat, soll nicht wochenlang gueltig bleiben.
  //    Bereits verbundene Handys bleiben verbunden — die Token-Pruefung laeuft
  //    nur beim Handshake. Erst NACH dem Start, weil `rotateToken()` nur im
  //    Zustand `listening` wirkt.
  useEffect(() => {
    void startPairing().then(rotateToken);
  }, []);

  const s = useMemo(() => makeStyles(width, height, rtl, theme), [width, height, rtl, theme]);
  // QR-Groesse aus der echten dp-Flaeche: fixe 300 dp sprengten auf dichten
  // TV-Panels (320 dpi -> 960 dp breit, 540 dp hoch) die Spalte.
  const qrSize = Math.max(140, Math.min(300, Math.round(Math.min(width * 0.26, height * 0.45))));

  const restart = () => {
    stopPairing();
    void startPairing();
  };

  const statusText =
    state.clients === 1
      ? t('pairing.connectedOne')
      : state.clients > 1
        ? t('pairing.connectedMany', { n: state.clients })
        : state.status === 'listening'
          ? t('pairing.ready')
          : state.status === 'error'
            ? t('pairing.noNetwork')
            : t('pairing.starting');

  return (
    <View style={s.root}>
      <View style={s.left}>
        <Text style={s.title}>{t('pairing.title')}</Text>
        <Text style={s.step}>{t('pairing.step1')}</Text>
        <Text style={s.step}>{t('pairing.step2', { action: t('pairing.action') })}</Text>
        <Text style={s.step}>{t('pairing.step3')}</Text>

        <View style={s.statusRow}>
          <View
            style={[
              s.dot,
              state.clients > 0 ? s.dotOn : state.status === 'listening' ? s.dotReady : s.dotOff,
            ]}
          />
          <Text style={s.statusText}>{statusText}</Text>
        </View>
        {state.host && state.port ? (
          <Text style={s.manual}>
            {t('pairing.manual', {
              host: state.host,
              port: state.port,
              token: state.token ?? '',
            })}
          </Text>
        ) : null}

        {/* Einziges fokussierbares Element des Screens (s. Kopfkommentar) und
            zugleich die einzige Moeglichkeit, nach einem Netzwechsel neu zu
            starten, ohne die App zu verlassen. */}
        <FocusCard hasTVPreferredFocus onPress={restart} style={s.restartCard}>
          <Text style={s.restartLabel}>{t('pairing.restart')}</Text>
        </FocusCard>
      </View>

      <View style={s.right}>
        <View style={[s.qrCard, { width: qrSize + 40, height: qrSize + 40 }]}>
          {payload ? (
            <QRCode value={payload} size={qrSize} backgroundColor="#ffffff" color="#0b0b0d" />
          ) : (
            <Text style={s.qrWait}>
              {state.status === 'error' ? t('pairing.noWifi') : t('pairing.qrPending')}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

/** Dichte-relative Styles (siehe ClockScreen): der Screen rechnete vorher mit
 *  festen dp-Werten (Spalte 380, QR-Karte 340) und lief auf 320-dpi-Panels
 *  ueber die Flaeche hinaus. */
function makeStyles(w: number, h: number, rtl: boolean, theme: Theme) {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const align = rtl ? ('right' as const) : ('left' as const);
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.bg,
      flexDirection: rtl ? 'row-reverse' : 'row',
      alignItems: 'center',
      paddingHorizontal: clamp(w * 0.05, 28, 96),
    },
    left: { flex: 1, gap: clamp(h * 0.03, 10, 20), alignItems: rtl ? 'flex-end' : 'flex-start' },
    title: {
      color: theme.accent,
      fontSize: clamp(h * 0.075, 26, 48),
      fontWeight: '800',
      letterSpacing: rtl ? 0 : 1,
      marginBottom: clamp(h * 0.02, 6, 14),
      textAlign: align,
    },
    step: { color: theme.text, fontSize: clamp(h * 0.045, 17, 30), lineHeight: clamp(h * 0.065, 24, 42), textAlign: align },
    statusRow: {
      flexDirection: rtl ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: clamp(h * 0.035, 12, 26),
    },
    dot: { width: 16, height: 16, borderRadius: 8 },
    dotOn: { backgroundColor: theme.ok },
    dotReady: { backgroundColor: theme.accent },
    dotOff: { backgroundColor: theme.textFaint },
    statusText: { color: theme.text, fontSize: clamp(h * 0.04, 15, 26) },
    manual: { color: theme.textFaint, fontSize: clamp(h * 0.033, 13, 22), marginTop: 4, textAlign: align },
    restartCard: {
      alignSelf: rtl ? 'flex-end' : 'flex-start',
      paddingHorizontal: clamp(w * 0.02, 18, 32),
      paddingVertical: clamp(h * 0.026, 12, 20),
      marginTop: clamp(h * 0.02, 8, 16),
    },
    restartLabel: { color: theme.text, fontSize: clamp(h * 0.037, 15, 24), fontWeight: '700' },
    right: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: clamp(w * 0.02, 12, 40) },
    qrCard: {
      borderRadius: 24,
      backgroundColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
    },
    qrWait: { color: '#0b0b0d', fontSize: clamp(h * 0.037, 15, 24), textAlign: 'center', paddingHorizontal: 12 },
  });
}
