// Config-Plugin: Swift-Sprachmerkmal `WeakLet` fuer die Pods einschalten.
//
// WARUM das gebraucht wird — und warum es die Handy-App NICHT braucht:
// `ExpoModulesCore.podspec` bindet auf iOS ein FERTIG GEBAUTES XCFramework ein
// (`try_link_with_prebuilt_xcframework`). Fuer tvOS liefert Expo keines, also
// faellt der Podspec auf die Swift-Quellen zurueck — und die uebersetzt der
// Fernseh-Build als Einziger wirklich.
//
// In diesen Quellen steht (57.0.7 bis mindestens 57.0.10, unveraendert):
//     nonisolated(unsafe) weak let emitter = self
// `weak let` ist Swift-6.2-Neuland (SE-0481) und im Sprachstand 6, mit dem der
// Podspec uebersetzt (`s.swift_version = '6.0'`), noch nicht eingeschaltet.
// Ohne dieses Merkmal bricht der Build ab mit
//     'weak' must be a mutable variable, because it may change at runtime
//
// Der naheliegende Ausweg — `let` zu `var` machen — ist ein Irrweg und am
// 2026-08-11 durchgespielt worden (Lauf 31485877889): aus einer Konstanten
// wird eine Veraenderliche, und dieselbe Zeile scheitert zwei Zeilen spaeter an
//     sending 'emitter' risks causing data races
// Expo meint genau das, was da steht.
//
// ZWEITER TEIL — `SWIFT_VERSION = 5.0` fuer ExpoModulesCore. Mit Xcode 26.3
// uebersetzt `weak let` zwar, aber derselbe `sending`-Fehler kommt aus den
// UNVERAENDERTEN Quellen (Lauf 31489675507, EventEmitter.swift 52/79): im
// Sprachstand 6 ist die strenge Nebenlaeufigkeitspruefung ein Fehler, im
// Sprachstand 5 eine Warnung. Fuer iOS faellt das nie auf, weil Expo dort ein
// fertiges XCFramework ausliefert — dieser Code wird nur fuer den Fernseher
// ueberhaupt uebersetzt. Es geht also NICHT darum, eigenen Code an der Pruefung
// vorbeizuschummeln, sondern darum, eine fremde Bibliothek so zu uebersetzen,
// wie ihr Hersteller sie ausliefert. Nur dieses eine Ziel ist betroffen.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = 'SALATI_TV_WEAK_LET';
const ANKER = 'post_install do |installer|';

const BLOCK = `
    # ${MARKER}
    installer.pods_project.targets.each do |ziel|
      ziel.build_configurations.each do |konfiguration|
        flags = konfiguration.build_settings['OTHER_SWIFT_FLAGS'] || '$(inherited)'
        flags = flags.join(' ') if flags.is_a?(Array)
        unless flags.include?('WeakLet')
          konfiguration.build_settings['OTHER_SWIFT_FLAGS'] = flags + ' -enable-upcoming-feature WeakLet'
        end
        if ziel.name == 'ExpoModulesCore'
          konfiguration.build_settings['SWIFT_VERSION'] = '5.0'
        end
      end
    end
`;

module.exports = function withSwiftWeakLet(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const datei = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      const inhalt = fs.readFileSync(datei, 'utf8');
      if (inhalt.includes(MARKER)) return cfg;
      if (!inhalt.includes(ANKER)) {
        // Lieber laut abbrechen als stumm nichts tun: ein Fix, der schweigend
        // ausfaellt, kostet einen ganzen Build-Lauf, um bemerkt zu werden.
        throw new Error(`with-swift-weak-let: „${ANKER}" steht nicht im Podfile`);
      }
      fs.writeFileSync(datei, inhalt.replace(ANKER, ANKER + BLOCK));
      return cfg;
    },
  ]);
};
