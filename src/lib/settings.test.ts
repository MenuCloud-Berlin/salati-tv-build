import { DEFAULT_LOCATION, NO_PRAYER_TIME_OFFSETS } from '@/lib/prayerTimes';

const KEY = 'salati-tv-settings-v1';

type Settings = typeof import('@/lib/settings');
type Storage = typeof import('@react-native-async-storage/async-storage').default;

/**
 * `settings.ts` haelt einen Modul-Zustand samt einmaligem Hydrate-Latch; jeder
 * Test braucht deshalb ein frisch geladenes Modul. Bewusst OHNE React/RTL: der
 * Store selbst ist ein useSyncExternalStore-Store, seine Logik (Hydrieren,
 * Setzen, Persistieren, Fehler-Fallback) laesst sich ohne Renderer pruefen —
 * und nach `jest.resetModules()` wuerde ein zweiter React-Import ohnehin
 * kollidieren.
 *
 * WICHTIG: Der AsyncStorage-Mock muss aus DEMSELBEN Modulgraph kommen, sonst
 * schreibt settings.ts in eine andere Speicher-Instanz als der Test liest.
 */
function loadSettings(): { s: Settings; storage: Storage } {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@react-native-async-storage/async-storage') as { default?: Storage } & Storage;
  const storage = mod.default ?? mod;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const s = require('@/lib/settings') as Settings;
  return { s, storage };
}

describe('Hydrieren', () => {
  it('startet auf dem Default-Standort und uebernimmt danach den Speicher', async () => {
    const { s, storage } = loadSettings();
    await storage.clear();
    await storage.setItem(
      KEY,
      JSON.stringify({ location: { ...DEFAULT_LOCATION, label: 'Berlin' }, is24h: false }),
    );
    expect(s.tvSettingsState().location.label).toBe(DEFAULT_LOCATION.label);
    expect(s.tvSettingsState().loaded).toBe(false);

    await s.hydrateTvSettings();
    expect(s.tvSettingsState().location.label).toBe('Berlin');
    expect(s.tvSettingsState().is24h).toBe(false);
    expect(s.tvSettingsState().loaded).toBe(true);
  });

  // Ein kaputter Speicherinhalt darf die Uhr nicht ohne Standort lassen —
  // sonst zeigt der Default-Screen der App gar keine Gebetszeiten.
  it('faellt bei kaputtem gespeichertem JSON auf den Default zurueck', async () => {
    const { s, storage } = loadSettings();
    await storage.clear();
    await storage.setItem(KEY, '{kein json');
    await s.hydrateTvSettings();
    expect(s.tvSettingsState().location).toEqual(DEFAULT_LOCATION);
    expect(s.tvSettingsState().loaded).toBe(true);
  });

  it('markiert auch ohne gespeicherte Daten als geladen', async () => {
    const { s, storage } = loadSettings();
    await storage.clear();
    await s.hydrateTvSettings();
    expect(s.tvSettingsState().loaded).toBe(true);
    expect(s.tvSettingsState().location).toEqual(DEFAULT_LOCATION);
  });

  it('hydriert nur einmal und ueberschreibt spaetere Aenderungen nicht', async () => {
    const { s, storage } = loadSettings();
    await storage.clear();
    await storage.setItem(KEY, JSON.stringify({ location: DEFAULT_LOCATION, is24h: true }));
    await s.hydrateTvSettings();
    s.setIs24h(false);
    await s.hydrateTvSettings(); // zweiter Aufruf darf nichts zuruecksetzen
    expect(s.tvSettingsState().is24h).toBe(false);
  });
});

