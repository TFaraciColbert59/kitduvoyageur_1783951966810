/**
 * Task 19 — Transparence : badges de provenance par champ et bandeau
 * « Préparation recalculée pour N — basée sur les profils ».
 *
 * Vérifie les libellés (Appris / Estimé / Moyenne), les tons (tokens), la
 * borne `maxFields`, le no-op sans données et l'absence de classes de couleur
 * interdites (tokens & glass uniquement).
 */
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MemberProfileBadges,
  PartyPreparationBanner,
} from '@/features/trips/components/MemberProfileBadges';

const FORBIDDEN_CLASS_FRAGMENTS = [
  'bg-blue-',
  'text-blue-',
  'bg-red-',
  'text-red-',
  'bg-green-',
  'text-green-',
  'bg-gray-',
  'text-gray-',
  'bg-purple-',
  'text-purple-',
];

describe('MemberProfileBadges (Task 19)', () => {
  it('rend les libellés Appris / Estimé / Moyenne avec leurs tons tokens', () => {
    const html = renderToStaticMarkup(
      React.createElement(MemberProfileBadges, {
        sources: {
          flatSpeedKmH: 'learned',
          ascentSpeedMPerHour: 'estimated',
          packWeightKg: 'average',
        },
      })
    );

    expect(html).toContain('data-member-badges');
    expect(html).toContain('Allure · Appris');
    expect(html).toContain('Montée · Estimé');
    expect(html).toContain('Portage · Moyenne');
    // Tons canoniques `Badge` (Lot 6) : learned → sage, estimated → info, average → stone.
    expect(html).toContain('bg-[color:var(--lkv-success-bg)]');
    expect(html).toContain('bg-[color:var(--lkv-info-bg)]');
    expect(html).toContain('bg-[color:var(--lkv-surface-muted)]');
  });

  it('accepte un profil membre complet et borne maxFields', () => {
    const html = renderToStaticMarkup(
      React.createElement(MemberProfileBadges, {
        profile: {
          trip_id: 'trip-1',
          user_id: 'user-1',
          consented_at: null,
          flat_speed_kmh: 4,
          ascent_speed_m_per_h: 300,
          descent_speed_m_per_h: 500,
          pack_weight_kg: 12.6,
          max_carry_kg: 14,
          experience_level: 'intermediate',
          limitations: null,
          is_child: false,
          sources: {
            flatSpeedKmH: 'learned',
            ascentSpeedMPerHour: 'learned',
            descentSpeedMPerHour: 'learned',
            packWeightKg: 'average',
          },
          calibration_level: 'contextualization',
          sample_count: 22,
          party_version: 1,
          created_at: '2026-09-13T00:00:00.000Z',
          updated_at: '2026-09-13T00:00:00.000Z',
        },
        maxFields: 2,
      })
    );

    expect((html.match(/<li>/g) ?? []).length).toBe(2);
    expect(html).toContain('Allure · Appris');
  });

  it('ne rend rien sans sources, et aucune classe de couleur interdite', () => {
    const empty = renderToStaticMarkup(React.createElement(MemberProfileBadges, {}));
    expect(empty).toBe('');

    const html = renderToStaticMarkup(
      React.createElement(MemberProfileBadges, {
        sources: { flatSpeedKmH: 'learned', isChild: 'estimated' },
      })
    );
    for (const fragment of FORBIDDEN_CLASS_FRAGMENTS) {
      expect(html).not.toContain(fragment);
    }
  });
});

describe('PartyPreparationBanner (Task 19)', () => {
  it('affiche le bandeau quand party_size > 1', () => {
    const html = renderToStaticMarkup(
      React.createElement(PartyPreparationBanner, { partySize: 3 })
    );
    expect(html).toContain('data-party-banner');
    expect(html).toContain('Préparation recalculée pour 3 — basée sur les profils.');
    // Surface canonique `Card` compact (plus de classe `glass` legacy).
    expect(html).toContain('data-variant="compact"');
  });

  it('reste discret (no-op) pour un solo ou une valeur absente', () => {
    expect(
      renderToStaticMarkup(React.createElement(PartyPreparationBanner, { partySize: 1 }))
    ).toBe('');
    expect(
      renderToStaticMarkup(React.createElement(PartyPreparationBanner, { partySize: null }))
    ).toBe('');
    expect(renderToStaticMarkup(React.createElement(PartyPreparationBanner, {}))).toBe('');
  });
});

describe('Intégration badges (Task 19)', () => {
  it('équipe desktop, équipe mobile et itinéraires consomment le composant', () => {
    const files = [
      'src/features/trips/components/TripTeamView.tsx',
      'src/features/hub/components/mobile/team/TeamMobileExperience.tsx',
      'src/features/trips/planner/ItineraryPlannerClient.tsx',
      'src/features/hub/components/mobile/itinerary/ItineraryMobileExperience.tsx',
    ];
    for (const file of files) {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      expect(source, file).toContain('MemberProfileBadges');
    }
  });
});
