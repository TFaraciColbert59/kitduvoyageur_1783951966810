import { describe, expect, it } from 'vitest';
import { normalizeVideoPreferences, resolveVideoPlayback } from '../videoPlayback';

const base = {
  preferences: { autoplay: true, sound: true, loop: true, data_saver: false },
  audienceAllowed: true,
  documentVisible: true,
  visibleFraction: 1,
  reducedMotion: false,
  saveData: false,
  connectionType: '4g',
};

describe('G01 vidéo — défauts sûrs', () => {
  it('ne lance pas de lecture automatique sans préférence explicite', () => {
    const decision = resolveVideoPlayback({
      preferences: {},
      audienceAllowed: true,
      visibleFraction: 1,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.shouldPlay).toBe(false);
    expect(decision.autoplay).toBe(false);
    expect(decision.muted).toBe(true);
    expect(decision.loop).toBe(false);
    expect(decision.controls).toBe(true);
  });

  it('normalise les préférences mal typées vers les défauts', () => {
    const prefs = normalizeVideoPreferences({ autoplay: 'true', sound: 1, data_saver: false });
    expect(prefs.autoplay).toBe(false);
    expect(prefs.sound).toBe(false);
    expect(prefs.data_saver).toBe(false);
  });

  it('ne monte aucun média si l’audience refuse', () => {
    const decision = resolveVideoPlayback({ ...base, audienceAllowed: false });
    expect(decision.allowed).toBe(false);
    expect(decision.shouldPlay).toBe(false);
    expect(decision.preload).toBe('none');
    expect(decision.reason).toBe('audience_denied');
  });
});

describe('G01 vidéo — autoplay conditionnel', () => {
  it('lit automatiquement quand tout est réuni, mais sans son', () => {
    const decision = resolveVideoPlayback(base);
    expect(decision.shouldPlay).toBe(true);
    expect(decision.autoplay).toBe(true);
    expect(decision.muted).toBe(true);
    expect(decision.loop).toBe(true);
    expect(decision.reason).toBe('autoplay');
  });

  it('respecte le mouvement réduit', () => {
    const decision = resolveVideoPlayback({ ...base, reducedMotion: true });
    expect(decision.shouldPlay).toBe(false);
    expect(decision.autoplay).toBe(false);
    expect(decision.loop).toBe(false);
    expect(decision.reason).toBe('reduced_motion');
  });

  it('respecte l’économie de données', () => {
    const decision = resolveVideoPlayback({
      ...base,
      preferences: { ...base.preferences, data_saver: true },
    });
    expect(decision.shouldPlay).toBe(false);
    expect(decision.preload).toBe('none');
    expect(decision.reason).toBe('data_saver');
  });

  it('respecte un réseau lent', () => {
    const decision = resolveVideoPlayback({ ...base, connectionType: '2g' });
    expect(decision.shouldPlay).toBe(false);
    expect(decision.reason).toBe('slow_network');
  });

  it('ne lance rien hors écran', () => {
    const decision = resolveVideoPlayback({ ...base, visibleFraction: 0.2 });
    expect(decision.shouldPlay).toBe(false);
    expect(decision.reason).toBe('offscreen');
  });

  it('met en pause quand l’onglet est masqué', () => {
    const decision = resolveVideoPlayback({ ...base, documentVisible: false });
    expect(decision.shouldPause).toBe(true);
    expect(decision.preload).toBe('none');
    expect(decision.reason).toBe('hidden');
  });
});

describe('G01 vidéo — geste utilisateur', () => {
  it('lance la lecture sur geste même si l’autoplay est refusé', () => {
    const decision = resolveVideoPlayback({
      preferences: { autoplay: false, sound: false, loop: false, data_saver: true },
      audienceAllowed: true,
      visibleFraction: 0.2,
      userInitiated: true,
    });
    expect(decision.shouldPlay).toBe(true);
    expect(decision.muted).toBe(true);
    expect(decision.reason).toBe('user');
  });

  it('autorise le son seulement après un geste explicite', () => {
    const decision = resolveVideoPlayback({
      preferences: { autoplay: false, sound: true, loop: false, data_saver: false },
      audienceAllowed: true,
      visibleFraction: 1,
      userInitiated: true,
    });
    expect(decision.muted).toBe(false);
  });

  it('garde le son coupé en autoplay', () => {
    const decision = resolveVideoPlayback({
      preferences: { autoplay: true, sound: true, loop: false, data_saver: false },
      audienceAllowed: true,
      visibleFraction: 1,
    });
    expect(decision.muted).toBe(true);
  });
});
