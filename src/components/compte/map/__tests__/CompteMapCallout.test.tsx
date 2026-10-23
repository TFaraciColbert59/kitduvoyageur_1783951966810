// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CompteMapCallout } from '../CompteMapCallout';

describe('CompteMapCallout', () => {
  it('affiche une sortie réelle et son action', () => {
    const onOpen = vi.fn();
    render(
      <CompteMapCallout
        kind="outing"
        data={{
          id: 's1',
          title: 'Lac Blanc',
          startedAt: '2026-09-19T06:00:00Z',
          km: 12.4,
          dplus: 860,
          maxAlt: 2352,
          verified: true,
          photosCount: 3,
          participantsCount: 2,
        }}
        onClose={vi.fn()}
        onOpen={onOpen}
      />
    );
    expect(screen.getByText('Lac Blanc')).toBeTruthy();
    expect(screen.getByText(/12,4 km/)).toBeTruthy();
    expect(screen.getByText(/860 m/)).toBeTruthy();
    expect(screen.getByText('Trace GPS vérifiée')).toBeTruthy();
    screen.getByRole('button', { name: 'Voir la sortie' }).click();
    expect(onOpen).toHaveBeenCalledWith('s1');
  });

  it('affiche un massif réel sans inventer de nom', () => {
    render(
      <CompteMapCallout
        kind="massif"
        data={{ id: 'm1', name: 'Massif inconnu', outings: 1, verified: false }}
        onClose={vi.fn()}
        onOpen={vi.fn()}
      />
    );
    expect(screen.getByText('Massif inconnu')).toBeTruthy();
    expect(screen.queryByText('Massif du Mont-Blanc')).toBeNull();
  });
});
