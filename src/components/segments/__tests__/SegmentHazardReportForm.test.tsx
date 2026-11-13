// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SegmentHazardReportForm } from '../SegmentHazardReportForm';
import { buildSegment } from './fixtures';

afterEach(cleanup);

describe('SegmentHazardReportForm', () => {
  it('signale un danger et transmet le résultat du contrat', () => {
    const onReport = vi.fn();
    render(
      <SegmentHazardReportForm
        segment={buildSegment()}
        existingReports={[
          {
            reportId: 'r0',
            segmentId: 'seg-1',
            reporterUserId: 'user-3',
            category: 'dangerous_road_or_traffic',
            description: 'Circulation dense.',
            createdAt: '2026-11-01T07:00:00.000Z',
            officialSource: false,
            status: 'active',
          },
        ]}
        viewerUserId="user-2"
        onReport={onReport}
      />
    );

    fireEvent.change(screen.getByLabelText('Nature du danger'), {
      target: { value: 'blind_intersection' },
    });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Intersection sans visibilité après le virage.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Signaler le danger' }));

    expect(onReport).toHaveBeenCalledTimes(1);
    const [result, input] = onReport.mock.calls[0];
    expect(result.accepted).toBe(true);
    expect(result.updatedSegment.hazardous).toBe(true);
    expect(input.category).toBe('blind_intersection');
    expect(input.description).toBe('Intersection sans visibilité après le virage.');
  });

  it('affiche le bandeau de suspension quand le danger est actif', () => {
    render(
      <SegmentHazardReportForm
        segment={buildSegment({ hazardous: true, hazardCategory: 'steep_technical_descent' })}
        existingReports={[]}
        viewerUserId="user-2"
        onReport={() => {}}
      />
    );

    expect(screen.getByText('Danger actif')).toBeTruthy();
    expect(screen.getByText(/notifications de compétition sont coupées/)).toBeTruthy();
    expect(screen.getAllByText(/Descente technique périlleuse/).length).toBeGreaterThan(0);
  });

  it('refuse un second signalement du même utilisateur', () => {
    const onReport = vi.fn();
    render(
      <SegmentHazardReportForm
        segment={buildSegment()}
        existingReports={[
          {
            reportId: 'r1',
            segmentId: 'seg-1',
            reporterUserId: 'user-2',
            category: 'dangerous_road_or_traffic',
            description: 'Voiture très proche.',
            createdAt: '2026-11-01T08:00:00.000Z',
            officialSource: false,
            status: 'active',
          },
        ]}
        viewerUserId="user-2"
        onReport={onReport}
      />
    );

    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Encore un danger.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Signaler le danger' }));

    expect(onReport).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Vous avez déjà signalé ce segment.');
  });

  it('affiche les signalements actifs existants', () => {
    render(
      <SegmentHazardReportForm
        segment={buildSegment()}
        existingReports={[
          {
            reportId: 'r1',
            segmentId: 'seg-1',
            reporterUserId: 'user-3',
            category: 'private_property',
            description: 'Passage privé signalé par le propriétaire.',
            createdAt: '2026-11-01T08:00:00.000Z',
            officialSource: false,
            status: 'active',
          },
        ]}
        viewerUserId="user-2"
        onReport={() => {}}
      />
    );

    expect(screen.getAllByText('Propriété privée').length).toBeGreaterThan(0);
    expect(screen.getByText('Passage privé signalé par le propriétaire.')).toBeTruthy();
  });
});
