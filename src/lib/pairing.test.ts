/**
 * LAN-Pairing (Handy <-> TV, ohne Backend). Getestet werden die
 * sicherheitsrelevanten Pfade (Handshake, Auth-Timeout, Verbindungs-Cap,
 * Broadcast nur an authentifizierte Sockets) und die zwei am 2026-07-28
 * gefundenen Fehler:
 *   - startPairing() war nicht wirklich idempotent (Guard erst NACH dem await)
 *   - ohne brauchbare LAN-IP lief der Server trotzdem los und der Screen blieb
 *     dauerhaft auf "QR wird erzeugt ..." stehen
 */
type Handler = (...args: unknown[]) => void;

interface FakeSocket {
  on: (ev: string, cb: Handler) => void;
  write: jest.Mock;
  destroy: jest.Mock;
  emit: (ev: string, ...args: unknown[]) => void;
}

function fakeSocket(): FakeSocket {
  const handlers = new Map<string, Handler>();
  return {
    on: (ev, cb) => void handlers.set(ev, cb),
    write: jest.fn(),
    destroy: jest.fn(),
    emit: (ev, ...args) => handlers.get(ev)?.(...args),
  };
}

type Pairing = typeof import('@/lib/pairing');

let createServer: jest.Mock;
let getIp: jest.Mock;

/** Frisches Pairing-Modul (der Modulzustand ist global) samt frischer Mocks.
 *  Bewusst `require` statt `import()`: dynamische Imports brauchen unter Jest
 *  --experimental-vm-modules (apps/mobile loest das mit einem Babel-Plugin,
 *  hier genuegt CommonJS). */
function loadPairing(): Pairing {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  createServer = (require('react-native-tcp-socket') as { default: { createServer: jest.Mock } })
    .default.createServer;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  getIp = (require('expo-network') as { getIpAddressAsync: jest.Mock }).getIpAddressAsync;
  getIp.mockResolvedValue('192.168.1.50');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/lib/pairing') as Pairing;
}

/** Der beim letzten createServer() uebergebene Connection-Handler. */
function connectionHandler(): (socket: unknown) => void {
  return createServer.mock.calls[createServer.mock.calls.length - 1][0];
}

function send(sock: FakeSocket, msg: unknown) {
  sock.emit('data', JSON.stringify(msg) + '\n');
}

/** Die erwartete Handshake-Antwort inkl. Screen-Liste (Audit 2026-07-28, T14). */
function welcomeLine(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SCREENS } = require('@/lib/nav') as typeof import('@/lib/nav');
  return JSON.stringify({ t: 'welcome', name: 'Salati TV', screens: SCREENS }) + '\n';
}

// Der Auth-Timeout jeder Verbindung ist ein echter 10-s-Timer. Ohne Fake-Timers
// bleibt Jest nach dem Lauf mit offenen Handles haengen.
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('startPairing', () => {
  it('lauscht und veroeffentlicht Host/Port/Token', async () => {
    const p = loadPairing();
    await p.startPairing();
    const st = p.pairingState();
    expect(st.status).toBe('listening');
    expect(st.host).toBe('192.168.1.50');
    expect(st.port).toBe(8787);
    expect(p.pairPayload(st)).toBe(`salatitv://pair?host=192.168.1.50&port=8787&token=${st.token}`);
    expect(createServer).toHaveBeenCalledTimes(1);
  });

  // Der Fehler vom 2026-07-28: der Guard `if (server) return` griff erst NACH
  // `await Network.getIpAddressAsync()`. Zwei Aufrufe im selben Tick (React
  // StrictMode montiert Effekte doppelt) erzeugten zwei Server auf Port 8787;
  // der erste blieb als nicht mehr referenzierter Zombie zurueck.
  it('erzeugt bei zwei gleichzeitigen Aufrufen nur EINEN Server', async () => {
    const p = loadPairing();
    await Promise.all([p.startPairing(), p.startPairing()]);
    expect(createServer).toHaveBeenCalledTimes(1);
  });

  // Zweiter Fehler vom selben Tag: Android liefert ohne Netz '0.0.0.0' statt zu
  // werfen. Der Server lief trotzdem, pairPayload() gab null zurueck und der
  // Screen wartete endlos auf einen QR-Code, der nie kommen konnte.
  it.each(['0.0.0.0', '127.0.0.1', '169.254.10.2'])(
    'startet gar nicht erst bei unbrauchbarer IP %s',
    async (ip) => {
      const p = loadPairing();
      getIp.mockResolvedValue(ip);
      await p.startPairing();
      expect(createServer).not.toHaveBeenCalled();
    },
  );

  it('startet gar nicht erst, wenn die IP-Abfrage wirft', async () => {
    const p = loadPairing();
    getIp.mockRejectedValue(new Error('kein netz'));
    await p.startPairing();
    expect(createServer).not.toHaveBeenCalled();
  });
});