describe('setLocation / setIs24h', () => {
  it('aktualisieren den Zustand und schreiben in den Speicher', async () => {
    const { s, storage } = loadSettings();
    await storage.clear();
    await s.hydrateTvSettings();

    s.setLocation({ ...DEFAULT_LOCATION, label: 'Hamburg', madhab: 'hanafi' });
    s.setIs24h(false);
    expect(s.tvSettingsState().location.label).toBe('Hamburg');
    expect(s.tvSettingsState().location.madhab).toBe('hanafi');
    expect(s.tvSettingsState().is24h).toBe(false);

    await Promise.resolve(); // persist() laeuft ohne await
    expect(JSON.parse((await storage.getItem(KEY))!)).toEqual({
      location: { ...DEFAULT_LOCATION, label: 'Hamburg', madhab: 'hanafi' },
      is24h: false,
      // Die Startsprache haengt an der Geraete-Sprache (detectDeviceLocale) —
      // hier bewusst gegen den Store und nicht gegen einen festen Wert
      // geprueft, damit der Test nicht an der Systemsprache des Laeufers haengt.
      language: s.tvSettingsState().language,
      highLatitude: 'auto',
      offsets: NO_PRAYER_TIME_OFFSETS,
      // Darstellung und Leser-Einstellungen (2026-08-08). Sie stehen hier
      // bewusst ALLE einzeln und nicht als `expect.objectContaining`: was
      // persistiert wird, ist der Vertrag mit dem Speicher — ein Feld, das
      // still herausfaellt, verliert beim naechsten Start die Nutzerwahl, und
      // genau das soll dieser Test bemerken.
      theme: 'mitternacht',
      hintergrund: 'ruhig',
      bedienungAusblenden: 0,
      quranFont: 'kfgqpc',
      quranSukun: 'madina',
      readerScale: 1,
      readerTranslit: true,
      readerTranslation: true,
      readerAutoAdvance: true,
      azan: { fajr: 'aus', dhuhr: 'aus', asr: 'aus', maghrib: 'aus', isha: 'aus' },
      azanVolume: 1,
      // Nachgetragen 2026-08-25: diese vier Felder kamen mit der Uhr-Groesse,
      // der Freitags-Kennzeichnung und den Uhr-Einblendungen dazu, standen
      // aber nie in dieser Erwartung - der Test war seitdem rot. Genau das
      // soll er ja bemerken, also gehoeren sie hier hinein.
      clockScale: 1,
      jumuaModusAktiv: false,
      versDesTagesAktiv: false,
      wetterAktiv: false,
    });
  });

  // Gebetsruf (1.8.0). Der wichtigste Test steht zuerst: eine Installation,
  // die den Ruf noch gar nicht kannte, darf nach der Aktualisierung nicht
  // ploetzlich rufen.
  it('laesst den Gebetsruf nach einer Aktualisierung aus', async () => {
    const { s, storage } = loadSettings();
    await storage.clear();
    // Gespeicherter Stand einer aelteren Version: kein Feld `azan`.
    await storage.setItem(
      KEY,
      JSON.stringify({ location: DEFAULT_LOCATION, is24h: true, theme: 'mitternacht' }),
    );
    await s.hydrateTvSettings();
    expect(s.tvSettingsState().azan).toEqual({
      fajr: 'aus',
      dhuhr: 'aus',
      asr: 'aus',
      maghrib: 'aus',
      isha: 'aus',
    });
    expect(s.tvSettingsState().azanVolume).toBe(1);
  });

  it('speichert die Wahl je Gebet einzeln', async () => {
    const { s, storage } = loadSettings();
    await storage.clear();
    await s.hydrateTvSettings();
    s.setAzanChoice('maghrib', 'adhan2');
    expect(s.tvSettingsState().azan.maghrib).toBe('adhan2');
    expect(s.tvSettingsState().azan.fajr).toBe('aus');
    await Promise.resolve();
    expect(JSON.parse((await storage.getItem(KEY))!).azan.maghrib).toBe('adhan2');
  });

  it('begrenzt die Lautstaerke auf 0,1 bis 1,0', async () => {
    const { s, storage } = loadSettings();
    await storage.clear();
    await s.hydrateTvSettings();
    s.setAzanVolume(1.5);
    expect(s.tvSettingsState().azanVolume).toBe(1);
    s.setAzanVolume(-2);
    // Nicht 0: ein Ruf, der eingeschaltet aussieht und stumm bleibt, waere
    // schlimmer als gar keiner.
    expect(s.tvSettingsState().azanVolume).toBe(0.1);
    s.setAzanVolume(0.55);
    expect(s.tvSettingsState().azanVolume).toBe(0.6);
  });

  it('benachrichtigt Abonnenten bei jeder Aenderung (Basis)', async () => {
    const { s, storage } = loadSettings();
    await storage.clear();
    const seen: string[] = [];
    // useTvSettings abonniert intern denselben Store; hier ueber den Zustand
    // gepruefte Aenderungen genuegen als Beleg fuer die Emit-Kette.
    s.setLocation({ ...DEFAULT_LOCATION, label: 'A' });
    seen.push(s.tvSettingsState().location.label);
    s.setLocation({ ...DEFAULT_LOCATION, label: 'B' });
    seen.push(s.tvSettingsState().location.label);
    expect(seen).toEqual(['A', 'B']);
  });
});

