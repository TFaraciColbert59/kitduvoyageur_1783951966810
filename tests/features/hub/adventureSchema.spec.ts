import { describe, it, expect } from 'vitest';
import {
  serializeActiveAdventure,
  deserializeActiveAdventure,
  parseStoredAdventure,
  ACTIVE_ADVENTURE_COOKIE,
} from '@/features/hub/context/adventureSchema';

/**
 * H2.1 — Tests du schéma d'aventure active, ÉCRITS AVANT L'IMPLÉMENTATION.
 * Miroir strict de activeTripSchema (cookie httpOnly + base64url).
 */

describe('H2 — adventureSchema : persistance typée', () => {
  it('SCH-1: nom du cookie = lkv_active_adventure', () => {
    expect(ACTIVE_ADVENTURE_COOKIE).toBe('lkv_active_adventure');
  });

  it('SCH-2: round-trip possession', () => {
    const s = serializeActiveAdventure({ nature: 'possession' });
    expect(deserializeActiveAdventure(s)).toEqual({ nature: 'possession' });
  });

  it('SCH-3: round-trip sortie', () => {
    const s = serializeActiveAdventure({ nature: 'sortie', id: 't1', slug: 'gr20', title: 'GR20' });
    expect(deserializeActiveAdventure(s)).toEqual({ nature: 'sortie', id: 't1', slug: 'gr20', title: 'GR20' });
  });

  it('SCH-4: round-trip collectif', () => {
    const s = serializeActiveAdventure({ nature: 'collectif', id: 'g1', title: 'Alpes' });
    expect(deserializeActiveAdventure(s)).toEqual({ nature: 'collectif', id: 'g1', title: 'Alpes' });
  });

  it('SCH-5: entrées invalides = null (jamais de throw)', () => {
    expect(deserializeActiveAdventure(null)).toBeNull();
    expect(deserializeActiveAdventure(undefined)).toBeNull();
    expect(deserializeActiveAdventure('')).toBeNull();
    expect(deserializeActiveAdventure('!!!pas-du-base64!!!')).toBeNull();
    expect(deserializeActiveAdventure(Buffer.from(JSON.stringify({ nature: 'sortie' })).toString('base64url'))).toBeNull();
    expect(deserializeActiveAdventure(Buffer.from(JSON.stringify({ nature: 'ovni' })).toString('base64url'))).toBeNull();
  });

  it('SCH-6: parseStoredAdventure lit le JSON localStorage (valide ET corrompu)', () => {
    expect(parseStoredAdventure(JSON.stringify({ nature: 'possession' }))).toEqual({ nature: 'possession' });
    expect(parseStoredAdventure(null)).toBeNull();
    expect(parseStoredAdventure('{corrompu')).toBeNull();
    expect(parseStoredAdventure(JSON.stringify({ nature: 'sortie', slug: 'x' }))).toBeNull();
  });
});
