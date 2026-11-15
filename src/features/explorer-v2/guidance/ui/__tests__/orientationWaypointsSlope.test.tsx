// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createInitialOrientationState, markUserMapPan } from '@/features/navigation';
import { OrientationCompass } from '../OrientationCompass';
import { UpcomingWaypointsList } from '../UpcomingWaypointsList';
import { ClimbDescentCard, buildSlopeSparkline } from '../ClimbDescentCard';
import {
  makeClimbCard,
  makeSlopeSegment,
  makeUpcoming,
  makeWaypoint,
} from './fixtures';

afterEach(cleanup);

describe('OrientationCompass (K4.06)', () => {
  it('affiche le cap et le mode nord en haut', () => {
    render(
      <OrientationCompass
        orientation={createInitialOrientationState(true, 90)}
        headingDeg={90}
        onModeChange={vi.fn()}
        onRecenter={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/Boussole, cap 90 degrés, est, nord en haut/)).toBeTruthy();
    expect(screen.getByText('90°')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Nord en haut' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(
      screen.getByRole('radio', { name: 'Sens du déplacement' }).getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('bascule vers le sens du déplacement et recentre', () => {
    const onModeChange = vi.fn();
    const onRecenter = vi.fn();
    render(
      <OrientationCompass
        orientation={createInitialOrientationState(false, 128)}
        headingDeg={128}
        onModeChange={onModeChange}
        onRecenter={onRecenter}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Nord en haut' }));
    expect(onModeChange).toHaveBeenCalledWith('north-up');

    fireEvent.keyDown(screen.getByRole('radiogroup', { name: 'Orientation de la carte' }), {
      key: 'ArrowLeft',
    });
    expect(onModeChange).toHaveBeenCalledWith('north-up');

    fireEvent.click(screen.getByRole('button', { name: /Recentrer/ }));
    expect(onRecenter).toHaveBeenCalledTimes(1);
  });

  it('signale une carte déplacée manuellement', () => {
    render(
      <OrientationCompass
        orientation={markUserMapPan(createInitialOrientationState(true, 40), 120)}
        headingDeg={40}
      />,
    );

    expect(screen.getByText(/Carte déplacée manuellement/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Recentrer/ })).toHaveProperty('disabled', true);
  });
});

describe('UpcomingWaypointsList (K4.07)', () => {
  const items = [
    makeUpcoming(makeWaypoint('w1', 'Refuge de la Vanoise', 1200), 1200, 1800),
    makeUpcoming(makeWaypoint('w2', 'Lac Blanc', 400, { kind: 'water' }), 400, 300),
    makeUpcoming(
      makeWaypoint('w3', 'Col des Aiguilles', 80, { kind: 'summit' }),
      80,
      null,
    ),
  ];

  it('liste les repères dans l’ordre du moteur avec distance et ETA', () => {
    render(<UpcomingWaypointsList items={items} />);

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('Refuge de la Vanoise');
    expect(rows[0].textContent).toContain('1.20 km');
    expect(rows[0].textContent).toContain('≈ 30 min');
    expect(rows[1].textContent).toContain('Point d’eau');
    expect(rows[2].textContent).toContain('Sommet');
    expect(screen.getByText('3 repères')).toBeTruthy();
  });

  it('borne la liste à maxItems', () => {
    render(<UpcomingWaypointsList items={items} maxItems={2} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByText('Col des Aiguilles')).toBeNull();
  });

  it('rend chaque repère sélectionnable', () => {
    const onSelect = vi.fn();
    render(<UpcomingWaypointsList items={items} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /Refuge de la Vanoise/ }));
    expect(onSelect).toHaveBeenCalledWith(items[0]);
  });

  it('affiche un état vide explicite', () => {
    render(<UpcomingWaypointsList items={[]} />);
    expect(screen.getByText('Aucun repère à venir sur ce parcours.')).toBeTruthy();
  });
});

describe('ClimbDescentCard (K4.09)', () => {
  it('affiche la montée active, la pente et le D+ restant', () => {
    render(<ClimbDescentCard card={makeClimbCard()} />);

    expect(screen.getByText('Montée en cours')).toBeTruthy();
    expect(screen.getAllByText(/12,3/).length).toBeGreaterThan(0);
    expect(screen.getByText(/D\+ 74 m/)).toBeTruthy();
    expect(screen.getAllByText(/reste 360 m/).length).toBeGreaterThan(0);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('40');
  });

  it('annonce une descente à venir avec sa distance d’entrée', () => {
    const segment = makeSlopeSegment({
      kind: 'descent',
      gainM: 0,
      lossM: 74,
      averageGradePct: 9.2,
    });
    render(
      <ClimbDescentCard
        card={makeClimbCard({
          status: 'upcoming_descent',
          segment,
          distanceToStartM: 320,
          progressRatio: 0,
          remainingDistanceM: 600,
          remainingElevationDeltaM: 74,
          currentGradePct: 9.2,
        })}
      />,
    );

    expect(screen.getByText('Descente à venir')).toBeTruthy();
    expect(screen.getByText(/dans 320 m/)).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('se retire quand le profil est plat, sauf demande explicite', () => {
    const flat = makeClimbCard({ status: 'flat_or_none', segment: null });
    const { container, rerender } = render(<ClimbDescentCard card={flat} />);
    expect(container.firstChild).toBeNull();

    rerender(<ClimbDescentCard card={flat} showWhenInactive />);
    expect(screen.getByText('Profil plat')).toBeTruthy();
  });

  it('construit un profil sans combler les trous d’altitude', () => {
    const result = buildSlopeSparkline([
      { d: 0, ele: 1000 },
      { d: 50, ele: null },
      { d: 100, ele: 1080 },
    ]);

    expect(result).not.toBeNull();
    expect(result?.line.startsWith('M0.00,')).toBe(true);
    expect(buildSlopeSparkline([{ d: 0, ele: 1000 }])).toBeNull();
  });
});
