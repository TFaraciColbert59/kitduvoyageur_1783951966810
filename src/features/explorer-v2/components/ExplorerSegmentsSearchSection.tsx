'use client';

import React, { useEffect, useState } from 'react';
import { Flag, Star } from 'lucide-react';
import type { SegmentDefinition, UserSegmentPreferences } from '@/features/segments';
import { OverlaySheet } from '@/components/compte/overlay/OverlaySheet';
import { SegmentsDrawerPanel } from '@/components/segments';

export interface ExplorerSegmentsSearchSectionProps {
  query: string;
  center: [number, number]; // [lng, lat]
  online: boolean;
}

/**
 * Raccordement S01/S02 dans Explorer `Recherche` (`S4.03`, `S4.05`, `S4.06`, `S4.08`).
 * Préserve la requête et le viewport du parent en ouvrant la fiche détaillée dans
 * un sous-drawer `OverlaySheet` empilé.
 */
export function ExplorerSegmentsSearchSection({
  query,
  center,
  online,
}: ExplorerSegmentsSearchSectionProps) {
  const [segments, setSegments] = useState<SegmentDefinition[]>([]);
  const [prefs, setPrefs] = useState<UserSegmentPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<SegmentDefinition | null>(null);

  const trimmed = query.trim();

  useEffect(() => {
    if (!online) return;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (trimmed.length >= 2) params.set('q', trimmed);
    if (Number.isFinite(center[1]) && Number.isFinite(center[0])) {
      params.set('lat', String(center[1]));
      params.set('lng', String(center[0]));
      params.set('radius', '50000');
    }
    params.set('limit', '8');

    void fetch(`/api/segments?${params.toString()}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { segments?: SegmentDefinition[]; preferences?: UserSegmentPreferences } | null) => {
        if (!active || !data) return;
        setSegments(data.segments ?? []);
        if (data.preferences) setPrefs(data.preferences);
      })
      .catch(() => {
        /* ignore abort/offline cleanly */
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [trimmed, center[0], center[1], online]);

  if (segments.length === 0 && !loading) {
    return null;
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div className="xp-eyebrow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Segments sportifs</span>
        {loading ? <small style={{ fontWeight: 500 }}>Recherche…</small> : null}
      </div>
      <div className="xp-rows">
        {segments.map((seg) => {
          const isStarred = prefs?.starredSegmentIds.includes(seg.id) ?? false;
          return (
            <button
              key={seg.id}
              type="button"
              className="xp-row"
              onClick={() => setSelectedSegment(seg)}
              style={{ width: '100%', textAlign: 'left' }}
            >
              <span className="xp-row-ico is-forest" aria-hidden="true">
                <Flag size={16} />
              </span>
              <span className="xp-row-main">
                <b>
                  {seg.name}
                  {seg.verified ? ' · Vérifié' : ''}
                </b>
                <small>
                  {seg.sport} · {(seg.lengthM / 1000).toFixed(2)} km · +{Math.round(seg.elevationGainM)} m
                  {seg.hazardous ? ' · Signalé dangereux' : ''}
                </small>
              </span>
              {isStarred ? (
                <Star size={14} aria-label="Favori" style={{ color: '#c48f1e', flex: 'none' }} />
              ) : null}
            </button>
          );
        })}
      </div>

      {selectedSegment ? (
        <OverlaySheet
          title={selectedSegment.name}
          subtitle={`${selectedSegment.sport} · ${(selectedSegment.lengthM / 1000).toFixed(2)} km`}
          onClose={() => setSelectedSegment(null)}
          nested
        >
          <SegmentsDrawerPanel
            initialSelectedSegmentId={selectedSegment.id}
            hideSearchList
            onCloseSelected={() => setSelectedSegment(null)}
          />
        </OverlaySheet>
      ) : null}
    </div>
  );
}

export default ExplorerSegmentsSearchSection;