/**
 * Audit 2026-07-29 — die Kopplung war auf LAN-Kabel-Geraeten tot.
 * `expo-network.getIpAddressAsync()` liest auf Android nur den WifiManager;
 * ein per Ethernet angeschlossener Fernseher bekommt dort 0.0.0.0 und der
 * Bildschirm meldete „Kein WLAN", obwohl das Geraet im Netz war (am
 * TV-Emulator mit nur `eth0` reproduziert). Rueckfall ist eine kurze
 * TCP-Verbindung nach draussen, deren LOKALE Adresse das Betriebssystem meldet.
 */
describe('LAN-Adresse ohne WLAN (Ethernet)', () => {
  /** Setzt den connect-Mock so, dass er eine Verbindung mit `localAddress` meldet. */
  function mockProbe(localAddress: string | undefined, mode: 'ok' | 'error' | 'hang' = 'ok') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const connect = (require('react-native-tcp-socket') as { default: { connect: jest.Mock } }).default
      .connect;
    connect.mockImplementation((_opts: unknown, cb: () => void) => {
      const handlers = new Map<string, Handler>();
      const sock = {
        localAddress,
        on: (ev: string, h: Handler) => void handlers.set(ev, h),
        destroy: jest.fn(),
      };
      if (mode === 'ok') setTimeout(cb, 0);
      if (mode === 'error') setTimeout(() => handlers.get('error')?.(new Error('unreachable')), 0);
      return sock;
    });
    return connect;
  }

  it('nimmt die lokale Adresse der Probe-Verbindung, wenn WLAN nichts liefert', async () => {
    const p = loadPairing();
    getIp.mockResolvedValue('0.0.0.0');
    mockProbe('10.0.2.15');
    const started = p.startPairing();
    await Promise.resolve();
    jest.advanceTimersByTime(1); // die Probe meldet ihren Erfolg ueber setTimeout(0)
    await started;
    expect(createServer).toHaveBeenCalledTimes(1);
    expect(p.pairingState().host).toBe('10.0.2.15');
    expect(p.pairPayload(p.pairingState())).toContain('host=10.0.2.15');
  });

  it('fragt gar nicht erst nach, wenn das WLAN schon eine Adresse hat', async () => {
    const p = loadPairing();
    const connect = mockProbe('10.0.2.15');
    await p.startPairing();
    expect(connect).not.toHaveBeenCalled();
    expect(p.pairingState().host).toBe('192.168.1.50');
  });

  it('bleibt beim Fehlerzustand, wenn auch die Probe nichts Brauchbares liefert', async () => {
    for (const [addr, mode] of [
      ['127.0.0.1', 'ok'],
      [undefined, 'ok'],
      ['10.0.2.15', 'error'],
    ] as const) {
      const p = loadPairing();
      getIp.mockResolvedValue('0.0.0.0');
      mockProbe(addr, mode);
      const started = p.startPairing();
      await Promise.resolve();
      jest.advanceTimersByTime(3000);
      await started;
      expect(createServer).not.toHaveBeenCalled();
      expect(p.pairingState().status).toBe('error');
    }
  });

  it('haengt nicht ewig, wenn die Probe-Verbindung nie zustande kommt', async () => {
    {
      const p = loadPairing();
      getIp.mockResolvedValue('0.0.0.0');
      mockProbe('10.0.2.15', 'hang');
      const started = p.startPairing();
      await Promise.resolve();
      jest.advanceTimersByTime(3000);
      await started;
      expect(p.pairingState().status).toBe('error');
    }
  });
});

