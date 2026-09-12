import { describe, it, expect } from 'vitest';
import { resolveDepartIdentity } from '@/features/materiel/domain/departIdentity';

describe('resolveDepartIdentity', () => {
  it('sentier explicite ⇒ titre = sentier, sous-titre = destination', () => {
    expect(resolveDepartIdentity({ destination: 'Tour du Mont-Blanc — 4j Bivouac', trailName: 'GR 128 Flandres' }))
      .toEqual({ title: 'GR 128 Flandres', subtitle: 'Tour du Mont-Blanc — 4j Bivouac', fromTrail: true });
  });
  it('sans sentier ⇒ destination telle quelle', () => {
    expect(resolveDepartIdentity({ destination: 'Kit été' }))
      .toEqual({ title: 'Kit été', subtitle: null, fromTrail: false });
  });
  it('sentier identique à la destination ⇒ pas de sous-titre redondant', () => {
    expect(resolveDepartIdentity({ destination: 'GR 128', trailName: 'GR 128' }).subtitle).toBeNull();
  });
  it('tout vide ⇒ « Prochain départ »', () => {
    expect(resolveDepartIdentity({}).title).toBe('Prochain départ');
    expect(resolveDepartIdentity({ destination: '  ', trailName: null }).title).toBe('Prochain départ');
  });
});