/**
 * Audit 2026-07-29 (P1): die Rechenparameter der Gebetszeiten kamen bis dahin
 * nicht vollstaendig aus den Einstellungen — Hochbreiten-Regel und
 * Minuten-Korrektur gab es gar nicht, und die Methode stand als adhan-Name im
 * Speicher statt als Aladhan-ID wie in der Handy-App.
 */
describe('Migration alter Einstellungen', () => {
  it('schreibt einen gespeicherten adhan-Methodennamen auf die Aladhan-ID um', async () => {
    const { s, storage } = loadSettings();
    await storage.clear();
    await storage.setItem(
      KEY,
      JSON.stringify({
        location: { lat: 21.4225, lon: 39.8262, label: 'Makkah', cityId: 'makkah', method: 'UmmAlQura', madhab: 'shafi' },
      }),
    );
    await s.hydrateTvSettings();
    expect(s.tvSettingsState().location.method).toBe(4);
  });

  it('ergaenzt fehlende Felder mit den Vorgaben der Handy-App', async () => {
    const { s, storage } = loadSettings();
    await storage.clear();
    await storage.setItem(KEY, JSON.stringify({ is24h: true }));
    await s.hydrateTvSettings();
    expect(s.tvSettingsState().highLatitude).toBe('auto');
    expect(s.tvSettingsState().offsets).toEqual(NO_PRAYER_TIME_OFFSETS);
    expect(s.tvSettingsState().location).toEqual(DEFAULT_LOCATION);
  });

  it('verwirft eine unbekannte Hochbreiten-Regel und kaputte Korrekturwerte', async () => {
    const { s, storage } = loadSettings();
    await storage.clear();
    await storage.setItem(
      KEY,
      JSON.stringify({ highLatitude: 'quatsch', offsets: { fajr: 'x', isha: 999, dhuhr: -3 } }),
    );
    await s.hydrateTvSettings();
    expect(s.tvSettingsState().highLatitude).toBe('auto');
    expect(s.tvSettingsState().offsets).toEqual({
      ...NO_PRAYER_TIME_OFFSETS,
      isha: 60, // auf das Maximum der Handy-App geklemmt
      dhuhr: -3,
    });
  });
});

