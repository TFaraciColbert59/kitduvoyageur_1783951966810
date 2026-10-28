// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { detail } from './fixtures';

/** MapLibre n'a pas sa place dans jsdom : on capture les props reçues. */
const MAP_PROPS = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock('next/dynamic', () => ({
  default: () => (props: Record<string, unknown>) => {
    MAP_PROPS.current = props;
    return <div data-testid="compte-map" />;
  },
}));

import { CarnetMapCard } from '../CarnetMapCard';

afterEach(() => {
  cleanup();
  MAP_PROPS.current = null;
});

const TRACE = {
  type: 'LineString',
  coordinates: [
    [6.86, 45.83],
    [6.87, 45.84],
  ],
};

describe('CarnetMapCard — carte 3D du carnet', () => {
  it('branche la trace réelle du carnet sur la carte du Compte, en variante carnet', () => {
    render(<CarnetMapCard detail={detail({ trace: TRACE })} />);
    expect(screen.getByTestId('compte-map')).toBeTruthy();
    expect(MAP_PROPS.current?.variant).toBe('carnet');
    expect(MAP_PROPS.current?.trace).toBe(TRACE);
    expect(MAP_PROPS.current?.context).toEqual({ mode: 'overview' });
  });

  it('garde l’état vide honnête quand le carnet n’a réellement aucune trace', () => {
    render(<CarnetMapCard detail={detail({ trace: null })} />);
    expect(MAP_PROPS.current?.trace).toBeNull();
    expect(MAP_PROPS.current?.emptyTitle).toBe('—');
    expect(String(MAP_PROPS.current?.emptyHint)).toBe('');
  });

  it('donne l’état du propriétaire calculé côté serveur, jamais celui du client', () => {
    render(<CarnetMapCard detail={detail({ isOwner: true })} />);
    expect(MAP_PROPS.current?.authState).toBe('owner');
    cleanup();
    render(<CarnetMapCard detail={detail({ isOwner: false })} />);
    expect(MAP_PROPS.current?.authState).toBe('guest');
  });

  it('transmet la cible de recentrage de la ligne de lieu', () => {
    const focus = { lat: 45.83, lng: 6.86, zoom: 10 };
    render(<CarnetMapCard detail={detail({ trace: TRACE })} focus={focus} />);
    expect(MAP_PROPS.current?.focus).toEqual(focus);
  });

  it('peint le tracé complet du carnet sur le Résumé (`dayPoints: null`)', () => {
    render(<CarnetMapCard detail={detail({ trace: TRACE })} focusKey="resume" dayPoints={null} />);
    expect(MAP_PROPS.current?.trace).toBe(TRACE);
    expect(MAP_PROPS.current?.traceFlight).toMatchObject({ key: 'resume' });
  });

  it('ne peint que le segment du jour quand la page est un jour', () => {
    const dayPoints = [
      { lat: 45.9, lng: 6.86 },
      { lat: 45.93, lng: 6.9 },
    ];
    render(<CarnetMapCard detail={detail({ trace: TRACE })} focusKey="j1" dayPoints={dayPoints} />);
    expect(MAP_PROPS.current?.trace).toEqual({
      type: 'LineString',
      coordinates: [
        [6.86, 45.9],
        [6.9, 45.93],
      ],
    });
    /* Vol : 900 ms, `cubic-bezier(.22,1,.36,1)`, pitch 45. */
    const flight = MAP_PROPS.current?.traceFlight as {
      key: string;
      duration: number;
      pitch: number;
      easing: (progress: number) => number;
    };
    expect(flight.key).toBe('j1');
    expect(flight.duration).toBe(900);
    expect(flight.pitch).toBe(45);
    expect(flight.easing(0)).toBe(0);
    expect(flight.easing(1)).toBe(1);
  });

  it('donne un tracé vide à un jour réellement sans point GPS, jamais celui du carnet', () => {
    render(<CarnetMapCard detail={detail({ trace: TRACE })} focusKey="j2" dayPoints={[]} />);
    expect(MAP_PROPS.current?.trace).toBeNull();
    expect(MAP_PROPS.current?.emptyTitle).toBe('—');
  });

  it('rejoue le vol quand la page change, sans changer la matière de la carte', () => {
    const dayPoints = [{ lat: 45.9, lng: 6.86 }, { lat: 45.93, lng: 6.9 }];
    const view = render(<CarnetMapCard detail={detail({ trace: TRACE })} focusKey="resume" dayPoints={null} />);
    const resumeFlight = MAP_PROPS.current?.traceFlight;
    view.rerender(<CarnetMapCard detail={detail({ trace: TRACE })} focusKey="j1" dayPoints={dayPoints} />);
    expect(MAP_PROPS.current?.traceFlight).not.toBe(resumeFlight);
    expect(MAP_PROPS.current?.variant).toBe('carnet');
    expect(MAP_PROPS.current?.emptyHint).toBe('');
  });
});
