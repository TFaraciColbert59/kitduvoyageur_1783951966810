import { describe, expect, it } from 'vitest';
import { metaOf, validateMomentInput } from '../createMoment';
import { parseMomentMeta } from '../momentTypes';

/**
 * Son d'ambiance (proposition n° 32) : une note vocale peut se passer de
 * commentaire — on capte un lieu (torrent, vent, oiseaux) sans écrire un récit.
 * Sans la case, un titre reste obligatoire comme avant.
 */
describe('Son d’ambiance — validation, meta et relecture', () => {
  it('refuse une note vocale sans titre ni case ambiance', () => {
    const result = validateMomentInput({ type: 'voice', place: 'Torrent', day: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/son d’ambiance/);
  });

  it('accepte une note vocale sans titre quand c’est un son d’ambiance', () => {
    const result = validateMomentInput({
      type: 'voice',
      place: 'Torrent',
      day: 2,
      ambiance: true,
      durationLabel: '0:42',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(metaOf(result.value)).toEqual({ ambiance: true, durationLabel: '0:42' });
    }
  });

  it('relit `ambiance` depuis moment_meta, et ignore une valeur non booléenne', () => {
    expect(parseMomentMeta({ ambiance: true, durationLabel: '0:31' })).toEqual({
      ambiance: true,
      durationLabel: '0:31',
    });
    expect(parseMomentMeta({ ambiance: 'oui' })).toBeNull();
  });
});
