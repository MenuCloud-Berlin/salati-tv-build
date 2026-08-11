import { leeren } from '@/lib/cache';
import {
  FETCH_TIMEOUT_MS,
  fetchPodcasts,
  fetchReels,
  fetchVideos,
  fetchWithTimeout,
  fmtDuration,
  groupBySeries,
  kamAusAblage,
} from '@/lib/content';

describe('groupBySeries', () => {
  it('gruppiert nach `series` in Erst-Auftritts-Reihenfolge', () => {
    const items: { series?: string; series_title?: string; id: number }[] = [
      { series: 'b', series_title: 'B', id: 1 },
      { series: 'a', series_title: 'A', id: 2 },
      { series: 'b', series_title: 'B', id: 3 },
    ];
    const secs = groupBySeries(items);
    expect(secs.map((s) => s.key)).toEqual(['b', 'a']);
    expect(secs[0].items.map((i) => i.id)).toEqual([1, 3]);
    expect(secs[0].title).toBe('B');
  });

  it('sammelt Eintraege ohne Reihe in einer Sammel-Sektion', () => {
    const lose: { series?: string; series_title?: string; id: number }[] = [{ id: 1 }, { id: 2 }];
    const secs = groupBySeries(lose);
    expect(secs).toHaveLength(1);
    expect(secs[0].key).toBe('__');
    expect(secs[0].title).toBe('Videos'); // Fallback-Titel
  });

  it('liefert fuer eine leere Liste keine Sektionen (Leerzustand)', () => {
    expect(groupBySeries([])).toEqual([]);
  });
});

describe('fmtDuration', () => {
  it('formatiert m:ss mit fuehrender Null bei den Sekunden', () => {
    expect(fmtDuration(65)).toBe('1:05');
    expect(fmtDuration(600)).toBe('10:00');
    expect(fmtDuration(3661)).toBe('61:01'); // ueber eine Stunde bleibt Minuten-basiert
  });

  it('gibt fuer fehlende/unsinnige Dauer einen leeren String zurueck', () => {
    expect(fmtDuration(undefined)).toBe('');
    expect(fmtDuration(0)).toBe('');
    expect(fmtDuration(-5)).toBe('');
  });
});

describe('fetchWithTimeout', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
    jest.useRealTimers();
  });

  it('reicht ein AbortSignal durch und bricht nach dem Timeout ab', async () => {
    jest.useFakeTimers();
    let captured: AbortSignal | undefined;
    globalThis.fetch = jest.fn((_u: unknown, init?: RequestInit) => {
      captured = init?.signal ?? undefined;
      return new Promise<Response>(() => {}); // haengt, wie ein totes WLAN
    }) as unknown as typeof fetch;

    void fetchWithTimeout('https://example.test/x');
    expect(captured?.aborted).toBe(false);
    jest.advanceTimersByTime(FETCH_TIMEOUT_MS);
    expect(captured?.aborted).toBe(true);
  });

  it('raeumt den Timer auf, wenn die Antwort rechtzeitig kommt', async () => {
    const clear = jest.spyOn(globalThis, 'clearTimeout');
    globalThis.fetch = jest.fn(async () => new Response('{}')) as unknown as typeof fetch;
    await fetchWithTimeout('https://example.test/x');
    expect(clear).toHaveBeenCalled();
    clear.mockRestore();
  });
});

