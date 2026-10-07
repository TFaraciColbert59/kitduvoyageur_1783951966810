// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompasPrep } from '../components/CompasPrep';

const noop = vi.fn();

describe('panneau de préparation', () => {
  it('limite de fréquence : une attente annoncée, pas une interruption', () => {
    render(
      <CompasPrep
        prep={{ stage: 'itinerary', message: 'Beaucoup de préparations d’affilée : je reprends seul dans 3 min.' }}
        onStop={noop}
        onClose={noop}
        onRetry={noop}
        onEditRequest={noop}
      />
    );
    expect(screen.getByText('Je prépare ton aventure…')).toBeTruthy();
    expect(screen.getByText(/je reprends seul dans 3 min/)).toBeTruthy();
    expect(screen.queryByText('Préparation interrompue')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reprendre' })).toBeNull();
  });
});
