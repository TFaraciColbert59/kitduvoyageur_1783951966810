// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { OutingTrace } from '../OutingTrace';
import { traceUnavailableState } from '../shared';
import type { OutingDetail } from '@/features/compte/server/sorties';

afterEach(() => cleanup());

function detail(overrides: Partial<OutingDetail> = {}): OutingDetail {
  return {
    id: 's1',
    title: 'Crêtes',
    date: '2026-11-01',
    startedAt: '2026-11-01T08:00:00Z',
    endedAt: '2026-11-01T12:00:00Z',
    massif: null,
    routeName: null,
    km: 5,
    dplus: 600,
    maxAlt: 1800,
    durationS: 14400,
    status: 'done',
    visibility: 'private',
    verified: false,
    coverUrl: null,
    notes: '',
    weather: null,
    photos: [],
    participants: [],
    gear: [],
    kit: null,
    missingGear: 0,
    kudos: { count: 0, mine: false, users: [] },
    comments: [],
    points: [],
    traceSegments: [],
    traceMasked: false,
    traceFullyMasked: false,
    traceError: null,
    canEdit: false,
    ...overrides,
  };
}

describe('traceUnavailableState — états honnêtes', () => {
  it('distingue absence, masquage total et géométrie refusée', () => {
    expect(traceUnavailableState(detail()).title).toBe('Aucune trace GPS rattachée');
    expect(traceUnavailableState(detail({ traceFullyMasked: true })).title).toBe(
      'Trace non partageable',
    );
    expect(
      traceUnavailableState(detail({ traceError: 'unpublishable_geometry' })).title,
    ).toBe('Trace trop courte pour être partagée');
    expect(traceUnavailableState(detail({ traceError: 'unsafe_geometry' })).title).toBe(
      'Trace non disponible',
    );
  });

  it('ne dit jamais « aucune trace » pour une trace masquée', () => {
    render(
      <OutingTrace
        detail={detail({ traceMasked: true, traceFullyMasked: true })}
        onExport={() => {}}
      />,
    );
    expect(screen.getByText('Trace non partageable')).toBeTruthy();
    expect(screen.queryByText('Aucune trace GPS rattachée')).toBeNull();
  });
});
