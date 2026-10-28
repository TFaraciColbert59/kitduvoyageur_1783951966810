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
});
