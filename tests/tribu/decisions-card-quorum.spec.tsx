/**
 * Phase 4 TRIBU — affichage de la resolution des sondages a quorum.
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => {
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.in = () => builder;
      builder.then = (resolve: (value: unknown) => unknown) => resolve({ data: [] });
      return builder;
    },
  }),
}));

import DecisionsCard from '@/components/groupes/DecisionsCard';

const baseDecision = {
  id: 'p1',
  author: 'Organisateur',
  tag: 'Admin',
  meta: 'Vote actif — 1 vote(s)',
  question: 'Date du départ ?',
  footer: '1 votes exprimés',
  options: [
    { id: 'o0', index: 0, label: '1er octobre', votes: 1, percentage: 100, details: '1 votes', selected: false },
    { id: 'o1', index: 1, label: '8 octobre', votes: 0, percentage: 0, details: '0 votes', selected: false },
  ],
};

describe('DecisionsCard — quorum', () => {
  it('affiche le quorum non atteint et le seuil requis', () => {
    const html = renderToStaticMarkup(
      React.createElement(DecisionsCard, {
        decisions: [
          {
            ...baseDecision,
            pollType: 'quorum_majority',
            resolution: { adopted: false, reason: 'quorum_missing', winnerIndex: 0, requiredVotes: 3 },
          },
        ],
        groupId: 'g1',
        user: { id: 'u1' },
      })
    );
    expect(html).toContain('Quorum non atteint');
    expect(html).toContain('3 voix requises');
  });

  it('affiche la decision adoptee', () => {
    const html = renderToStaticMarkup(
      React.createElement(DecisionsCard, {
        decisions: [
          {
            ...baseDecision,
            pollType: 'quorum_majority',
            resolution: { adopted: true, reason: 'quorum_reached', winnerIndex: 0, requiredVotes: 1 },
          },
        ],
        groupId: 'g1',
        user: { id: 'u1' },
      })
    );
    expect(html).toContain('Décision adoptée');
  });
});
