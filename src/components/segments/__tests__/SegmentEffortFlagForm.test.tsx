// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SegmentEffortFlagForm } from '../SegmentEffortFlagForm';
import { buildEffort, buildSegment } from './fixtures';

afterEach(cleanup);

describe('SegmentEffortFlagForm', () => {
  it('signale un effort d’un autre athlète', () => {
    const onFlag = vi.fn();
    render(
      <SegmentEffortFlagForm
        segment={buildSegment()}
        effort={buildEffort({ userId: 'user-2' })}
        viewerUserId="user-1"
        existingFlags={[]}
        onFlag={onFlag}
      />
    );

    expect(screen.getByText('Signaler un temps suspect')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Motif'), {
      target: { value: 'gps_glitch_or_shortcut' },
    });
    fireEvent.change(screen.getByLabelText('Commentaire'), {
      target: { value: 'Le tracé coupe à travers champs.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Signaler l’effort/ }));

    expect(onFlag).toHaveBeenCalledWith({
      category: 'gps_glitch_or_shortcut',
      comment: 'Le tracé coupe à travers champs.',
    });
  });

  it('permet au propriétaire de contester une exclusion', () => {
    const onContest = vi.fn();
    render(
      <SegmentEffortFlagForm
        segment={buildSegment()}
        effort={buildEffort({ status: 'excluded', exclusionReasons: ['speed_exceeded_for_sport'] })}
        viewerUserId="user-1"
        existingFlags={[]}
        onContest={onContest}
      />
    );

    expect(screen.getByText('Contester cet effort')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Votre contestation'), {
      target: { value: 'Descente rapide mais régulière, capteur GPS fiable.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Contester l’exclusion/ }));

    expect(onContest).toHaveBeenCalledWith({
      justification: 'Descente rapide mais régulière, capteur GPS fiable.',
    });
  });

  it('refuse une contestation géométriquement irréversible', () => {
    const onContest = vi.fn();
    render(
      <SegmentEffortFlagForm
        segment={buildSegment()}
        effort={buildEffort({ status: 'incomplete', exclusionReasons: ['incomplete_coverage'] })}
        viewerUserId="user-1"
        existingFlags={[]}
        onContest={onContest}
      />
    );

    fireEvent.change(screen.getByLabelText('Votre contestation'), {
      target: { value: 'Le passage était complet.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Contester l’exclusion/ }));

    expect(onContest).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('ne peut pas être contestée');
  });

  it('refuse de signaler son propre effort via le formulaire de signalement', () => {
    render(
      <SegmentEffortFlagForm
        segment={buildSegment()}
        effort={buildEffort()}
        viewerUserId="user-1"
        existingFlags={[]}
        onFlag={() => {}}
        onContest={() => {}}
      />
    );

    expect(screen.queryByRole('button', { name: /Signaler l’effort/ })).toBeNull();
  });
});
