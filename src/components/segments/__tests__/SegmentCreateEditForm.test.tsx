// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SegmentCreateEditForm } from '../SegmentCreateEditForm';
import { buildActivity, buildSegment, buildTrack } from './fixtures';

afterEach(cleanup);

describe('SegmentCreateEditForm', () => {
  it('crée un segment à partir d’une trace et transmet la soumission', () => {
    const onSubmit = vi.fn();
    render(
      <SegmentCreateEditForm
        mode="create"
        viewerUserId="user-1"
        activity={buildActivity()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText('Nom du segment'), {
      target: { value: 'Montée du Belvédère' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Créer le segment' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [segment, submission] = onSubmit.mock.calls[0];
    expect(segment.name).toBe('Montée du Belvédère');
    expect(segment.lengthM).toBeGreaterThan(120);
    expect(submission.activity.activityId).toBe('act-1');
    expect(submission.startPointIndex).toBe(0);
    expect(submission.endPointIndex).toBe(11);
  });

  it('refuse un segment trop court et affiche la raison du contrat', () => {
    const onSubmit = vi.fn();
    const activity = buildActivity({
      points: buildTrack({ steps: 4, stepLatDeg: 0.00005 }),
    });
    render(
      <SegmentCreateEditForm
        mode="create"
        viewerUserId="user-1"
        activity={activity}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText('Nom du segment'), {
      target: { value: 'Trop court' },
    });

    expect(screen.getByText('Le segment est trop court (minimum 120 m).')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Créer le segment' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('bloque un segment public qui traverse une zone masquée (P01)', () => {
    const activity = buildActivity({
      hiddenZones: [{ center: { lat: 45.005, lng: 6 }, radiusM: 800 }],
    });
    render(
      <SegmentCreateEditForm
        mode="create"
        viewerUserId="user-1"
        activity={activity}
        onSubmit={() => {}}
      />
    );

    fireEvent.change(screen.getByLabelText('Nom du segment'), {
      target: { value: 'Zone privée' },
    });

    expect(
      screen.getByText('Le tracé traverse une zone masquée : choisissez « Privé » ou découpez autrement.')
    ).toBeTruthy();
  });

  it('modifie la visibilité et le nom d’un segment existant', () => {
    const onSubmit = vi.fn();
    render(
      <SegmentCreateEditForm
        mode="edit"
        viewerUserId="user-1"
        segment={buildSegment()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText('Nom du segment'), {
      target: { value: 'Montée rénovée' },
    });
    fireEvent.click(screen.getByLabelText('Privé — visible par vous seul'));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [segment, submission] = onSubmit.mock.calls[0];
    expect(segment.name).toBe('Montée rénovée');
    expect(segment.visibility).toBe('private');
    expect(submission.boundsChanged).toBe(false);
  });
});