describe('Hochbreiten-Regel und Minuten-Korrektur', () => {
  it('setzt die Regel und persistiert sie', async () => {
    const { s, storage } = loadSettings();
    await storage.clear();
    await s.hydrateTvSettings();
    s.setHighLatitude('seventhOfNight');
    expect(s.tvSettingsState().highLatitude).toBe('seventhOfNight');
    await Promise.resolve();
    expect(JSON.parse((await storage.getItem(KEY))!).highLatitude).toBe('seventhOfNight');
  });

  it('schrittweises Verstellen bleibt im erlaubten Bereich', async () => {
    const { s, storage } = loadSettings();
    await storage.clear();
    await s.hydrateTvSettings();
    for (let i = 0; i < 5; i++) s.adjustOffset('fajr', 1);
    expect(s.tvSettingsState().offsets.fajr).toBe(5);
    for (let i = 0; i < 100; i++) s.adjustOffset('fajr', -1);
    expect(s.tvSettingsState().offsets.fajr).toBe(-60);
    s.resetOffsets();
    expect(s.tvSettingsState().offsets).toEqual(NO_PRAYER_TIME_OFFSETS);
  });

  it('calcExtras buendelt genau die Werte, mit denen gerechnet wird', async () => {
    const { s, storage } = loadSettings();
    await storage.clear();
    await s.hydrateTvSettings();
    s.setHighLatitude('twilightAngle');
    s.adjustOffset('isha', 3);
    expect(s.calcExtras(s.tvSettingsState())).toEqual({
      highLatitude: 'twilightAngle',
      offsets: { ...NO_PRAYER_TIME_OFFSETS, isha: 3 },
    });
  });
  // Rechenparameter vom gekoppelten Handy (Nachricht `einstellungen`). Die
  // Nutzlast kommt ueber ein LAN-Socket — jedes Feld muss einzeln geprueft
  // werden, und eine unvollstaendige Nachricht darf den TV-Stand nicht
  // beschaedigen.
  describe('applyRemoteSettings', () => {
    it('uebernimmt Ort, Methode, Madhab, Hochbreiten-Regel, Offsets und Zeitformat', async () => {
      const { s, storage } = loadSettings();
      await storage.clear();
      await s.hydrateTvSettings();
      const uebernommen = s.applyRemoteSettings({
        t: 'einstellungen',
        location: { lat: 48.137, lon: 11.575, label: 'München', method: 3, madhab: 'hanafi' },
        is24h: false,
        highLatitude: 'twilightAngle',
        offsets: { fajr: -2, sunrise: 0, dhuhr: 1, asr: 0, maghrib: 0, isha: 3 },
      });
      expect(uebernommen.sort()).toEqual(['highLatitude', 'is24h', 'location', 'offsets']);
      const st = s.tvSettingsState();
      expect(st.location).toEqual({
        lat: 48.137,
        lon: 11.575,
        label: 'München',
        cityId: undefined,
        method: 3,
        madhab: 'hanafi',
      });
      expect(st.is24h).toBe(false);
      expect(st.highLatitude).toBe('twilightAngle');
      expect(st.offsets.fajr).toBe(-2);
      expect(st.offsets.isha).toBe(3);
    });

    it('laesst den Standort unveraendert, wenn die Koordinaten fehlen', async () => {
      const { s, storage } = loadSettings();
      await storage.clear();
      await s.hydrateTvSettings();
      s.setLocation({ lat: 21.42, lon: 39.83, label: 'Makkah', method: 4, madhab: 'shafi' });
      const uebernommen = s.applyRemoteSettings({ t: 'einstellungen', location: { label: 'Nirgendwo' } });
      expect(uebernommen).toEqual([]);
      expect(s.tvSettingsState().location.label).toBe('Makkah');
    });

    it('ignoriert Muell und meldet nichts uebernommen', async () => {
      const { s, storage } = loadSettings();
      await storage.clear();
      await s.hydrateTvSettings();
      expect(s.applyRemoteSettings(null)).toEqual([]);
      expect(s.applyRemoteSettings('kaputt')).toEqual([]);
      expect(s.applyRemoteSettings({ t: 'einstellungen', highLatitude: 'erfunden' })).toEqual([]);
      expect(s.tvSettingsState().highLatitude).toBe('auto');
    });

    it('uebernimmt einzelne Felder, ohne die uebrigen zu ueberschreiben', async () => {
      const { s, storage } = loadSettings();
      await storage.clear();
      await s.hydrateTvSettings();
      s.setHighLatitude('seventhOfNight');
      expect(s.applyRemoteSettings({ t: 'einstellungen', is24h: false })).toEqual(['is24h']);
      expect(s.tvSettingsState().highLatitude).toBe('seventhOfNight');
      expect(s.tvSettingsState().is24h).toBe(false);
    });
  });
});
