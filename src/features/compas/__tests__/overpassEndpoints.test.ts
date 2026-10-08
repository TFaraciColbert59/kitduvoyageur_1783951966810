import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import { OVERPASS_ENDPOINTS } from '../server/stagePoiLookup';

/**
 * Plan 1.4 (8 octobre) : un seul serveur Overpass, celui dont les conditions
 * autorisent l'usage commercial. overpass-api.de et ses miroirs (kumi, .ru,
 * mail.ru) renvoient les usages commerciaux vers leurs propres serveurs.
 */
describe('Overpass du Compas', () => {
  it('interroge private.coffee seulement', () => {
    expect([...OVERPASS_ENDPOINTS]).toEqual(['https://overpass.private.coffee/api/interpreter']);
  });
});
