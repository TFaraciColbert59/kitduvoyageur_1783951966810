// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FicheDetailPostSeance } from '../FicheDetailPostSeance';
import { makeRecord } from './fixtures';

afterEach(cleanup);

describe('A02 — fiche détaillée post-séance', () => {
  it('affiche les mesures réelles, les capteurs absents et la provenance', () => {
    const record = makeRecord({
      stats: {
        ...makeRecord().stats,
        avgSpeedKmh: 5.2,
        maxSpeedKmh: 6.1,
        spikeCount: 0,
      },
    });
    render(<FicheDetailPostSeance record={record} onClose={vi.fn()} onAction={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Traversée du Vercors')).toBeTruthy();
    expect(screen.getAllByText(/Randonnée/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Non mesuré').length).toBe(3);
    expect(screen.getByText('Séance éligible aux records automatiques.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Découpe kilométrique' })).toBeTruthy();
  });

  it('signale une géométrie recadrée et propose de restaurer la trace d’origine', () => {
    const base = makeRecord();
    const record = makeRecord({
      points: base.points.slice(1),
      originalPoints: base.points,
    });
    const onRestoreGeometry = vi.fn();
    render(
      <FicheDetailPostSeance
        record={record}
        onClose={vi.fn()}
        onAction={vi.fn()}
        onRestoreGeometry={onRestoreGeometry}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Restaurer la trace d’origine/ }));
    expect(onRestoreGeometry).toHaveBeenCalledTimes(1);
  });

  it('ouvre les actions du lot et ferme la fiche', () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    render(<FicheDetailPostSeance record={makeRecord()} onClose={onClose} onAction={onAction} />);

    fireEvent.click(screen.getByRole('button', { name: /Recadrer/ }));
    expect(onAction).toHaveBeenCalledWith('crop_split');

    fireEvent.click(screen.getByRole('button', { name: /Corriger/ }));
    expect(onAction).toHaveBeenCalledWith('correct_distance_elevation');

    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));
    expect(onAction).toHaveBeenCalledWith('delete_restore');

    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('n’affiche pas de bouton d’annulation sans correction enregistrée', () => {
    const record = makeRecord();
    render(<FicheDetailPostSeance record={record} onClose={vi.fn()} onAction={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Annuler la correction/ })).toBeNull();
  });
});
