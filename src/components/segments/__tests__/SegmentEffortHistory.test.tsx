// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SegmentEffortHistory } from '../SegmentEffortHistory';
import { buildEffort } from './fixtures';

afterEach(cleanup);

describe('SegmentEffortHistory', () => {
  const efforts = [
    buildEffort({
      effortId: 'eff-1',
      uniquenessKey: 'a',
      elapsedDurationS: 600,
      enteredAt: '2026-11-01T08:00:00.000Z',
    }),
    buildEffort({
      effortId: 'eff-2',
      uniquenessKey: 'b',
      elapsedDurationS: 550,
      enteredAt: '2026-11-02T08:00:00.000Z',
    }),
    buildEffort({
      effortId: 'eff-3',
      uniquenessKey: 'c',
      elapsedDurationS: 500,
      enteredAt: '2026-11-03T08:00:00.000Z',
      status: 'excluded',
      exclusionReasons: ['speed_exceeded_for_sport'],
    }),
  ];

  it('affiche le record, les rangs personnels et la progression', () => {
    render(
      <SegmentEffortHistory efforts={efforts} segmentId="seg-1" userId="user-1" />
    );

    expect(screen.getByText('Record personnel')).toBeTruthy();
    expect(screen.getAllByText('9:10').length).toBeGreaterThan(0);
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('PR #1')).toBeTruthy();
    expect(screen.getByText('PR #2')).toBeTruthy();
    expect(screen.getByText('Vitesse anormale')).toBeTruthy();
  });

  it('expose une action de comparaison pour les efforts valides', () => {
    const onCompare = vi.fn();
    render(
      <SegmentEffortHistory
        efforts={efforts}
        segmentId="seg-1"
        userId="user-1"
        onCompare={onCompare}
      />
    );

    const buttons = screen.getAllByRole('button', { name: 'Comparer' });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);
    expect(onCompare).toHaveBeenCalledWith(expect.objectContaining({ effortId: 'eff-2' }));
  });

  it('rend un état vide sans effort', () => {
    render(<SegmentEffortHistory efforts={[]} segmentId="seg-1" userId="user-1" />);
    expect(screen.getByText('Aucun effort')).toBeTruthy();
  });
});
