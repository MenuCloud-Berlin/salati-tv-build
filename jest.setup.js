// Offizieller AsyncStorage-Mock — lib/settings.ts importiert AsyncStorage auf
// Modulebene, Jest stellt kein Native-Modul bereit (gleiches Muster wie
// apps/mobile/jest.setup.js).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// react-native-tcp-socket ist rein nativ (Pairing-Server). Der Mock haelt die
// Server-/Socket-Semantik nach, die lib/pairing.ts benutzt, damit der
// Handshake-, Auth-Timeout- und Broadcast-Pfad testbar bleibt.
jest.mock('react-native-tcp-socket', () => {
  const listeners = new Map();
  const server = {
    on: jest.fn((ev, cb) => listeners.set(ev, cb)),
    listen: jest.fn((_opts, cb) => cb && cb()),
    close: jest.fn(),
  };
  return {
    __esModule: true,
    default: {
      createServer: jest.fn(() => server),
      connect: jest.fn(),
      __server: server,
    },
  };
});

// expo-network: getIpAddressAsync ist nativ. Default = plausible LAN-IP;
// einzelne Tests ueberschreiben den Mock.
jest.mock('expo-network', () => ({
  getIpAddressAsync: jest.fn(async () => '192.168.1.50'),
}));

jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));

// expo-crypto liefert den Kopplungs-Token (lib/pairing.ts). `getRandomValues`
// ist nativ; der Mock fuellt deterministisch, damit Tests reproduzierbar sind —
// die Verwerfungsauswahl im Produktivcode wird davon nicht umgangen (Werte
// ≥ 248 werden auch hier verworfen).
jest.mock('expo-crypto', () => {
  let seed = 0;
  return {
    getRandomValues: jest.fn((arr) => {
      // Deterministisch, aber bei JEDEM Aufruf anders — sonst waere ein Test
      // ueber das Rotieren des Tokens wertlos (alter und neuer Token gleich).
      for (let i = 0; i < arr.length; i++) arr[i] = (seed * 61 + i * 37 + 11) % 256;
      seed += 1;
      return arr;
    }),
  };
});
