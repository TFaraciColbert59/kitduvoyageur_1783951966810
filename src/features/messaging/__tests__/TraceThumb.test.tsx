// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { TraceThumb } from '../components/TraceThumb';
import { TrailCard } from '../components/TrailCard';
import { REAL_CATALOG_TRAILS } from '../data/realTrailsData';

afterEach(cleanup);

const A: [number, number][] = [[6.0, 45.0], [6.02, 45.0], [6.04, 45.01]];
const B: [number, number][] = [[6.6, 45.0], [6.62, 45.0], [6.64, 45.01]];

describe('TraceThumb', () => {
  it('dessine une polyline par segment (liseré + trait) : pas de droite entre deux segments', () => {
    const { container } = render(<TraceThumb geojson={{ type: 'MultiLineString', coordinates: [A, B] }} />);
    expect(container.querySelectorAll('polyline')).toHaveLength(4);
  });

  it('un seul segment : deux polylines (liseré + trait)', () => {
    const { container } = render(<TraceThumb geojson={{ type: 'LineString', coordinates: A }} />);
    expect(container.querySelectorAll('polyline')).toHaveLength(2);
  });

  it('état vide honnête, sans tracé de remplacement', () => {
    const { container } = render(<TraceThumb geojson={null} />);
    expect(container.querySelector('polyline')).toBeNull();
    expect(screen.getByText('Tracé indisponible pour cette randonnée')).toBeTruthy();
  });

  it('affiche la mention « Indicatif » quand on la demande', () => {
    render(<TraceThumb geojson={{ type: 'LineString', coordinates: A }} badge="Indicatif" />);
    expect(screen.getByText('Indicatif')).toBeTruthy();
  });
});

describe('TrailCard : mention « Indicatif »', () => {
  const catalog = REAL_CATALOG_TRAILS[1];

  it('pour un identifiant du catalogue codé en dur (ancien message sans tracé joint)', () => {
    render(<TrailCard isMine={false} meta={{ kind: 'trail', id: catalog.id, name: catalog.name }} />);
    expect(screen.getByText('Indicatif')).toBeTruthy();
  });

  it('quand le message porte indicative: true', () => {
    render(
      <TrailCard
        isMine
        meta={{ kind: 'trail', id: 'x', name: 'Sortie', indicative: true, geojson: { type: 'LineString', coordinates: [[6, 45], [6.1, 45.1]] } }}
      />,
    );
    expect(screen.getByText('Indicatif')).toBeTruthy();
  });

  it('pas de mention pour une randonnée réelle, et pas de vignette sans tracé', () => {
    const { container } = render(<TrailCard isMine={false} meta={{ kind: 'trail', id: '1790027540899', name: 'Sentier des Gardes' }} />);
    expect(screen.queryByText('Indicatif')).toBeNull();
    expect(container.querySelector('svg')).toBeNull();
  });
});
