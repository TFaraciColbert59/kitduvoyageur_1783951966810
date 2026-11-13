// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { compareSegmentEfforts } from '@/features/segments';
import { SegmentEffortComparison } from '../SegmentEffortComparison';
import { buildEffort, buildSegment } from './fixtures';

afterEach(cleanup);

describe('SegmentEffortComparison', () => {
  const segment = buildSegment();
  const candidate = buildEffort({
    effortId: 'eff-fast',
    uniquenessKey: 'fast',
    elapsedDurationS: 550,
    avgHeartRateBpm: null,
    avgPowerW: null,
  });
  const reference = buildEffort({
    effortId: 'eff-ref',
    uniquenessKey: 'ref',
    elapsedDurationS: 600,
    avgHeartRateBpm: null,
    avgPowerW: null,
  });
  const result = compareSegmentEfforts({
    segment,
    candidateEffort: candidate,
    referenceEffort: reference,
    stepsCount: 11,
  });

  it('affiche l’écart final, l’avance maximale et le graphique accessible', () => {
    render(<SegmentEffortComparison result={result} candidateLabel="Passage A" referenceLabel="Référence" />);

    expect(screen.getAllByText('−50 s').length).toBeGreaterThan(0);
    expect(screen.getByText('−50 s', { selector: '.lkdv-seg-compare-summary strong' })).toBeTruthy();
    expect(
      screen.getByRole('img', { name: 'Écart de temps cumulé le long du segment' })
    ).toBeTruthy();
    expect(screen.getByRole('table', { name: /Écart de temps/ })).toBeTruthy();
  });

  it('n’invente aucun capteur absent : les colonnes FC et puissance restent vides', () => {
    render(<SegmentEffortComparison result={result} />);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
    expect(screen.queryByText(/ bpm/)).toBeNull();
  });

  it('affiche les jalons de distance', () => {
    render(<SegmentEffortComparison result={result} />);
    expect(screen.getByText('0 m')).toBeTruthy();
    expect(screen.getByText('1,2 km')).toBeTruthy();
  });
});
