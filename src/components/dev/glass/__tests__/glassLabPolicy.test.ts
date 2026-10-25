import { describe, expect, it } from 'vitest';
import { canOpenGlassLab, resolveGlassEngine } from '../glassLabPolicy';

const capable = { ready: true, backdropFilter: true };

describe('glass laboratory access', () => {
  it('requires the explicit server flag in production', () => {
    expect(canOpenGlassLab('production', undefined)).toBe(false);
    expect(canOpenGlassLab('production', 'true')).toBe(false);
    expect(canOpenGlassLab('production', '0')).toBe(false);
    expect(canOpenGlassLab('production', '1')).toBe(true);
  });
  it('allows development without weakening production', () => {
    expect(canOpenGlassLab('development', undefined)).toBe(true);
  });
});

describe('glass laboratory quality gate', () => {
  it.each(['rdev', 'samasante'] as const)('allows requested %s after capability detection', (engine) => {
    expect(resolveGlassEngine(engine, capable).engine).toBe(engine);
  });
  it('renders standard before mounting for deterministic SSR', () => {
    expect(resolveGlassEngine('rdev', { ready: false, backdropFilter: true }).engine).toBe('standard');
  });
  it.each([
    { reducedMotion: true }, { reducedTransparency: true }, { increasedContrast: true },
    { forcedColors: true }, { saveData: true }, { hardwareConcurrency: 2 },
    { deviceMemory: 2 }, { backdropFilter: false }, { forceStandard: true },
  ])('prevents premium when constrained by %j', (constraint) => {
    expect(resolveGlassEngine('rdev', { ...capable, ...constraint }).engine).toBe('standard');
    expect(resolveGlassEngine('samasante', { ...capable, ...constraint }).reason).not.toBeNull();
  });
  it('does not infer a weak device from unavailable hardware hints', () => {
    expect(resolveGlassEngine('samasante', capable).engine).toBe('samasante');
  });
  it('preserves explicit standard on capable hardware', () => {
    expect(resolveGlassEngine('standard', capable).engine).toBe('standard');
  });
});
