'use client';

import React, { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { ActionPill } from '@/components/ui/ActionPill';
import type { ZoneMetric, ZoneSet } from '@/features/explorer-v2/metrics/activityMetrics';
import {
  buildDefaultZoneSet,
  readLocalZoneSets,
  saveLocalZoneSet,
} from '@/features/explorer-v2/metrics/telemetryAnalysis';
import { createZoneSet } from '@/features/explorer-v2/metrics/zoneConfiguration';
import { OverlaySheet } from '../../overlay/OverlaySheet';

const METRICS: Array<{ id: ZoneMetric; label: string; thresholdLabel: string; unit: string; defaultThreshold: number }> = [
  { id: 'heartRate', label: 'Cardio (FC)', thresholdLabel: 'FC max', unit: 'bpm', defaultThreshold: 190 },
  { id: 'power', label: 'Puissance vélo', thresholdLabel: 'FTP', unit: 'watts', defaultThreshold: 250 },
  { id: 'pace', label: 'Allure course', thresholdLabel: 'Allure seuil (s/km)', unit: 'secondsPerKm', defaultThreshold: 270 },
];

export function ZoneSettingsSheet({ onClose }: { onClose: () => void }) {
  const [metric, setMetric] = useState<ZoneMetric>('heartRate');
  const [discipline, setDiscipline] = useState<string>('all');
  const [thresholdInput, setThresholdInput] = useState<string>('190');
  const [zones, setZones] = useState<ZoneSet>(() => buildDefaultZoneSet('heartRate', 'all', 190));
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const existing = readLocalZoneSets(discipline).find((z) => z.metric === metric);
    if (existing) {
      setZones(existing);
      setThresholdInput(existing.threshold?.value ? String(existing.threshold.value) : '');
      return;
    }
    const meta = METRICS.find((m) => m.id === metric)!;
    const def = buildDefaultZoneSet(metric, discipline, meta.defaultThreshold);
    setZones(def);
    setThresholdInput(String(meta.defaultThreshold));
  }, [metric, discipline]);

  const recalculateFromThreshold = () => {
    const parsed = Number(thresholdInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setStatus('Entre une valeur de seuil positive.');
      return;
    }
    const next = buildDefaultZoneSet(metric, discipline, parsed);
    setZones(next);
    setStatus('Seuils des 5 zones recalculés.');
  };

  const updateBand = (idx: number, field: 'lower' | 'upper', raw: string) => {
    const num = raw.trim() === '' ? null : Number(raw);
    if (num !== null && !Number.isFinite(num)) return;
    setZones((prev) => ({
      ...prev,
      bands: prev.bands.map((b, i) => (i === idx ? { ...b, [field]: num } : b)),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const result = createZoneSet({
        id: `local-${metric}-${discipline}-${Date.now()}`,
        version: '1',
        discipline,
        metric: zones.metric,
        basis: 'absolute',
        unit: zones.unit,
        threshold: zones.threshold,
        bands: zones.bands,
        effectiveFromMs: Date.now(),
        recordedAtMs: Date.now(),
      });
      if (!result.ok) {
        setStatus(result.errors.join(', ') || 'Configuration invalide.');
        return;
      }
      const validated = result.zoneSet;
      saveLocalZoneSet(validated);
      let serverOk = false;
      try {
        const res = await fetch('/api/explorer/v2/metrics/zones', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(validated),
        });
        serverOk = res.ok;
      } catch {
        serverOk = false;
      }
      setZones(validated);
      setStatus(
        serverOk
          ? 'Zones enregistrées et appliquées à tes analyses.'
          : 'Zones enregistrées localement (synchronisation serveur indisponible).'
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Configuration invalide.');
    } finally {
      setSaving(false);
    }
  };

  const meta = METRICS.find((m) => m.id === metric)!;

  return (
    <OverlaySheet title="Zones sportives &amp; seuils" onClose={onClose}>
      <div className="lkdv-compte-pane" data-testid="compte-zone-settings-sheet">
        <p className="lkdv-sortie-proof">
          Configure tes zones d’entraînement (cardio, puissance FTP, allure) pour les analyses de sorties.
        </p>

        <div className="lkdv-compte-segment" role="tablist" aria-label="Métrique de zone">
          {METRICS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={metric === item.id}
              className={metric === item.id ? 'on' : ''}
              onClick={() => setMetric(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          <span>Discipline</span>
          <select value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
            <option value="all">Toutes disciplines</option>
            <option value="course">Course à pied</option>
            <option value="trail">Trail</option>
            <option value="velo">Vélo</option>
          </select>
        </label>

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
            <span>{meta.thresholdLabel} ({meta.unit})</span>
            <input
              type="number"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
            />
          </label>
          <ActionPill
            label="Recalculer les 5 zones"
            text="Recalculer"
            icon={<SlidersHorizontal />}
            onClick={recalculateFromThreshold}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {zones.bands.map((band, idx) => (
            <div
              key={band.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 78px 78px',
                gap: 8,
                alignItems: 'center',
                fontSize: 12.5,
              }}
            >
              <span>{band.label}</span>
              <input
                type="number"
                aria-label={`${band.label} min`}
                value={band.lower ?? ''}
                onChange={(e) => updateBand(idx, 'lower', e.target.value)}
              />
              <input
                type="number"
                aria-label={`${band.label} max`}
                placeholder="∞"
                value={band.upper ?? ''}
                onChange={(e) => updateBand(idx, 'upper', e.target.value)}
              />
            </div>
          ))}
        </div>

        {status ? (
          <p className="lkdv-compte-inline-status" role="status">
            {status}
          </p>
        ) : null}

        <div className="lkdv-apill-row">
          <ActionPill
            tone="primary"
            label="Enregistrer les zones"
            text={saving ? 'Enregistrement…' : 'Enregistrer'}
            icon={<SlidersHorizontal />}
            busy={saving}
            onClick={() => void handleSave()}
          />
        </div>
      </div>
    </OverlaySheet>
  );
}
