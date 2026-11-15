// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  RechercheHistorique,
  criteriaToQuery,
  removeCriterionFromQuery,
} from '../RechercheHistorique';
import { makeRecord } from './fixtures';
import type { LifecycleListResponse } from '../api';

afterEach(cleanup);

function resultWith(items = [makeRecord()]): LifecycleListResponse {
  return { items, totalMatched: items.length, expiredDeletedCount: 0, requestSeq: 3 };
}

describe('A02 — recherche dans l’historique', () => {
  it('comprend la requête libre et affiche des pastilles corrigeables', () => {
    render(
      <RechercheHistorique
        query="rando vercors"
        onQueryChange={vi.fn()}
        result={resultWith()}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText('Randonnée')).toBeTruthy();
    expect(screen.getByText('vercors')).toBeTruthy();
    expect(screen.getByText('1 séance trouvée')).toBeTruthy();
  });

  it('retire un critère sans perdre les autres termes', () => {
    const onQueryChange = vi.fn();
    render(
      <RechercheHistorique
        query="rando vercors"
        onQueryChange={onQueryChange}
        result={resultWith()}
        onSelect={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le critère Randonnée' }));
    expect(onQueryChange).toHaveBeenCalledWith('vercors');
  });

  it('réécrit une requête dédupliquée', () => {
    expect(
      criteriaToQuery({
        rawQuery: '',
        sports: ['rando'],
        tags: [],
        dateRange: { fromIso: null, toIso: null, label: null },
        placeTerms: ['vercors'],
        provenanceOrigins: [],
        textTerms: ['vercors'],
      })
    ).toBe('rando vercors');
    expect(removeCriterionFromQuery('rando vercors', { kind: 'sport', value: 'rando' })).toBe(
      'vercors'
    );
  });

  it('ouvre la fiche d’une séance depuis la liste', () => {
    const record = makeRecord();
    const onSelect = vi.fn();
    render(
      <RechercheHistorique
        query=""
        onQueryChange={vi.fn()}
        result={resultWith([record])}
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByTestId(`life-row-${record.id}`));
    expect(onSelect).toHaveBeenCalledWith(record);
  });

  it('affiche l’état vide et l’erreur avec réessai', () => {
    const onRetry = vi.fn();
    render(
      <RechercheHistorique
        query="kayak"
        onQueryChange={vi.fn()}
        result={resultWith([])}
        error="Réseau indisponible."
        onRetry={onRetry}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText('Réseau indisponible.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('ouvre la corbeille avec son compteur', () => {
    const onOpenTrash = vi.fn();
    render(
      <RechercheHistorique
        query=""
        onQueryChange={vi.fn()}
        result={resultWith()}
        onSelect={vi.fn()}
        onOpenTrash={onOpenTrash}
        trashCount={2}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Corbeille/ }));
    expect(onOpenTrash).toHaveBeenCalledTimes(1);
    expect(screen.getByText('2')).toBeTruthy();
  });
});
