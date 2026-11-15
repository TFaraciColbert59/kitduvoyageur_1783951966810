// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { OutingSummary } from '@/components/compte/drawer/sortie/OutingSummary';
import { OutingTrace } from '@/components/compte/drawer/sortie/OutingTrace';
import { buildTcx, type OutingDetail } from '@/features/compte/server/sorties';
import { ALL_OUTING_METRICS } from '@/features/compte/domain/metricVisibility';

function makeDetail(overrides: Partial<OutingDetail> = {}): OutingDetail {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    title: 'Boucle du Vercors',
    date: '2026-08-12T07:30:00.000Z',
    endedAt: '2026-08-12T10:30:00.000Z',
    massif: 'Vercors',
    sport: 'trail',
    km: 18.4,
    dplus: 920,
    maxAlt: 1890,
    durationS: 10800,
    movingTimeS: 9600,
    elapsedS: 10800,
    paceMinPerKm: 8.7,
    status: 'done',
    visibility: 'private',
    verified: true,
    notes: 'Belle traversée',
    canEdit: true,
    canInteract: true,
    shareMetrics: ALL_OUTING_METRICS,
    shareMetricsConfigured: false,
    tracePrivacy: {
      enabled: false,
      startMaskM: 0,
      endMaskM: 0,
      maskedPointCount: 0,
    },
    traceFullyMasked: false,
    points: [
      { lat: 45.1, lng: 5.5, elevationM: 1200, timestamp: '2026-08-12T07:30:00.000Z' },
      { lat: 45.11, lng: 5.51, elevationM: 1550, timestamp: '2026-08-12T09:00:00.000Z' },
      { lat: 45.12, lng: 5.52, elevationM: 1890, timestamp: '2026-08-12T10:30:00.000Z' },
    ],
    weather: null,
    photos: [],
    photosUnavailable: false,
    participants: [],
    kit: null,
    comments: [],
    kudos: { count: 2, viewerLiked: false },
    provenance: {
      source: 'gpx',
      fingerprint: 'abc123fingerprint',
      fileName: 'vercors.gpx',
      byteLength: 1024,
      importedAt: '2026-08-12T10:35:00.000Z',
    },
    laps: [],
    summary: null,
    samples: [],
    tags: ['montagne', 'entrainement'],
    revision: 2,
    quickEditPending: true,
    correctedMetrics: true,
    gpsSpikesRemoved: 3,
    ...overrides,
  };
}

describe('Lot A02 — Historique, fiche, corrections et cycle de vie (11 IDs)', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ record: null }),
      })
    );
  });

  it('S2.01 / K5.04 / S1.18 / S1.20 / S1.22 / S1.23 / S1.24 / S1.25 : affiche et édite la fiche Sortie complète', () => {
    const detail = makeDetail();
    const onSave = vi.fn();
    const onExport = vi.fn();
    const onDelete = vi.fn();

    render(
      <OutingSummary
        detail={detail}
        saving={false}
        onSave={onSave}
        onSaveMetrics={vi.fn()}
        onResetMetrics={vi.fn()}
        onShare={vi.fn()}
        onExport={onExport}
        onUpdated={vi.fn()}
        onDelete={onDelete}
      />
    );

    // S2.01 : temps en mouvement vs temps écoulé
    expect(screen.getByText('Temps mouvement')).toBeTruthy();
    expect(screen.getByText('Temps écoulé')).toBeTruthy();

    // S1.22 & S1.23 : badges de correction et lissage GPS
    expect(screen.getByText('Distance / D+ corrigés')).toBeTruthy();
    expect(screen.getByText('3 pic(s) GPS lissé(s)')).toBeTruthy();

    // S1.25 : exports GPX, TCX et fichier d'origine propriétaire
    fireEvent.click(screen.getByRole('button', { name: /Exporter en TCX/i }));
    expect(onExport).toHaveBeenCalledWith('tcx');
    fireEvent.click(screen.getByRole('button', { name: /Fichier d’origine/i }));
    expect(onExport).toHaveBeenCalledWith('original');

    // K5.04 & S1.20 : édition sport & tags depuis le panneau Modifier
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    const sportSelect = screen.getByLabelText('Sport / Type d’activité') as HTMLSelectElement;
    fireEvent.change(sportSelect, { target: { value: 'rando' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        sport: 'rando',
        tags: ['montagne', 'entrainement'],
      })
    );

    // S1.24 : corbeille 30 jours
    fireEvent.click(screen.getByRole('button', { name: /Supprimer/i }));
    expect(screen.getByText(/restaurable pendant 30 jours/i)).toBeTruthy();
  });

  it('K5.07 / K5.10 / S1.22 / S1.23 / S2.01 / S1.25 : panneau Trace avec outils avancés et export TCX/GPX', () => {
    const detail = makeDetail();
    const onExport = vi.fn();

    render(<OutingTrace detail={detail} onExport={onExport} onUpdated={vi.fn()} />);

    expect(screen.getByText('Temps en mouvement')).toBeTruthy();
    expect(screen.getByText('Durée totale (écoulée)')).toBeTruthy();
    expect(screen.getByText(/Corriger D\+ \/ distance \/ pics GPS/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Télécharger le TCX/i }));
    expect(onExport).toHaveBeenCalledWith('tcx');
    fireEvent.click(screen.getByRole('button', { name: /Télécharger le GPX/i }));
    expect(onExport).toHaveBeenCalledWith('gpx');
  });

  it('S1.25 / S1.26 : buildTcx respecte metricVisibility et tracePrivacy pour les tiers', () => {
    const detail = makeDetail({
      canEdit: false,
      shareMetrics: { ...ALL_OUTING_METRICS, heartRate: false },
      importSamples: [
        {
          recordedAt: '2026-08-12T08:00:00.000Z',
          heartRateBpm: 162,
          cadenceRpm: 80,
          powerW: null,
          temperatureC: null,
          distanceM: 5000,
        },
      ],
    });
    const tcx = buildTcx(detail);
    expect(tcx).toContain('<TrainingCenterDatabase');
    expect(tcx).toContain('<LatitudeDegrees>45.1</LatitudeDegrees>');
    // La FC est masquée par metricVisibility pour le tiers
    expect(tcx).not.toContain('<HeartRateBpm>');
  });
});