// Audit 2026-07-28 (T10): der Token kam aus `Math.random()` — kein
// kryptografischer Generator. Quelle, Laenge und Lebensdauer sind jetzt
// festgeschrieben; er ist das EINZIGE Geheimnis, das die Fernsteuerung des
// Fernsehers im WLAN schuetzt.
describe('Kopplungs-Token', () => {
  function tokenOf(p: Pairing): string {
    return new URL(p.pairPayload(p.pairingState())!).searchParams.get('token')!;
  }

  it('stammt aus expo-crypto, nicht aus Math.random()', async () => {
    const p = loadPairing();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('expo-crypto') as { getRandomValues: jest.Mock };
    crypto.getRandomValues.mockClear();
    const mathRandom = jest.spyOn(Math, 'random');
    await p.startPairing();
    expect(crypto.getRandomValues).toHaveBeenCalled();
    expect(mathRandom).not.toHaveBeenCalled();
    mathRandom.mockRestore();
  });

  it('nutzt nur das ambiguitaetsarme Alphabet (kein 0/O/1/I/L)', async () => {
    const p = loadPairing();
    await p.startPairing();
    expect(tokenOf(p)).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/);
  });

  it('wird beim Rotieren neu gezogen — und der alte gilt dann nicht mehr', async () => {
    const p = loadPairing();
    await p.startPairing();
    const alt = tokenOf(p);
    p.rotateToken();
    const neu = tokenOf(p);
    expect(neu).not.toBe(alt);
    expect(neu).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/);

    // Der ALTE Token darf nach dem Rotieren keine neue Verbindung mehr
    // authentifizieren (die Pruefung liest den aktuellen Store-Wert).
    const alterSock = fakeSocket();
    connectionHandler()(alterSock);
    send(alterSock, { t: 'hello', token: alt });
    expect(alterSock.write).toHaveBeenCalledWith(JSON.stringify({ t: 'denied' }) + '\n');

    const neuerSock = fakeSocket();
    connectionHandler()(neuerSock);
    send(neuerSock, { t: 'hello', token: neu });
    expect(neuerSock.write).toHaveBeenCalledWith(welcomeLine());
  });

  it('rotiert nicht, solange kein Server laeuft', () => {
    const p = loadPairing();
    p.rotateToken();
    expect(p.pairingState().token).toBeNull();
  });
});

describe('Handshake', () => {
  it('akzeptiert nur den korrekten Token und antwortet mit welcome', async () => {
    const p = loadPairing();
    await p.startPairing();
    // Token steht nicht oeffentlich; ueber pairPayload des echten Zustands holen.
    const payload = p.pairPayload(p.pairingState());
    const token = new URL(payload!).searchParams.get('token')!;
    // 12 Zeichen aus dem ambiguitaetsarmen 31er-Alphabet ≈ 59,5 Bit
    // (Audit 2026-07-28, T10: vorher 10 Zeichen aus `Math.random()`).
    expect(token).toHaveLength(12);
    expect(token).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/);

    const sock = fakeSocket();
    connectionHandler()(sock);
    send(sock, { t: 'hello', token });
    expect(sock.write).toHaveBeenCalledWith(welcomeLine());
    expect(sock.destroy).not.toHaveBeenCalled();

    // Audit 2026-07-28 (T14): der Fernseher meldet seine Bildschirme selbst,
    // damit das Handy keine zweite, still veraltende Liste pflegen muss.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SCREENS } = require('@/lib/nav') as typeof import('@/lib/nav');
    const welcome = JSON.parse((sock.write.mock.calls[0][0] as string).trim()) as {
      screens?: string[];
    };
    expect(welcome.screens).toEqual([...SCREENS]);
    expect(welcome.screens).toHaveLength(11);
  });

  it('weist einen falschen Token ab und trennt sofort', async () => {
    const p = loadPairing();
    await p.startPairing();
    const sock = fakeSocket();
    connectionHandler()(sock);
    send(sock, { t: 'hello', token: 'FALSCH1234' });
    expect(sock.write).toHaveBeenCalledWith(JSON.stringify({ t: 'denied' }) + '\n');
    expect(sock.destroy).toHaveBeenCalled();
  });

  it('liefert Kommandos erst NACH dem Handshake an Abonnenten aus', async () => {
    const p = loadPairing();
    await p.startPairing();
    const token = new URL(p.pairPayload(p.pairingState())!).searchParams.get('token')!;
    const seen: unknown[] = [];
    p.onPairCommand((cmd) => void seen.push(cmd));

    const sock = fakeSocket();
    connectionHandler()(sock);
    send(sock, { t: 'nav', screen: 'quiz' }); // vor dem Handshake -> verworfen
    expect(seen).toHaveLength(0);
    send(sock, { t: 'hello', token });
    send(sock, { t: 'nav', screen: 'quiz' });
    expect(seen).toEqual([{ t: 'nav', screen: 'quiz' }]);
  });

  it('trennt Verbindungen ohne rechtzeitigen Handshake (Auth-Timeout)', async () => {
    const p = loadPairing();
    await p.startPairing();
    const sock = fakeSocket();
    connectionHandler()(sock);
    expect(sock.destroy).not.toHaveBeenCalled();
    jest.advanceTimersByTime(10_001);
    expect(sock.destroy).toHaveBeenCalled();
  });

  it('trennt bei Zeilenpuffer ohne Newline oberhalb des Deckels', async () => {
    const p = loadPairing();
    await p.startPairing();
    const sock = fakeSocket();
    connectionHandler()(sock);
    sock.emit('data', 'x'.repeat(64 * 1024 + 1));
    expect(sock.destroy).toHaveBeenCalled();
  });

  it('lehnt Verbindungen oberhalb des Caps ab', async () => {
    const p = loadPairing();
    await p.startPairing();
    const handler = connectionHandler();
    const socks = Array.from({ length: 9 }, fakeSocket);
    socks.forEach((s) => handler(s));
    expect(socks[8].destroy).toHaveBeenCalled(); // 9. Verbindung (MAX_CLIENTS = 8)
    expect(socks[7].destroy).not.toHaveBeenCalled();
  });

  it('ignoriert kaputtes JSON, statt die Verbindung zu sprengen', async () => {
    const p = loadPairing();
    await p.startPairing();
    const sock = fakeSocket();
    connectionHandler()(sock);
    sock.emit('data', '{kein json\n');
    expect(sock.destroy).not.toHaveBeenCalled();
  });
});

