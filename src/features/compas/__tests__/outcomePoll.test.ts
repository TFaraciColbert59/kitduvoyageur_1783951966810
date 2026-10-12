/**
 * Plan 100, 1.2 « Coût de calcul » / 2.8 — suivi d'une préparation qui coûte
 * moins : intervalle croissant, arrêt onglet caché ou hors ligne, arrêt dès
 * l'issue connue, une seule requête en vol, reprise à la visibilité.
 * Fausses minuteries : aucune attente réelle.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  OUTCOME_POLL_DELAYS_MS,
  browserPollEnvironment,
  waitForOutcome,
  type PollEnvironment,
  type PollReading,
} from '../engine/outcomePoll';

type Outcome = { done: true };

/** Environnement de test : l'onglet et le réseau se règlent à la main. */
function fakeEnv() {
  let visible = true;
  let online = true;
  const listeners = new Set<() => void>();
  const env: PollEnvironment = {
    canPoll: () => visible && online,
    onResume(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
  const fire = () => {
    if (visible && online) for (const cb of [...listeners]) cb();
  };
  return {
    env,
    listeners,
    hide: () => {
      visible = false;
    },
    show: () => {
      visible = true;
      fire();
    },
    goOffline: () => {
      online = false;
    },
    goOnline: () => {
      online = true;
      fire();
    },
  };
}

const none: PollReading<Outcome> = { outcome: null, stamp: 'v1' };
const finished: PollReading<Outcome> = { outcome: { done: true }, stamp: 'v2' };

describe('waitForOutcome', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T10:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('l’intervalle croît puis plafonne (3 s, 4 s, 5 s, 7 s, 10 s, 10 s…)', async () => {
    const f = fakeEnv();
    const times: number[] = [];
    const t0 = Date.now();
    const poll = vi.fn(async () => {
      times.push(Date.now() - t0);
      return times.length >= 8 ? finished : none;
    });
    const result = waitForOutcome<Outcome>({ poll, maxMs: 310_000, env: f.env });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await result).toEqual({ kind: 'outcome', outcome: { done: true } });
    expect(times).toEqual([0, 3_000, 7_000, 12_000, 19_000, 29_000, 39_000, 49_000]);
    expect([...OUTCOME_POLL_DELAYS_MS]).toEqual([3_000, 4_000, 5_000, 7_000, 10_000]);
  });

  it('coûte nettement moins que 4 s fixes sur une préparation longue (300 s)', async () => {
    const f = fakeEnv();
    const poll = vi.fn(async () => none);
    const result = waitForOutcome<Outcome>({ poll, maxMs: 300_000, env: f.env });
    await vi.advanceTimersByTimeAsync(320_000);
    expect((await result).kind).toBe('timeout');
    // 4 s fixes : 75 relectures ; ici au plus 35.
    expect(poll.mock.calls.length).toBeLessThanOrEqual(35);
    expect(poll.mock.calls.length).toBeGreaterThanOrEqual(25);
  });

  it('s’arrête dès l’issue connue : plus aucune relecture, plus aucune minuterie', async () => {
    const f = fakeEnv();
    const poll = vi.fn<() => Promise<PollReading<Outcome>>>().mockResolvedValueOnce(none).mockResolvedValue(finished);
    const result = waitForOutcome<Outcome>({ poll, maxMs: 310_000, env: f.env });
    await vi.advanceTimersByTimeAsync(3_000);
    expect((await result).kind).toBe('outcome');
    expect(poll).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(poll).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    expect(f.listeners.size).toBe(0);
  });

  it('onglet caché : plus aucune relecture ; à la reprise, une relecture tout de suite puis le rythme reprend au début', async () => {
    const f = fakeEnv();
    const times: number[] = [];
    const t0 = Date.now();
    const poll = vi.fn(async () => {
      times.push(Date.now() - t0);
      return none;
    });
    const result = waitForOutcome<Outcome>({ poll, maxMs: 1_000_000, env: f.env });
    await vi.advanceTimersByTimeAsync(7_000); // relectures à 0, 3 s, 7 s
    f.hide();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(times).toEqual([0, 3_000, 7_000]);
    const hiddenFor = Date.now() - t0;
    f.show();
    await vi.advanceTimersByTimeAsync(0);
    expect(times).toEqual([0, 3_000, 7_000, hiddenFor]);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(times.at(-1)).toBe(hiddenFor + 3_000);
    // Rien d'écoulé n'est « rattrapé » : une seule relecture à la reprise.
    expect(times).toHaveLength(5);
    void result;
  });

  it('hors ligne : aucune relecture tant que le réseau est absent, reprise au retour', async () => {
    const f = fakeEnv();
    const poll = vi.fn(async () => none);
    void waitForOutcome<Outcome>({ poll, maxMs: 1_000_000, env: f.env });
    await vi.advanceTimersByTimeAsync(0);
    expect(poll).toHaveBeenCalledTimes(1);
    f.goOffline();
    await vi.advanceTimersByTimeAsync(90_000);
    expect(poll).toHaveBeenCalledTimes(1);
    f.goOnline();
    await vi.advanceTimersByTimeAsync(0);
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it('une seule requête en vol : les reprises pendant une relecture n’en lancent pas une deuxième', async () => {
    const f = fakeEnv();
    let inFlight = 0;
    let maxInFlight = 0;
    let calls = 0;
    const poll = vi.fn(async () => {
      inFlight += 1;
      calls += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 12_000));
      inFlight -= 1;
      return calls >= 3 ? finished : none;
    });
    const result = waitForOutcome<Outcome>({ poll, maxMs: 1_000_000, env: f.env });
    await vi.advanceTimersByTimeAsync(1_000);
    // Des reprises en rafale pendant que la requête est en vol.
    for (let i = 0; i < 5; i += 1) {
      f.hide();
      f.show();
      f.goOffline();
      f.goOnline();
    }
    await vi.advanceTimersByTimeAsync(200_000);
    expect((await result).kind).toBe('outcome');
    expect(maxInFlight).toBe(1);
  });

  it('« Arrêter » (signal) réveille l’attente d’une reprise : la promesse se termine, rien ne reste en suspens', async () => {
    const f = fakeEnv();
    const controller = new AbortController();
    const poll = vi.fn(async () => none);
    const result = waitForOutcome<Outcome>({ poll, maxMs: 1_000_000, env: f.env, signal: controller.signal });
    await vi.advanceTimersByTimeAsync(0);
    f.goOffline();
    await vi.advanceTimersByTimeAsync(10_000);
    controller.abort();
    expect(await result).toEqual({ kind: 'stopped' });
    expect(vi.getTimerCount()).toBe(0);
    expect(f.listeners.size).toBe(0);
    expect(poll).toHaveBeenCalledTimes(1);
  });

  it('« Arrêter » pendant l’attente entre deux relectures : fin immédiate, sans relecture de plus', async () => {
    const f = fakeEnv();
    const controller = new AbortController();
    const poll = vi.fn(async () => none);
    const result = waitForOutcome<Outcome>({ poll, maxMs: 1_000_000, env: f.env, signal: controller.signal });
    await vi.advanceTimersByTimeAsync(1_000);
    controller.abort();
    expect(await result).toEqual({ kind: 'stopped' });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(poll).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('déjà arrêtée avant de commencer : ne relit rien', async () => {
    const f = fakeEnv();
    const poll = vi.fn(async () => none);
    const result = await waitForOutcome<Outcome>({ poll, maxMs: 1_000, env: f.env, isStopped: () => true });
    expect(result).toEqual({ kind: 'stopped' });
    expect(poll).not.toHaveBeenCalled();
  });

  it('délai dépassé : « timeout » ; après une longue absence, une dernière relecture avant de conclure', async () => {
    const f = fakeEnv();
    const poll = vi.fn<() => Promise<PollReading<Outcome>>>().mockResolvedValue(none);
    const result = waitForOutcome<Outcome>({ poll, maxMs: 20_000, env: f.env });
    await vi.advanceTimersByTimeAsync(5_000);
    f.hide();
    await vi.advanceTimersByTimeAsync(600_000); // bien au-delà du délai
    expect(poll.mock.calls.length).toBe(2);
    poll.mockResolvedValue(finished);
    f.show();
    await vi.advanceTimersByTimeAsync(0);
    // L'issue a été écrite pendant l'absence : elle est reprise, pas perdue.
    expect(await result).toEqual({ kind: 'outcome', outcome: { done: true } });
  });

  it('délai dépassé sans issue après la reprise : « timeout »', async () => {
    const f = fakeEnv();
    const poll = vi.fn(async () => none);
    const result = waitForOutcome<Outcome>({ poll, maxMs: 20_000, env: f.env });
    await vi.advanceTimersByTimeAsync(5_000);
    f.hide();
    await vi.advanceTimersByTimeAsync(600_000);
    f.show();
    await vi.advanceTimersByTimeAsync(0);
    expect(await result).toEqual({ kind: 'timeout' });
  });

  it('signale chaque nouveau repère du voyage une fois, jamais deux fois le même', async () => {
    const f = fakeEnv();
    const stamps = ['a', 'a', 'b', 'b', 'b', 'c'];
    const poll = vi.fn(async (): Promise<PollReading<Outcome>> => {
      const stamp = stamps.shift();
      return stamp === undefined ? finished : { outcome: null, stamp };
    });
    const onStamp = vi.fn();
    const result = waitForOutcome<Outcome>({ poll, maxMs: 1_000_000, env: f.env, onStamp });
    await vi.advanceTimersByTimeAsync(120_000);
    await result;
    expect(onStamp.mock.calls.map((c) => c[0])).toEqual(['a', 'b', 'c']);
  });

  it('une relecture qui échoue (réseau coupé) n’arrête rien : on réessaie au rythme suivant', async () => {
    const f = fakeEnv();
    const poll = vi
      .fn<() => Promise<PollReading<Outcome> | null>>()
      .mockRejectedValueOnce(new Error('réseau'))
      .mockResolvedValueOnce(null)
      .mockResolvedValue(finished);
    const result = waitForOutcome<Outcome>({ poll, maxMs: 1_000_000, env: f.env });
    await vi.advanceTimersByTimeAsync(60_000);
    expect((await result).kind).toBe('outcome');
    expect(poll).toHaveBeenCalledTimes(3);
  });
});

describe('browserPollEnvironment', () => {
  class FakeTarget {
    listeners = new Map<string, Set<() => void>>();
    addEventListener(type: string, cb: () => void) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type)!.add(cb);
    }
    removeEventListener(type: string, cb: () => void) {
      this.listeners.get(type)?.delete(cb);
    }
    emit(type: string) {
      for (const cb of [...(this.listeners.get(type) ?? [])]) cb();
    }
    count() {
      return [...this.listeners.values()].reduce((n, s) => n + s.size, 0);
    }
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stub(visibility: string, onLine: boolean) {
    const doc = Object.assign(new FakeTarget(), { visibilityState: visibility });
    const win = new FakeTarget();
    vi.stubGlobal('document', doc);
    vi.stubGlobal('window', win);
    vi.stubGlobal('navigator', { onLine });
    return { doc, win };
  }

  it('on interroge seulement onglet visible et réseau présent (« prerender » compte comme visible)', () => {
    const { doc } = stub('visible', true);
    const env = browserPollEnvironment();
    expect(env.canPoll()).toBe(true);
    doc.visibilityState = 'hidden';
    expect(env.canPoll()).toBe(false);
    doc.visibilityState = 'prerender';
    expect(env.canPoll()).toBe(true);
    vi.stubGlobal('navigator', { onLine: false });
    expect(env.canPoll()).toBe(false);
  });

  it('prévient à la reprise (visibilitychange visible, retour du réseau) et se désinscrit', () => {
    const { doc, win } = stub('hidden', false);
    const env = browserPollEnvironment();
    const cb = vi.fn();
    const off = env.onResume(cb);
    doc.emit('visibilitychange'); // encore caché et hors ligne
    expect(cb).not.toHaveBeenCalled();
    doc.visibilityState = 'visible';
    vi.stubGlobal('navigator', { onLine: true });
    doc.emit('visibilitychange');
    expect(cb).toHaveBeenCalledTimes(1);
    win.emit('online');
    expect(cb).toHaveBeenCalledTimes(2);
    off();
    expect(doc.count() + win.count()).toBe(0);
    win.emit('online');
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('hors navigateur (rendu serveur) : on peut interroger, rien à écouter', () => {
    vi.stubGlobal('document', undefined);
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('navigator', undefined);
    const env = browserPollEnvironment();
    expect(env.canPoll()).toBe(true);
    expect(() => env.onResume(() => {})()).not.toThrow();
  });
});
