import { describe, expect, it, vi } from 'vitest';
import {
  HUB_SOUND_STORAGE_KEY,
  HubSoundController,
  type MinimalAudioContext,
} from '../ambience/sound';
import { resolveAmbienceState } from '../ambience/environment';
import { QualityGovernor } from '@/features/kit-studio/scene/quality';

function createMemoryStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => {
      store.set(key, val);
    },
  };
}

function createFakeAudioContext(): MinimalAudioContext & {
  suspendCalls: number;
  resumeCalls: number;
} {
  const ctx = {
    state: 'running' as 'suspended' | 'running' | 'closed',
    suspendCalls: 0,
    resumeCalls: 0,
    async suspend() {
      ctx.suspendCalls += 1;
      ctx.state = 'suspended';
    },
    async resume() {
      ctx.resumeCalls += 1;
      ctx.state = 'running';
    },
    async close() {
      ctx.state = 'closed';
    },
  };
  return ctx;
}

describe('HubSoundController — D-18, D-19, D-20, D-21', () => {
  it('D-18 & D-19 : est muet par défaut et ne crée AUCUN AudioContext avant un geste utilisateur', () => {
    let createdCount = 0;
    const storage = createMemoryStorage();
    const controller = new HubSoundController({
      storage,
      createAudioContext: () => {
        createdCount += 1;
        return createFakeAudioContext();
      },
    });

    expect(controller.getSnapshot().isMuted).toBe(true);
    expect(controller.getSnapshot().preference).toBe('muted');
    expect(controller.hasAudioContext()).toBe(false);
    expect(createdCount).toBe(0);

    // Un tick sonore appelé sans geste préalable ne doit ni jouer ni créer d'AudioContext
    expect(controller.playTactileTick()).toBe(false);
    expect(createdCount).toBe(0);
  });

  it('D-19 : même avec une préférence sauvegardée "enabled", aucun AudioContext n’est créé avant le geste utilisateur', async () => {
    let createdCount = 0;
    const storage = createMemoryStorage({ [HUB_SOUND_STORAGE_KEY]: 'enabled' });
    const controller = new HubSoundController({
      storage,
      createAudioContext: () => {
        createdCount += 1;
        return createFakeAudioContext();
      },
    });

    expect(controller.hasAudioContext()).toBe(false);
    expect(createdCount).toBe(0);

    // Geste explicite -> création unique du contexte
    const snap = await controller.enableFromUserGesture();
    expect(createdCount).toBe(1);
    expect(snap.hasContext).toBe(true);
    expect(snap.isMuted).toBe(false);
  });

  it('D-20 : coupe le son au passage en arrière-plan et NE reprend JAMAIS tout seul au retour', async () => {
    const fakeCtx = createFakeAudioContext();
    const controller = new HubSoundController({
      storage: createMemoryStorage(),
      createAudioContext: () => fakeCtx,
    });

    let visibility: DocumentVisibilityState = 'visible';
    const listeners = new Set<() => void>();
    const fakeDoc = {
      get visibilityState() {
        return visibility;
      },
      addEventListener: (_ev: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_ev: string, cb: () => void) => listeners.delete(cb),
    } as unknown as Document;

    controller.attachLifecycleListeners(fakeDoc);
    await controller.enableFromUserGesture();
    expect(controller.getSnapshot().isMuted).toBe(false);

    // Passage en arrière-plan
    visibility = 'hidden';
    listeners.forEach((cb) => cb());
    await Promise.resolve();

    expect(fakeCtx.suspendCalls).toBe(1);
    expect(fakeCtx.state).toBe('suspended');
    expect(controller.getSnapshot().isMuted).toBe(true);
    expect(controller.getSnapshot().suspendedByBackground).toBe(true);

    // Retour au premier plan SANS geste utilisateur -> reste suspendu !
    visibility = 'visible';
    listeners.forEach((cb) => cb());
    await Promise.resolve();

    expect(fakeCtx.resumeCalls).toBe(0);
    expect(fakeCtx.state).toBe('suspended');
    expect(controller.getSnapshot().isMuted).toBe(true);
  });

  it('D-21 : la préférence "muet" est persistée et ne se réarme jamais automatiquement au rechargement', async () => {
    const storage = createMemoryStorage();
    const firstSession = new HubSoundController({
      storage,
      createAudioContext: () => createFakeAudioContext(),
    });

    await firstSession.enableFromUserGesture();
    expect(storage.getItem(HUB_SOUND_STORAGE_KEY)).toBe('enabled');

    await firstSession.mute();
    expect(storage.getItem(HUB_SOUND_STORAGE_KEY)).toBe('muted');
    expect(firstSession.getSnapshot().isMuted).toBe(true);

    // Nouvelle session (rechargement de page)
    const secondSession = new HubSoundController({
      storage,
      createAudioContext: vi.fn(() => createFakeAudioContext()),
    });
    expect(secondSession.isPreferenceMuted()).toBe(true);
    expect(secondSession.getSnapshot().isMuted).toBe(true);
    expect(secondSession.hasAudioContext()).toBe(false);
  });
});

