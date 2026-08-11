// Bis 2026-07-28 hatte apps/tv gar keine Babel-Config: Metro/Expo wenden
// `babel-preset-expo` seit SDK 50 auch ohne Datei automatisch an. Jest tut das
// NICHT — es liest die Babel-Config des Projekts, und ohne sie bliebe JSX/TS
// untransformiert. Diese Datei bildet daher exakt den Expo-Default ab und
// aendert am Metro-/EAS-Build nichts.
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
