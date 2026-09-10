import { describe, it, expect } from 'vitest';
import { buildRecommendations } from '@/features/pays/recommendations/recommendationEngine';
import type { RecommendationInputs } from '@/features/pays/recommendations/recommendationEngine';

const inputs: RecommendationInputs = {
  countryName: 'Islande',
  seasonLabel: 'Juin à septembre',
  spots: [{ nom: 'Vatnajökull', localisation: 'Sud-Est', type_outdoor: 'Glacier', description: 'Glace.' }],
  itineraires: [
    { nom: 'Laugavegur', duree_jours: 4, difficulte: 'Difficile', description: 'Trek.', etapes: [] },
    { nom: 'Balade côtière', duree_jours: 1, difficulte: 'Facile', description: 'Promenade.', etapes: [] },
  ],
  difficulte: [],
  trails: [
    { id: 't1', name: 'Trail expert', distanceKm: 18, durationHours: null, difficulty: 'Difficile', elevationGain: null, latitude: null, longitude: null },
    { id: 't2', name: 'Sentier facile', distanceKm: 3, durationHours: null, difficulty: 'Facile', elevationGain: null, latitude: null, longitude: null },
  ],
};

describe('Moteur de recommandations contextuelles', () => {
  it('profil expert + expédition → itinéraires/sentiers difficiles, pas les faciles', () => {
    const res = buildRecommendations(inputs, { level: 'expert', duration: 'expedition', month: 7 });
    const titles = res.map((r) => r.title);
    expect(titles).toContain('Laugavegur');
    expect(titles).toContain('Trail expert');
    expect(titles).not.toContain('Balade côtière');
    expect(titles).not.toContain('Sentier facile');
  });

  it('profil facile + week-end → sortie facile uniquement', () => {
    const res = buildRecommendations(inputs, { level: 'facile', duration: 'weekend', month: 7 });
    const titles = res.map((r) => r.title);
    expect(titles).toContain('Balade côtière');
    expect(titles).not.toContain('Laugavegur');
  });

  it('toujours borné, justifié, et la saison réelle est citée', () => {
    const res = buildRecommendations(inputs, { level: 'modere', duration: 'semaine', month: 9 });
    expect(res.length).toBeGreaterThan(0);
    expect(res.length).toBeLessThanOrEqual(6);
    expect(res.every((r) => r.title.length > 0 && r.reason.length > 0)).toBe(true);
    expect(res.some((r) => r.kind === 'season' && r.title.includes('Juin à septembre'))).toBe(true);
  });

  it('aucune donnée → aucune recommandation (pas d’invention)', () => {
    const res = buildRecommendations(
      { countryName: 'X', seasonLabel: null, spots: [], itineraires: [], difficulte: [], trails: [] },
      { level: 'modere', duration: 'semaine', month: 5 }
    );
    expect(res).toHaveLength(0);
  });
});
