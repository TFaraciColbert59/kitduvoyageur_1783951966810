/**
 * Phase 1 TRIBU — `ClubGroupsTab` : l'onglet « Groupes » du club.
 *
 *   (a) état vide pour un membre actif (CTA de création présent) ;
 *   (b) liste des groupes + navigation « Ouvrir dans le Hub » ;
 *   (c) non-membre → contenu réservé + aucun CTA.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import ClubGroupsTab from '@/components/clubs/ClubGroupsTab';

const CLUB = { id: 'club-1', name: 'Club Écrins' };
const MEMBER = { id: 'm1', user_id: 'u1', status: 'active', user: { full_name: 'Alex' } };

function render(ui: React.ReactElement) {
  return renderToStaticMarkup(ui);
}

describe('ClubGroupsTab', () => {
  it('(a) membre actif sans groupe : état vide + CTA de création', () => {
    const html = render(
      React.createElement(ClubGroupsTab, {
        club: CLUB,
        groups: [],
        members: [MEMBER],
        user: { id: 'me' },
        isMember: true,
        onCreate: async () => ({ ok: true }),
        onOpenGroup: () => {},
      })
    );

    expect(html).toContain('Groupes du club');
    expect(html).toContain('Aucun groupe de voyage pour le moment');
    expect(html).toContain('club-groups-create-cta');
  });

  it('(b) liste des groupes rendue avec navigation Hub', () => {
    const html = render(
      React.createElement(ClubGroupsTab, {
        club: CLUB,
        groups: [
          {
            id: 'g1',
            name: 'Traversée des Écrins',
            destination: 'Écrins',
            departure_date: '2026-07-01',
            return_date: '2026-07-06',
            visibility: 'club_only',
          },
        ],
        members: [MEMBER],
        user: { id: 'me' },
        isMember: true,
        onCreate: async () => ({ ok: true }),
        onOpenGroup: () => {},
      })
    );

    expect(html).toContain('Traversée des Écrins');
    expect(html).toContain('Ouvrir dans le Hub');
    expect(html).toContain('Écrins');
    expect(html).toContain('club-group-card');
  });

  it('(c) non-membre : contenu réservé, aucun CTA de création', () => {
    const html = render(
      React.createElement(ClubGroupsTab, {
        club: CLUB,
        groups: [],
        members: [MEMBER],
        user: null,
        isMember: false,
        onCreate: async () => ({ ok: true }),
        onOpenGroup: () => {},
      })
    );

    expect(html).toContain('Réservé aux membres du club');
    expect(html).not.toContain('club-groups-create-cta');
  });
});
