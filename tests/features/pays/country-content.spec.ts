import { describe, it, expect } from 'vitest';
import type { CountryContent } from '@/lib/supabase/types';
import { buildEditorialSectionBlocks } from '@/features/pays/mappers/countryContentToSection';

function makeContent(overrides: Partial<CountryContent> = {}): CountryContent {
  return {
    country_iso_a2: 'IS',
    slug: 'islande',
    status: 'published',
    pratique_voyage: {},
    climat: {},
    budget: {},
    transport: {},
    culture: {},
    outdoor: {},
    connectivite: {},
    editorial: {},
    data_source: 'test',
    ...overrides,
  } as CountryContent;
}

describe('Repli éditorial Supabase (countries_content)', () => {
  it('aucune donnée → aucun bloc', () => {
    expect(buildEditorialSectionBlocks('presentation', null)).toHaveLength(0);
    expect(buildEditorialSectionBlocks('destinations', makeContent())).toHaveLength(0);
  });

  it('Présentation : construit un bloc vue d’ensemble réel', () => {
    const blocks = buildEditorialSectionBlocks(
      'presentation',
      makeContent({ climat: { climat_general: 'Océanique froid.' }, transport: { aeroport_principal: 'Keflavík', code_iata: 'KEF' } })
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('vue_ensemble');
    expect(blocks[0].source).toBe('editorial');
    expect(blocks[0].contentMd).toContain('Océanique froid');
    expect(blocks[0].contentMd).toContain('Keflavík (KEF)');
  });

  it('Destinations : parcs + faune', () => {
    const blocks = buildEditorialSectionBlocks(
      'destinations',
      makeContent({ outdoor: { parcs_nationaux: 'Þingvellir, Vatnajökull' } })
    );
    expect(blocks[0].label).toContain('Sites');
    expect(blocks[0].contentMd).toContain('Þingvellir');
  });

  it('Activités : treks + préparation', () => {
    const blocks = buildEditorialSectionBlocks(
      'activites',
      makeContent({
        outdoor: { treks_phares: 'Laugavegur', equipement_specifique_recommande: 'Chaussures tige haute' },
      })
    );
    expect(blocks.map((block) => block.label)).toEqual(['Treks & itinéraires', 'Préparation & équipement']);
    expect(blocks[0].contentMd).toContain('Laugavegur');
    expect(blocks[1].contentMd).toContain('tige haute');
  });

  it('Culture : usages + fêtes + gastronomie', () => {
    const blocks = buildEditorialSectionBlocks(
      'culture',
      makeContent({
        culture: { coutumes_etiquette: 'On se déchausse.', jours_feries_majeurs: '17 juin' },
        editorial: { plats_emblematiques: 'Skyr, agneau' },
      })
    );
    expect(blocks.map((block) => block.label)).toEqual([
      'Usages & savoir-vivre',
      'Fêtes & jours fériés',
      'Gastronomie locale',
    ]);
    expect(blocks[0].contentMd).toContain('déchausse');
    expect(blocks[2].contentMd).toContain('Skyr');
  });
});