describe('Index-Abrufe', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function respond(body: unknown, ok = true, status = 200) {
    globalThis.fetch = jest.fn(async () => ({
      ok,
      status,
      json: async () => body,
    })) as unknown as typeof fetch;
  }

  it('sortiert Podcast-Folgen aufsteigend nach Folgennummer', async () => {
    respond({ episodes: [{ episode_no: 3 }, { episode_no: 1 }, { episode_no: 2 }] });
    const eps = await fetchPodcasts();
    expect(eps.map((e) => e.episode_no)).toEqual([1, 2, 3]);
  });

  // Ein Index ohne die erwartete Wurzel darf keinen Absturz erzeugen, sondern
  // muss zum Leerzustand fuehren.
  it.each([
    ['Videos', fetchVideos],
    ['Reels', fetchReels],
    ['Podcasts', fetchPodcasts],
  ])('%s: fehlende Wurzel ergibt eine leere Liste statt eines Fehlers', async (_l, fn) => {
    respond({});
    await expect(fn()).resolves.toEqual([]);
  });

  it.each([
    ['Videos', fetchVideos],
    ['Reels', fetchReels],
    ['Podcasts', fetchPodcasts],
  ])('%s: HTTP-Fehler wird als Fehler weitergereicht, wenn nichts abgelegt ist', async (_l, fn) => {
    // Leere Ablage ist hier die VORAUSSETZUNG, nicht Beiwerk: seit 1.4.0 faengt
    // sie einen Ausfall ab. Ohne sie gibt es nichts zu zeigen — dann muss der
    // Fehler durchkommen, damit der Bildschirm „Erneut versuchen" anbietet.
    await leeren();
    respond({}, false, 503);
    await expect(fn()).rejects.toThrow('fetch_503');
  });

  // Das ist der eigentliche Zweck der Ablage: ein Fernseher am Rand des WLANs
  // soll die zuletzt geladene Liste zeigen statt einer Fehlermeldung.
  it.each([
    ['Videos', fetchVideos, { episodes: [{ episode_no: 1, title: 'A', video_url: 'u' }] }, 'videos'],
    ['Reels', fetchReels, { reels: [{ id: 'r1', episode_no: 1, index: 1, title: 'A', video_url: 'u' }] }, 'reels'],
    ['Podcasts', fetchPodcasts, { episodes: [{ episode_no: 1, title: 'A', audio_url: 'u' }] }, 'podcasts'],
  ])('%s: ohne Netz kommt die zuletzt geladene Liste aus der Ablage', async (_l, fn, nutzlast, bereich) => {
    await leeren();
    respond(nutzlast);
    const frisch = await fn();
    expect(frisch).toHaveLength(1);
    expect(kamAusAblage(bereich as string)).toBe(false);

    // Jetzt faellt das Netz aus.
    globalThis.fetch = jest.fn(async () => {
      throw new Error('kein netz');
    }) as unknown as typeof fetch;
    const ausAblage = await fn();
    expect(ausAblage).toEqual(frisch);
    expect(kamAusAblage(bereich as string)).toBe(true);
  });
});

/**
 * Bildschirmbefund 2026-08-08: Ohne Netz erschien die Rezitatoren-Liste, aber
 * der Hinweis „ohne Netz" blieb aus — OkHttp hatte die Antwort still aus seinem
 * EIGENEN HTTP-Zwischenspeicher bedient, der Abruf galt damit als gelungen.
 * Zwei Zwischenspeicher fuer dieselbe Sache sind einer zu viel; der unsichtbare
 * ist aus. Ohne diese Vorgabe waere der Zustand fuer den Nutzer nicht ablesbar.
 */
describe('fetchWithTimeout', () => {
  it('verbietet den HTTP-Zwischenspeicher ueber den KOPFEINTRAG', async () => {
    // Der Kopfeintrag ist der wirksame Teil: React Natives `fetch` wertet die
    // `cache`-Option gar nicht aus (s. Kommentar an fetchWithTimeout). Ohne
    // ihn lieferte OkHttp ohne Netz still alte Antworten, und der Bildschirm
    // konnte gar nicht wissen, dass er Gespeichertes zeigt.
    const spy = jest.fn(async () => ({ ok: true, json: async () => ({}) }));
    globalThis.fetch = spy as unknown as typeof fetch;
    await fetchWithTimeout('https://example.invalid/x');
    expect(spy).toHaveBeenCalledWith(
      'https://example.invalid/x',
      expect.objectContaining({ headers: expect.objectContaining({ 'Cache-Control': 'no-store' }) }),
    );
  });

  it('lässt den Aufrufer die Vorgabe überschreiben', async () => {
    const spy = jest.fn(async () => ({ ok: true, json: async () => ({}) }));
    globalThis.fetch = spy as unknown as typeof fetch;
    await fetchWithTimeout('https://example.invalid/x', { cache: 'reload' });
    expect(spy).toHaveBeenCalledWith('https://example.invalid/x', expect.objectContaining({ cache: 'reload' }));
  });
});
