// Erste Test-Einrichtung fuer apps/tv (Audit 2026-07-28): das Paket hatte
// 2.868 Zeilen und KEIN Test-Script. Aufbau bewusst identisch zu apps/mobile
// (jest-expo-Preset + jest.setup.js + collectCoverageFrom ueber das ganze src/),
// damit `pnpm test` in beiden Apps dasselbe bedeutet.
//
// Zusaetzlich zu apps/mobile noetig:
//  - moduleNameMapper fuer '@/…': apps/tv hat keine Babel-Alias-Plugin-Kette,
//    die tsconfig-`paths` aufloest; Metro macht das ueber expo/metro-config,
//    Jest braucht die Abbildung explizit.
//  - transformIgnorePatterns: react-native ist hier `react-native-tvos` (via
//    npm-Alias) und liefert wie RN selbst untranspiliertes ESM/Flow aus.
// Zeitzone des Testlaufs pinnen (Audit 2026-07-29): `prayerTimes.parity.test.ts`
// vergleicht Uhrzeiten gegen eine in Europe/Berlin erzeugte Soll-Tabelle der
// Handy-App. adhan-js rechnet ueber JS-`Date` immer in der Geraete-Zeitzone —
// ohne diese Zeile waere derselbe Test auf einem Rechner in einer anderen
// Zeitzone rot, ohne dass ein Fehler vorliegt. Hier gesetzt und nicht in
// jest.setup.js, weil die Worker-Prozesse die Umgebung dieses Prozesses erben.
process.env.TZ = process.env.TZ || 'Europe/Berlin';

module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.js'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', 'App.tsx', '!src/**/*.test.*'],
};
