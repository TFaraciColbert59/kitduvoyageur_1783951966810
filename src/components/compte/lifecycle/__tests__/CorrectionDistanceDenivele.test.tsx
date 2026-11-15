// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CorrectionDistanceDenivele } from '../CorrectionDistanceDenivele';
import { makeRecord, makeSpikyPoints } from './fixtures';

afterEach(cleanup);

const noopRevert = vi.fn(async () => ({ ok: true as const }));

describe('A02 — correction distance, dénivelé et pics GPS', () => {
  it('prévisualise une distance manuelle et transmet la valeur en mètres', async () => {
    const record = makeRecord();
    const onCorrect = vi.fn(async (_arg: unknown) => ({ ok: true as const }));
    render(
      <CorrectionDistanceDenivele
        record={record}
        onCorrect={onCorrect}
        onSmoothGps={vi.fn()}
        onRevert={noopRevert}
      />
    );

    fireEvent.change(screen.getByLabelText('Méthode'), {
      target: { value: 'manual_override' },
    });
    fireEvent.change(screen.getByLabelText('Distance (km)'), { target: { value: '5' } });

    expect(screen.getByText('Après')).toBeTruthy();
    expect(screen.getByText(/5 km/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Appliquer la correction/ }));
    await waitFor(() => expect(onCorrect).toHaveBeenCalledTimes(1));
    expect(onCorrect.mock.calls[0][0]).toMatchObject({
      distanceMethod: 'manual_override',
      manualDistanceM: 5000,
      operationId: expect.any(String),
    });
  });

  it('avertit qu’une saisie manuelle retire la séance des classements', () => {
    const record = makeRecord();
    render(
      <CorrectionDistanceDenivele
        record={record}
        onCorrect={vi.fn()}
        onSmoothGps={vi.fn()}
        onRevert={noopRevert}
      />
    );
    fireEvent.change(screen.getByLabelText('Méthode'), {
      target: { value: 'manual_override' },
    });
    fireEvent.change(screen.getByLabelText('Distance (km)'), { target: { value: '5' } });
    expect(screen.getByText(/retire cette séance des classements/)).toBeTruthy();
  });

  it('liste les pics GPS détectés et applique le lissage', async () => {
    const record = makeRecord({ points: makeSpikyPoints() });
    const onSmoothGps = vi.fn(async () => ({ ok: true as const }));
    render(
      <CorrectionDistanceDenivele
        record={record}
        onCorrect={vi.fn()}
        onSmoothGps={onSmoothGps}
        onRevert={noopRevert}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pics GPS' }));
    expect(screen.getByText(/pic\(s\) identifié\(s\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Corriger les pics GPS/ }));
    await waitFor(() => expect(onSmoothGps).toHaveBeenCalledTimes(1));
  });

  it('n’affiche pas d’annulation sans correction préalable', () => {
    render(
      <CorrectionDistanceDenivele
        record={makeRecord()}
        onCorrect={vi.fn()}
        onSmoothGps={vi.fn()}
        onRevert={noopRevert}
      />
    );
    expect(screen.queryByRole('button', { name: /Annuler la dernière correction/ })).toBeNull();
    expect(screen.getByText(/Aucune correction à annuler/)).toBeTruthy();
  });

  it('propose l’annulation quand un instantané existe', async () => {
    const base = makeRecord();
    const withCorrection = makeRecord({
      correctionState: {
        distanceMethod: 'manual_override',
        elevationMethod: 'raw',
        appliedAt: new Date().toISOString(),
        previousSnapshot: {
          points: base.points,
          distanceM: base.stats.distanceM,
          elevationGainM: base.stats.elevationGainM,
          elevationLossM: base.stats.elevationLossM,
          minAltitudeM: base.stats.minAltitudeM,
          maxAltitudeM: base.stats.maxAltitudeM,
          distanceMethod: 'raw',
          elevationMethod: 'raw',
        },
      },
    });
    const onRevert = vi.fn(async () => ({ ok: true as const }));
    render(
      <CorrectionDistanceDenivele
        record={withCorrection}
        onCorrect={vi.fn()}
        onSmoothGps={vi.fn()}
        onRevert={onRevert}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Annuler la dernière correction/ }));
    await waitFor(() => expect(onRevert).toHaveBeenCalledTimes(1));
  });
});
