import { describe, it, expect } from 'vitest';
import {
  buildTrailAiPrompt,
  buildTrailAiFallback,
  type TrailAiInput,
} from '@/lib/ai/features/trailAiEnrichment';

describe('Adventure Intelligence — Trail AI Enrichment', () => {
  it('construit un prompt IA structuré avec les données topographiques et de terrain', () => {
    const input: TrailAiInput = {
      name: 'Tour du Mont Blanc',
      ref: 'TMB',
      network: 'iwn',
      distanceKm: 165,
      elevationGainM: 10000,
      elevationLossM: 10000,
      minElevationM: 1000,
      maxElevationM: 2665,
      difficulty: 'demanding_mountain_hiking',
      roundtrip: true,
      surface: 'ground',
      trailVisibility: 'good',
      dogFriendly: 'no',
      from: 'Les Houches',
      to: 'Les Houches',
      poiSummary: {
        waterCount: 12,
        refugeCount: 15,
        summitCount: 4,
        viewpointCount: 8,
      },
    };

    const { system, prompt } = buildTrailAiPrompt(input);

    expect(system).toContain('Adventure Intelligence');
    expect(prompt).toContain('Tour du Mont Blanc');
    expect(prompt).toContain('165.0 km');
    expect(prompt).toContain('+10000 m');
    expect(prompt).toContain('2665 m');
    expect(prompt).toContain('Boucle');
    expect(prompt).toContain('storyline');
    expect(prompt).toContain('idealSeason');
    expect(prompt).toContain('gearChecklist');
    expect(prompt).toContain('safetyTips');
    expect(prompt).toContain('effortPacing');
  });

  describe('Moteur déterministe Adventure Intelligence (Fallback)', () => {
    it('génère un profil haute montagne adapté (> 2200m) avec équipement et faune alpine', () => {
      const input: TrailAiInput = {
        name: 'Refuge du Goûter et Aiguille du Goûter',
        distanceKm: 9.5,
        elevationGainM: 1400,
        minElevationM: 2372,
        maxElevationM: 3835,
        difficulty: 'alpine_hiking',
        poiSummary: { waterCount: 0 },
      };

      const result = buildTrailAiFallback(input);

      expect(result.confidence).toBeGreaterThanOrEqual(90);
      expect(result.provenance).toBe('lkdv-adventure-intelligence');
      expect(result.storyline).toContain('haute montagne');
      expect(result.storyline).toContain('3835 m');
      
      // Saisonnalité alpine (Juillet/Août/Septembre)
      expect(result.idealSeason.bestMonths).toEqual(['Juillet', 'Août', 'Septembre']);
      expect(result.idealSeason.advice).toContain('névés');

      // Vigilance
      expect(result.safetyTips.some((tip) => tip.includes('technique') || tip.includes('raide'))).toBe(true);
      expect(result.safetyTips.some((tip) => tip.includes('eau potable'))).toBe(true);

      // Équipement alpin
      expect(result.gearChecklist.some((item) => item.includes('thermique'))).toBe(true);
      expect(result.gearChecklist.some((item) => item.includes('Bâtons'))).toBe(true);
      expect(result.gearChecklist.some((item) => item.includes('Protection solaire'))).toBe(true);

      // Faune alpine
      expect(result.biodiversity).toContain('Étage alpin');
      expect(result.biodiversity).toContain('bouquetins');

      // Rythme & Cadence
      expect(result.effortPacing.recommendedStartTime).toContain('07h00');
    });

    it('génère un profil de moyenne montagne (1200m - 2200m)', () => {
      const input: TrailAiInput = {
        name: 'Crêtes du Sancy',
        distanceKm: 14,
        elevationGainM: 750,
        minElevationM: 1050,
        maxElevationM: 1885,
        difficulty: 'mountain_hiking',
      };

      const result = buildTrailAiFallback(input);

      expect(result.storyline).toContain('traversée montagnarde');
      expect(result.idealSeason.bestMonths).toContain('Mai');
      expect(result.biodiversity).toContain('Étage montagnard');
      expect(result.biodiversity).toContain('mélèzes');
    });

    it('génère un profil de plaine / vallée accessible (< 1200m)', () => {
      const input: TrailAiInput = {
        name: 'Sentier côtier des Douaniers',
        distanceKm: 8,
        elevationGainM: 120,
        minElevationM: 5,
        maxElevationM: 80,
      };

      const result = buildTrailAiFallback(input);

      expect(result.storyline).toContain('randonnée nature');
      expect(result.idealSeason.bestMonths).toContain('Mars');
      expect(result.biodiversity).toContain('plaine');
    });
  });
});
