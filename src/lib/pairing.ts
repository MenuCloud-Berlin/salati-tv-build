import { useEffect, useSyncExternalStore } from 'react';
import TcpSocket from 'react-native-tcp-socket';
import * as Network from 'expo-network';
import { getRandomValues } from 'expo-crypto';

import { SCREENS } from '@/lib/nav';

// LAN-Direkt-Kopplung Handy↔TV — OHNE Backend (kritische Vorgabe: keine
// Server-/Cloud-Kosten). Der TV öffnet einen lokalen TCP-Server; das Handy
// verbindet sich im selben WLAN direkt (Host:Port:Token aus dem QR-Code).
// Protokoll: zeilengetrennte JSON-Objekte (newline-delimited JSON), damit ein
// TCP-Stream sauber in einzelne Nachrichten zerfällt. Der Token authentifiziert
// die erste Nachricht; erst danach werden Kommandos akzeptiert.
//
// Nachrichten Handy → TV:
//   { t: 'hello', token }                     Handshake (Pflicht, zuerst)
//   { t: 'nav', screen }                      Screen umschalten (Fernbedienung)
//   { t: 'key', dir: 'up'|'down'|'left'|'right'|'select'|'back' }  D-Pad-Ersatz
//   { t: 'quiz', action, payload }            Zweitschirm-Quiz (s. quiz.ts)
//   { t: 'einstellungen', location, is24h, highLatitude, offsets }
//                                             Rechenparameter uebernehmen
//                                             (s. lib/settings.applyRemoteSettings)
// Nachrichten TV → Handy:
//   { t: 'welcome', name, screens }           Handshake bestätigt (+ Screen-Liste)
//   { t: 'state', screen, ... }               aktueller TV-Zustand (Spiegel)
//   { t: 'quiz', ... }                        Quiz-Events fürs Handy

export type PairPort = number;

export interface PairingState {
  status: 'off' | 'starting' | 'listening' | 'error';
  host: string | null;
  port: PairPort | null;
  token: string | null;
  /** Anzahl aktuell verbundener Handys. */
  clients: number;
}

/** Ein vom Handy empfangenes Kommando (nach erfolgreichem Handshake). */
export interface PairCommand {
  t: string;
  [k: string]: unknown;
}

const PORT: PairPort = 8787;
// Schutzgeländer gegen Ressourcen-Erschöpfung (der Server lauscht im WLAN):
const MAX_CLIENTS = 8; // max. gleichzeitige Verbindungen
const AUTH_TIMEOUT_MS = 10_000; // ohne gültigen Handshake → Verbindung schließen
const MAX_BUFFER = 64 * 1024; // Zeilenpuffer-Deckel (kein Newline → nicht unbegrenzt wachsen)

let state: PairingState = { status: 'off', host: null, port: null, token: null, clients: 0 };
const stateListeners = new Set<() => void>();
const cmdListeners = new Set<(cmd: PairCommand, reply: (msg: unknown) => void) => void>();

function emitState() {
  for (const l of stateListeners) l();
}
function setState(patch: Partial<PairingState>) {
  state = { ...state, ...patch };
  emitState();
}

/** Kommandos vom Handy abonnieren (z. B. Navigation, Quiz). Rückgabe: Unsubscribe. */
export function onPairCommand(cb: (cmd: PairCommand, reply: (msg: unknown) => void) => void) {
  cmdListeners.add(cb);
  return () => cmdListeners.delete(cb);
}

