// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  LigneeDrawer,
  normalizeKitLineageSheet,
  sanitizeLineageJournalEntries,
} from '../drawers/LigneeDrawer';

describe('LigneeDrawer — D-12 à D-15', () => {
  afterEach(() => {
    cleanup();
  });

  it('D-12 & D-13 : n’invente aucune génération factice quand le kit n’est pas ramifié', () => {
    const sheet = normalizeKitLineageSheet('kit-root-1', {
      name: 'Mon sac Pyrénées',
      forked_from: null,
      generation: 0,
      field_proven_count: 0,
    });
    expect(sheet.generationDepth).toBeNull();

    render(
      React.createElement(LigneeDrawer, {
        kitId: 'kit-root-1',
        initialLineage: {
          name: 'Mon sac Pyrénées',
          forked_from: null,
          generation: 0,
        },
      })
    );

    const text = screen.getByTestId('studio-lignee-pane').textContent || '';
    expect(text).toContain('aucune ramification antérieure enregistrée');
    expect(text).not.toMatch(/\bG1\b|\bG2\b/);
  });

  it('D-14 : affiche le vocabulaire public exact (kit souche, lignée, éprouvé, part créateur)', () => {
    render(
      React.createElement(LigneeDrawer, {
        kitId: 'kit-souche-1',
        initialLineage: {
          name: 'Traversée du Vercors',
          is_souche: true,
          field_proven_count: 4,
          creatorShareEligible: true,
        },
      })
    );

    const text = (screen.getByTestId('studio-lignee-pane').textContent || '').toLowerCase();
    expect(text).toContain('kit souche');
    expect(text).toContain('éprouvé');
    expect(text).toContain('part créateur');
  });

  it('D-15 / SEC-09 : retire toute coordonnée GPS brute des entrées de carnet de lignée', () => {
    const cleaned = sanitizeLineageJournalEntries([
      {
        id: 'j-1',
        title: 'Bivouac Crête Est',
        date: '2026-07-12T08:00:00Z',
        region: 'Massif du Vercors',
        latitude: 44.987654,
        longitude: 5.432109,
        lat: 44.987654,
        lon: 5.432109,
        coords: [44.987654, 5.432109],
        note: 'Nuit sèche sous le vent.',
      },
      {
        id: 'j-2',
        title: 'Point brut masqué',
        region: '45.832611, 6.865122',
      },
    ]);

    const serialized = JSON.stringify(cleaned);
    expect(serialized).not.toContain('44.987654');
    expect(serialized).not.toContain('5.432109');
    expect(serialized).not.toContain('45.832611');
    expect(serialized).not.toContain('latitude');
    expect(serialized).not.toContain('longitude');
    expect(cleaned[0].regionLabel).toBe('Massif du Vercors');
    expect(cleaned[1].regionLabel).toBeNull();
  });
});