describe('resolveAmbienceState — D-23 & D-24', () => {
  it('D-23 : météo absente ou source non légitime -> aucun effet météo ni saison inventée', () => {
    const noData = resolveAmbienceState({
      now: new Date('2026-07-15T14:00:00Z'),
      projectLatitude: null,
      weather: null,
    });
    expect(noData.weatherEffect).toBe('none');
    expect(noData.weatherSource).toBeNull();
    expect(noData.season).toBe('none');
    expect(noData.animatedEffects).toBe(false);

    const fakeSource = resolveAmbienceState({
      now: new Date('2026-07-15T14:00:00Z'),
      projectLatitude: 45.9,
      weather: {
        source: 'fake-random-weather',
        precipitationMmH: 12,
      },
    });
    expect(fakeSource.weatherEffect).toBe('none');
    expect(fakeSource.weatherSource).toBeNull();
  });

  it('D-23 : active un effet météo uniquement sur une donnée réelle MET Norway ou NASA POWER', () => {
    const metRain = resolveAmbienceState({
      now: new Date('2026-10-18T10:00:00Z'),
      projectLatitude: 45.92,
      projectElevationM: 2450,
      weather: {
        source: 'met-norway',
        precipitationMmH: 3.4,
        temperatureC: 6,
      },
    });
    expect(metRain.weatherEffect).toBe('rain');
    expect(metRain.weatherSource).toBe('met-norway');
    expect(metRain.season).toBe('autumn');
    expect(metRain.elevationBand).toBe('high-alpine');
    expect(metRain.animatedEffects).toBe(true);

    // prefers-reduced-motion fige l'animation mais conserve l'état lisible
    const reduced = resolveAmbienceState({
      now: new Date('2026-10-18T10:00:00Z'),
      projectLatitude: 45.92,
      reducedMotion: true,
      weather: {
        source: 'nasa-power',
        precipitationMmH: 3.4,
        temperatureC: -3,
      },
    });
    expect(reduced.weatherEffect).toBe('snow');
    expect(reduced.animatedEffects).toBe(false);
  });

  it('D-24 : coupe l’ambiance EN PREMIER sur batterie faible via QualityGovernor', () => {
    const governor = new QualityGovernor();
    governor.setBatteryStatus({ level: 0.14, charging: false });
    const profile = governor.getProfile();
    expect(profile.ambienceEnabled).toBe(false);
    expect(profile.degradedToList).toBe(false);

    const ambience = resolveAmbienceState({
      now: new Date('2026-07-15T14:00:00Z'),
      projectLatitude: 45.9,
      qualityAmbienceEnabled: profile.ambienceEnabled,
      weather: {
        source: 'met-norway',
        precipitationMmH: 5.0,
        temperatureC: 8,
      },
    });
    expect(ambience.active).toBe(false);
    expect(ambience.cutReason).toBe('low-battery-or-quality');
    expect(ambience.weatherEffect).toBe('none');
  });
});