// Ambiguitätsarmes Alphabet (kein 0/O/1/I/L), damit auch die manuelle
// Code-Eingabe fehlerarm bleibt. 31 Zeichen (23 Buchstaben + 8 Ziffern).
const TOKEN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
// Audit 2026-07-28 (T10) — der Token ist das EINZIGE Geheimnis, das die
// Fernsteuerung des Fernsehers im WLAN schuetzt. Drei Befunde am alten Stand:
//  1) Quelle war `Math.random()`. Das ist kein kryptografischer Generator:
//     Hermes zieht daraus einen vorhersagbaren PRNG-Strom — wer ein paar
//     Ausgaben kennt (oder den Startzustand raet), kann Folge-Token berechnen.
//     Jetzt: `expo-crypto.getRandomValues` (nativ, CSPRNG).
//  2) Der Kommentar rechnete mit 32^10. Das Alphabet hat aber 31 Zeichen, und
//     die Rechnung gilt ohnehin nur fuer einen unvorhersagbaren Generator.
//     Real waren es 10 * log2(31) ≈ 49,5 Bit.
//  3) Laenge: 12 statt 10 Zeichen ⇒ 12 * log2(31) ≈ 59,5 Bit. Bei einem
//     Verbindungs-Cap von 8 und 10 s Auth-Timeout sind hoechstens ~0,8
//     Rateversuche/s moeglich; 59,5 Bit sind damit auch ueber Jahre nicht
//     erschoepfbar. 12 Zeichen bleiben als 3er-Gruppen noch gut ablesbar.
//
// `% ALPHABET.length` auf ein Zufallsbyte waere verzerrt (256 ist kein
// Vielfaches von 31 — die ersten 8 Zeichen kaemen haeufiger vor). Deshalb
// Verwerfungsauswahl: Bytes ab 248 (= 8*31) werden weggeworfen und neu gezogen.
const TOKEN_LENGTH = 12;
const REJECT_AT = Math.floor(256 / TOKEN_ALPHABET.length) * TOKEN_ALPHABET.length; // 248

function randomToken(): string {
  let s = '';
  while (s.length < TOKEN_LENGTH) {
    // Grosszuegig ziehen, damit Verwerfungen selten eine zweite Runde kosten.
    const bytes = getRandomValues(new Uint8Array(TOKEN_LENGTH));
    for (const b of bytes) {
      if (b >= REJECT_AT) continue;
      s += TOKEN_ALPHABET[b % TOKEN_ALPHABET.length];
      if (s.length === TOKEN_LENGTH) break;
    }
  }
  return s;
}

// Lebensdauer: der Token entsteht bei jedem `startPairing()` neu und gilt bis
// zum naechsten `stopPairing()`. Weil App.tsx den Server ueber die gesamte
// App-Laufzeit offen haelt, waere er auf einem Fernseher, der wochenlang
// laeuft, sonst wochenlang derselbe — wer den QR-Code einmal gesehen hat (Gast,
// Foto), koennte sich beliebig spaeter wieder verbinden. Deshalb zieht der
// Kopplungs-Bildschirm bei jedem Oeffnen einen frischen Token: genau dann,
// wenn ohnehin ein neuer Code angezeigt wird. Bereits authentifizierte Handys
// bleiben verbunden (die Pruefung laeuft pro Socket nur beim Handshake), ein
// Rotieren unterbricht also keine laufende Sitzung.
export function rotateToken(): void {
  if (state.status !== 'listening') return;
  setState({ token: randomToken() });
}

type Server = ReturnType<typeof TcpSocket.createServer>;
type Sock = ReturnType<typeof TcpSocket.connect>;
let server: Server | null = null;
const sockets = new Set<Sock>(); // alle offenen Verbindungen (auch noch nicht authentifiziert)
const authed = new Set<Sock>(); // NUR authentifizierte — nur an diese wird gebroadcastet

/** Eine IP, die als QR-Ziel im WLAN tatsaechlich erreichbar ist. Android liefert
 *  ohne Netzverbindung '0.0.0.0' (statt zu werfen), iOS teils Loopback — beides
 *  ergaebe einen QR-Code, den das Handy nie erreichen kann. */
export function isUsableLanHost(host: string | null | undefined): host is string {
  if (!host) return false;
  return host !== '0.0.0.0' && host !== '127.0.0.1' && !host.startsWith('169.254.');
}

