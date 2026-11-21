'use client';

import { useState, useTransition } from 'react';
import Icon from '@/components/ui/Icon';
import { readCorridorPois, type CorridorPoi } from './corridorPoiActions';
import type { Coordinate } from './model';
import { DrawerRow, DrawerSection, EmptyBox, StatusBadge } from './DrawerPrimitives';
import ds from './cockpitDrawers.module.css';

const SUBTYPE_LABELS: Record<string, { label: string; icon: string; tone: 'water' | 'good' | 'neutral' }> = {
  drinking_water: { label: 'Eau potable', icon: 'droplet', tone: 'water' },
  spring: { label: 'Source', icon: 'droplet', tone: 'water' },
  alpine_hut: { label: 'Refuge', icon: 'home', tone: 'good' },
  wilderness_hut: { label: 'Cabane', icon: 'home', tone: 'good' },
  shelter: { label: 'Abri', icon: 'tent', tone: 'good' },
  camp_site: { label: 'Bivouac / Camp', icon: 'tent', tone: 'neutral' },
};

export function CorridorPoisPanel({
  point,
  isOnline,
}: {
  point?: Coordinate | null;
  isOnline: boolean;
}) {
  const lon = point?.[0];
  const lat = point?.[1];
  const [pois, setPois] = useState<CorridorPoi[] | null>(null);
  const [caveat, setCaveat] = useState<string>(
    'Source OpenStreetMap : ne prouve ni la potabilité de l’eau ni l’ouverture actuelle.',
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasCoords = typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon);

  function loadPois() {
    if (!hasCoords) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await readCorridorPois({ lat, lon });
        setCaveat(res.caveat);
        if (!res.ok) {
          setError('Impossible de charger les points d’eau et abris du couloir.');
          setPois([]);
        } else {
          setPois(res.pois);
        }
      } catch {
        setError('Erreur réseau lors du chargement des POI.');
      }
    });
  }

  return (
    <DrawerSection
      title="Eau & abris dans le couloir"
      right={
        pois !== null ? (
          <StatusBadge tone={pois.length > 0 ? 'water' : 'neutral'}>{pois.length} trouvé(s)</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">OSM</StatusBadge>
        )
      }
    >
      <div className={ds.cardPadded} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p className={ds.heroSub} style={{ margin: 0 }}>{caveat}</p>
        <button
          type="button"
          className={ds.btnSecondary}
          disabled={!hasCoords || !isOnline || pending}
          onClick={loadPois}
        >
          <Icon name="droplet" size={15} />
          {pending ? 'Recherche en cours…' : pois === null ? 'Charger eau & abris à proximité' : 'Actualiser les points'}
        </button>
        {!hasCoords && <p className={ds.heroSub} style={{ margin: 0 }}>Aucune coordonnée GPS sur les étapes du jour.</p>}
        {error && (
          <div className={ds.alertBanner} data-tone="warn" role="alert">
            <span>{error}</span>
          </div>
        )}
      </div>
      {pois !== null && pois.length === 0 && !error && (
        <div className={ds.cardPadded}>
          <EmptyBox icon="droplet" message="Aucun point d’eau ou abri référencé dans ce couloir." />
        </div>
      )}
      {pois && pois.length > 0 && pois.map((poi) => {
        const meta = SUBTYPE_LABELS[poi.subtype] ?? { label: poi.subtype, icon: 'map-pin', tone: 'neutral' as const };
        return (
          <DrawerRow
            key={poi.osmId}
            icon={meta.icon}
            iconTone={meta.tone}
            title={poi.name ?? meta.label}
            subtitle={[meta.label, poi.eleM != null ? `${Math.round(poi.eleM)} m` : null, poi.potable === false ? 'Non potable' : null].filter(Boolean).join(' · ')}
            right={<StatusBadge tone={meta.tone === 'water' ? 'water' : 'neutral'}>{poi.lat.toFixed(3)}, {poi.lon.toFixed(3)}</StatusBadge>}
          />
        );
      })}
    </DrawerSection>
  );
}