describe('broadcast', () => {
  it('sendet NUR an authentifizierte Verbindungen', async () => {
    const p = loadPairing();
    await p.startPairing();
    const token = new URL(p.pairPayload(p.pairingState())!).searchParams.get('token')!;
    const handler = connectionHandler();

    const authed = fakeSocket();
    handler(authed);
    send(authed, { t: 'hello', token });
    authed.write.mockClear();

    const lauscher = fakeSocket();
    handler(lauscher);
    lauscher.write.mockClear();

    p.broadcast({ t: 'quiz', action: 'question' });
    expect(authed.write).toHaveBeenCalledTimes(1);
    expect(lauscher.write).not.toHaveBeenCalled();
  });
});

describe('pairPayload', () => {
  it('liefert null, solange nicht wirklich gelauscht wird', async () => {
    const p = loadPairing();
    expect(p.pairPayload({ status: 'starting', host: null, port: null, token: null, clients: 0 })).toBeNull();
    expect(
      p.pairPayload({ status: 'listening', host: null, port: 8787, token: 'A', clients: 0 }),
    ).toBeNull();
  });
});


/**
 * Audit 2026-07-29 (am Emulator mit `wm density 160` reproduziert): nach einer
 * Android-Konfigurationsaenderung wird die Activity neu erzeugt. Laeuft die
 * Aufraeum-Funktion des alten React-Baums (`stopPairing()`) NACH dem Start des
 * neuen, ist der Server aus — der Kopplungs-Bildschirm stand dann dauerhaft auf
 * „Wird gestartet ..." und zeigte nie einen QR-Code. `startPairing()` muss
 * deshalb aus dem Bildschirm heraus erneut aufrufbar sein und wieder anlaufen.
 */
describe('Selbstheilung nach Konfigurationsaenderung', () => {
  it('laeuft nach stopPairing() wieder an', async () => {
    const p = loadPairing();
    await p.startPairing();
    expect(p.pairingState().status).toBe('listening');
    p.stopPairing();
    expect(p.pairingState().status).toBe('off');
    expect(p.pairPayload(p.pairingState())).toBeNull();

    await p.startPairing(); // genau das macht der Kopplungs-Bildschirm beim Oeffnen
    expect(p.pairingState().status).toBe('listening');
    expect(p.pairPayload(p.pairingState())).toContain('salatitv://pair');
  });

  it('rotateToken() nach dem Start liefert einen frischen Code', async () => {
    const p = loadPairing();
    await p.startPairing();
    const first = p.pairingState().token;
    p.rotateToken();
    expect(p.pairingState().token).not.toBe(first);
    expect(p.pairingState().status).toBe('listening');
  });
});
