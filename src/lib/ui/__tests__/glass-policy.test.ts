import { describe, expect, it } from 'vitest';
import { shouldReduceGlassEffects } from '../glass-policy';

describe('production glass quality policy', () => {
  it.each([{ saveData: true }, { reducedTransparency: true }, { hardwareConcurrency: 4 }, { deviceMemory: 4 }])('reduces effects for %j', hints => {
    expect(shouldReduceGlassEffects(hints)).toBe(true);
  });
  it('keeps normal effects on known capable hardware', () => {
    expect(shouldReduceGlassEffects({ hardwareConcurrency: 8, deviceMemory: 8, saveData: false })).toBe(false);
  });
  it('does not classify missing or invalid hardware hints as weak', () => {
    expect(shouldReduceGlassEffects({})).toBe(false);
    expect(shouldReduceGlassEffects({ hardwareConcurrency: 0, deviceMemory: -1 })).toBe(false);
  });
});