// Audit 2026-07-29 — die Kopplung war auf LAN-Kabel-Geraeten TOT.
//
// `expo-network.getIpAddressAsync()` liest auf Android ausschliesslich
// `WifiManager.getConnectionInfo().ipAddress` (belegt in
// node_modules/expo-network/android/.../NetworkModule.kt, Zeile 140f.). Ein per
// Ethernet angeschlossener Fernseher/Android-TV-Kasten hat dort 0 — die App
// meldete „Kein WLAN", zeigte keinen QR-Code und liess sich nicht koppeln,
// obwohl das Geraet bestens im Netz war. Am TV-Emulator (nur `eth0`,
// 10.0.2.15) trat genau das auf.
//
// Rueckfall ohne neues natives Modul: eine TCP-Verbindung nach draussen
// aufbauen und das Betriebssystem nach der dabei gewaehlten LOKALEN Adresse
// fragen (`socket.localAddress`). Genau diese Adresse ist die, unter der das
// Handy den Fernseher im selben Netz erreicht.
//
// Ziel ist bewusst ein DNS-Server als reine IP (1.1.1.1:53): keine
// Namensaufloesung noetig, TCP/53 ist praktisch ueberall offen, und es werden
// KEINE Daten gesendet — die Verbindung wird sofort nach dem Handshake wieder
// geschlossen. Schlaegt sie fehl (kein Internet), bleibt es beim ehrlichen
// Fehlerzustand des Kopplungs-Bildschirms.
const PROBE_HOST = '1.1.1.1';
const PROBE_PORT = 53;
const PROBE_TIMEOUT_MS = 2_500;

export function probeLanHost(): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    let sock: Sock | null = null;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        sock?.destroy();
      } catch {
        /* ignore */
      }
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), PROBE_TIMEOUT_MS);
    try {
      sock = TcpSocket.connect({ host: PROBE_HOST, port: PROBE_PORT }, () => {
        const addr = (sock as unknown as { localAddress?: string } | null)?.localAddress;
        finish(isUsableLanHost(addr) ? addr : null);
      }) as unknown as Sock;
      sock.on('error', () => finish(null));
    } catch {
      finish(null);
    }
  });
}

/** LAN-IP des Fernsehers: erst WLAN (expo-network), dann der TCP-Rueckfall. */
export async function resolveLanHost(): Promise<string | null> {
  let host: string | null = null;
  try {
    host = await Network.getIpAddressAsync();
  } catch {
    host = null;
  }
  if (isUsableLanHost(host)) return host;
  return probeLanHost();
}

// Audit 2026-07-28: `if (server) return` griff ERST NACH dem await unten —
// `server` wird ja erst danach gesetzt. Zwei Aufrufe im selben Tick (React
// StrictMode montiert Effekte doppelt) liefen deshalb beide durch, erzeugten
// zwei TcpSocket-Server auf Port 8787 und liessen den ersten als nicht mehr
// referenzierten Zombie zurueck, den stopPairing() nicht schliessen kann.
// Ein synchron gesetztes Flag schliesst das Fenster.
let starting = false;

