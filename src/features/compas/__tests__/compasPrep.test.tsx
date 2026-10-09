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

  it('pendant la préparation, dit à quoi sert la position et que la refuser ne bloque rien (plan 2.10)', () => {
    const { rerender } = render(
      <CompasPrep prep={{ stage: 'understand' }} onStop={noop} onClose={noop} onRetry={noop} onEditRequest={noop} />
    );
    expect(screen.getByText(/trajet d’approche ; elle est arrondie à environ 1 km/)).toBeTruthy();
    expect(screen.getByText(/Sans elle, le trajet reste à préciser/)).toBeTruthy();
    rerender(
      <CompasPrep prep={{ stage: 'done', total: 'Budget 210 €' }} onStop={noop} onClose={noop} onRetry={noop} onEditRequest={noop} />
    );
    expect(screen.queryByText(/arrondie à environ 1 km/)).toBeNull();
  });
});
