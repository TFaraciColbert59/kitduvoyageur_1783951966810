// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RerouteBanner } from '../RerouteBanner';
import { JoinStartCard } from '../JoinStartCard';
import { EXTERNAL_LINKS, makeDeparture, makeReroute } from './fixtures';

afterEach(cleanup);

describe('RerouteBanner (K4.05)', () => {
  it('ne rend rien quand on est sur le tracé', () => {
    const { container } = render(<RerouteBanner state={makeReroute()} />);
    expect(container.firstChild).toBeNull();
  });

  it('annonce le recalcul en cours avec un état accessible', () => {
    render(
      <RerouteBanner
        state={makeReroute({
          status: 'recalculating_online',
          deviationDistanceM: 45,
          returnBearingDeg: 120,
        })}
      />,
    );

    expect(screen.getByText(/Hors itinéraire \(45 m\) · Recalcul en cours…/)).toBeTruthy();
    expect(screen.getByText(/Recherche d’un itinéraire de retour/)).toBeTruthy();
    expect(screen.getByText('Recalcul')).toBeTruthy();
  });

  it('indique le retour hors ligne sans inventer de détour', () => {
    render(
      <RerouteBanner
        state={makeReroute({
          status: 'offline_return_only',
          deviationDistanceM: 45,
          returnBearingDeg: 120,
          failureReason: 'offline',
        })}
      />,
    );

    expect(screen.getByText(/Hors itinéraire · 45 m · cap sud-est \(hors ligne\)/)).toBeTruthy();
    expect(screen.getByText(/Aucun réseau/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();
  });

  it('propose une nouvelle tentative quand le fournisseur a échoué', () => {
    const onRetry = vi.fn();
    render(
      <RerouteBanner
        state={makeReroute({
          status: 'reroute_failed',
          deviationDistanceM: 60,
          failureReason: 'provider_unavailable',
        })}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText(/Motif : service indisponible/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('confirme le retour sur le tracé recalculé', () => {
    render(<RerouteBanner state={makeReroute({ status: 'recalculated' })} />);
    expect(screen.getByText('Itinéraire recalculé · retour au tracé')).toBeTruthy();
  });
});

describe('JoinStartCard (K4.03 / S3.12)', () => {
  it('résume la distance au départ et propose les actions du moteur', () => {
    const onAction = vi.fn();
    render(
      <JoinStartCard
        evaluation={makeDeparture()}
        externalLinks={EXTERNAL_LINKS}
        onAction={onAction}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Rejoindre le départ' })).toBeTruthy();
    expect(screen.getByText(/2\.40 km · cap nord-est/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Rejoindre le départ' }));
    expect(onAction).toHaveBeenCalledWith('guide_to_start');

    fireEvent.click(screen.getByRole('button', { name: 'Rejoindre le tracé' }));
    expect(onAction).toHaveBeenCalledWith('guide_to_nearest_point');
  });

  it('rend les liens profonds Apple, Google, Waze et geo', () => {
    render(<JoinStartCard evaluation={makeDeparture()} externalLinks={EXTERNAL_LINKS} />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(4);
    expect(links[0].getAttribute('href')).toContain('maps.apple.com');
    expect(links[1].getAttribute('href')).toContain('google.com/maps');
    expect(links[2].getAttribute('href')).toContain('waze.com');
    expect(links[3].getAttribute('href')).toContain('geo:45.1,6.1');
    expect(links[0].getAttribute('rel')).toContain('noopener');
  });

  it('met en avant le démarrage quand on est au départ', () => {
    const onAction = vi.fn();
    render(
      <JoinStartCard
        evaluation={makeDeparture({
          kind: 'at_start',
          distanceToStartM: 8,
          availableActions: ['start_at_origin'],
          recommendedAction: 'start_at_origin',
        })}
        onAction={onAction}
      />,
    );

    expect(screen.getByText('Vous êtes au départ')).toBeTruthy();
    expect(screen.getByText('Au départ')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer depuis le départ' }));
    expect(onAction).toHaveBeenCalledWith('start_at_origin');
  });

  it('laisse l’itinéraire routier disponible sans GPS', () => {
    const onAction = vi.fn();
    render(
      <JoinStartCard
        evaluation={makeDeparture({
          kind: 'location_unavailable',
          distanceToStartM: null,
          distanceToNearestRoutePointM: null,
          availableActions: ['open_external_road_nav'],
          recommendedAction: 'open_external_road_nav',
          unavailableReason: 'Position GPS actuelle indisponible.',
        })}
        onAction={onAction}
      />,
    );

    expect(screen.getByText('Position actuelle indisponible')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: "Ouvrir l’itinéraire routier" }));
    expect(onAction).toHaveBeenCalledWith('open_external_road_nav');
  });

  it('affiche la raison quand la géométrie manque', () => {
    render(
      <JoinStartCard
        evaluation={makeDeparture({
          kind: 'route_unavailable',
          startPosition: null,
          availableActions: [],
          recommendedAction: null,
          unavailableReason: 'Géométrie du parcours absente ou invalide.',
        })}
      />,
    );

    expect(screen.getByText('Parcours indisponible')).toBeTruthy();
    expect(screen.getByText('Géométrie du parcours absente ou invalide.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