/** Startet den Pairing-Server (idempotent). Ermittelt die LAN-IP und lauscht. */
export async function startPairing(): Promise<void> {
  if (server || starting) return;
  starting = true;
  setState({ status: 'starting' });
  const host = await resolveLanHost();
  if (!isUsableLanHost(host)) {
    // Ohne brauchbare LAN-IP ist Pairing unmoeglich. Frueher lief der Server
    // trotzdem los und der Screen blieb dauerhaft auf „QR wird erzeugt …"
    // stehen (pairPayload liefert null) — jetzt ehrlicher Fehlerzustand.
    starting = false;
    setState({ status: 'error', host: null, port: null, token: null });
    return;
  }
  const token = randomToken();

  server = TcpSocket.createServer((socket) => {
    const sock = socket as unknown as Sock;
    // Verbindungs-Cap: zu viele offene Verbindungen sofort ablehnen.
    if (sockets.size >= MAX_CLIENTS) {
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      return;
    }
    let isAuthed = false;
    let buffer = '';
    const reply = (msg: unknown) => {
      try {
        socket.write(JSON.stringify(msg) + '\n');
      } catch {
        /* Socket evtl. schon zu */
      }
    };
    sockets.add(sock);

    // Auth-Timeout: wer nicht rechtzeitig einen gültigen Handshake schickt, fliegt.
    const authTimer = setTimeout(() => {
      if (!isAuthed) {
        try {
          socket.destroy();
        } catch {
          /* ignore */
        }
      }
    }, AUTH_TIMEOUT_MS);

    socket.on('data', (data) => {
      buffer += typeof data === 'string' ? data : data.toString();
      // Puffer-Deckel: ohne Newline nicht unbegrenzt wachsen lassen.
      if (buffer.length > MAX_BUFFER) {
        try {
          socket.destroy();
        } catch {
          /* ignore */
        }
        return;
      }
      let idx: number;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        let msg: PairCommand;
        try {
          msg = JSON.parse(line) as PairCommand;
        } catch {
          continue;
        }
        if (!isAuthed) {
          // Bewusst gegen den AKTUELLEN Token aus dem Store, nicht gegen den
          // beim Serverstart eingefangenen: `rotateToken()` (s. o.) muss auch
          // fuer Verbindungen greifen, die nach dem Rotieren aufgebaut werden.
          if (msg.t === 'hello' && typeof msg.token === 'string' && msg.token === state.token) {
            isAuthed = true;
            clearTimeout(authTimer);
            authed.add(sock);
            setState({ clients: authed.size });
            // `screens` (Audit 2026-07-28, T14): der Fernseher meldet selbst,
            // welche Bildschirme er kennt. Das Handy baut seine Sprungziele
            // daraus, statt eine zweite, still veraltende Liste zu pflegen —
            // ein aelteres Handy an einem neueren Fernseher zeigt so trotzdem
            // alle Ziele. Faellt das Feld weg (alter Fernseher), nutzt das Handy
            // seinen eigenen Katalog.
            reply({ t: 'welcome', name: 'Salati TV', screens: SCREENS });
          } else {
            reply({ t: 'denied' });
            socket.destroy();
          }
          continue;
        }
        for (const cb of cmdListeners) cb(msg, reply);
      }
    });
    const cleanup = () => {
      clearTimeout(authTimer);
      sockets.delete(sock);
      authed.delete(sock);
      setState({ clients: authed.size });
    };
    socket.on('close', cleanup);
    socket.on('error', cleanup);
  });

  server.on('error', () => {
    starting = false;
    setState({ status: 'error' });
  });
  server.listen({ port: PORT, host: '0.0.0.0' }, () => {
    starting = false;
    setState({ status: 'listening', host, port: PORT, token });
  });
}

/** Stoppt den Server und trennt alle Verbindungen. */
export function stopPairing(): void {
  for (const s of sockets) {
    try {
      s.destroy();
    } catch {
      /* ignore */
    }
  }
  sockets.clear();
  authed.clear();
  if (server) {
    try {
      server.close();
    } catch {
      /* ignore */
    }
    server = null;
  }
  starting = false;
  setState({ status: 'off', host: null, port: null, token: null, clients: 0 });
}

/** Sendet eine Nachricht an alle AUTHENTIFIZIERTEN Handys (z. B. Quiz-Frage,
 *  State). Bewusst NICHT an noch nicht authentifizierte Verbindungen — sonst
 *  könnte eine fremde Verbindung im WLAN vor dem Handshake mitlesen. */
export function broadcast(msg: unknown): void {
  const line = JSON.stringify(msg) + '\n';
  for (const s of authed) {
    try {
      s.write(line);
    } catch {
      /* ignore */
    }
  }
}

/** QR-Nutzlast: von der Handy-App geparst (salatitv://pair?host=..&port=..&token=..). */
export function pairPayload(s: PairingState): string | null {
  if (s.status !== 'listening' || !s.host || !s.port || !s.token) return null;
  return `salatitv://pair?host=${s.host}&port=${s.port}&token=${s.token}`;
}

function subscribe(cb: () => void) {
  stateListeners.add(cb);
  return () => stateListeners.delete(cb);
}
function getSnapshot() {
  return state;
}

/** Aktueller Pairing-Zustand ausserhalb von React (Tests, Nicht-Hook-Aufrufer). */
export function pairingState(): PairingState {
  return state;
}

/** Reaktiver Zugriff auf den Pairing-Zustand. */
export function usePairingState(): PairingState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Startet das Pairing beim Mount des Screens und stoppt es beim Unmount. */
export function useAutoPairing(active: boolean): PairingState {
  useEffect(() => {
    if (!active) return;
    void startPairing();
    return () => stopPairing();
  }, [active]);
  return usePairingState();
}
