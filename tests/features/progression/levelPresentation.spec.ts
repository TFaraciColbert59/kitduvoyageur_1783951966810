import { describe, expect, it } from 'vitest';
import { calculateLevel, LEVEL_TIERS } from '@/features/progression/domain/rules';

// Launch thresholds and historical identities (badge = clé de la base LKDV V2) must survive a presentation upgrade.
const historicalTiers = [
  [1, 0, 99, 'Randonneur Curieux', 'flore'],
  [2, 100, 299, 'Marcheur Averti', 'foret'],
  [3, 300, 699, 'Arpenteur des Bois', 'boussole'],
  [4, 700, 1499, 'Éclaireur des Cimes', 'montagne'],
  [5, 1500, 2999, 'Navigateur Alpin', 'sommet'],
  [6, 3000, 5499, 'Pionnier des Crêtes', 'observation'],
  [7, 5500, 8999, 'Guide de Cordée', 'escalade'],
  [8, 9000, 13999, "Maître d'Expédition", 'neige'],
  [9, 14000, 19999, 'Légende des Sentiers', 'points'],
  [10, 20000, null, 'Gardien des Horizons', 'recompense'],
] as const;

describe('Level presentation without permissions or commercial promises', () => {
  it('preserves all ten launch thresholds, historical titles and badges', () => {
    expect(LEVEL_TIERS.map(({ level, minPoints, maxPoints, title, badge }) =>
      [level, minPoints, maxPoints, title, badge],
    )).toEqual(historicalTiers);
  });

  it.each(historicalTiers)('preserves the exact lower boundary of level %i', (level, min, max, title, badge) => {
    expect(calculateLevel(min)).toEqual({
      level, title, badge, minPoints: min,
      nextLevelPoints: max === null ? null : max + 1,
      progressPct: max === null ? 100 : 0,
    });
    if (min > 0) expect(calculateLevel(min - 1).level).toBe(level - 1);
    if (max !== null) expect(calculateLevel(max).level).toBe(level);
  });

  it('keeps the launch handling of negative, fractional and above-maximum XP', () => {
    expect(calculateLevel(-1)).toEqual(calculateLevel(0));
    expect(calculateLevel(99.9)).toEqual(calculateLevel(99));
    expect(calculateLevel(100.9)).toEqual(calculateLevel(100));
    expect(calculateLevel(100000)).toEqual(calculateLevel(20000));
  });

  it.each(LEVEL_TIERS)('level $level promises presentation alone', (tier) => {
    // Only visual identity may be offered by a level. Permissions, essential
    // features and funded benefits follow their own authorization processes.
    expect(tier.perks).toEqual(['Repère personnel de progression', 'Titre de voyage descriptif']);
    expect(tier.description).not.toMatch(
      /maîtris|autonom|altitude|extrême|kilomètre|ambassadeur|modér|mentor|officiel|certifié|vérifié|diplôme|référence|bons? partenaires|trophée|illimité|accès|débloqu|1\s?km/i,
    );
  });
});
