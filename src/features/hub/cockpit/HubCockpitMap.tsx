'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import HubRouteMap, { type HubRoutePoint } from '../components/mobile/HubRouteMap';
import { maplibreTokens } from '@/design/tokens.generated';
import type { CockpitData, CockpitStep } from './model';
import styles from './cockpit.module.css';

const EMPTY_ROUTE: [number, number][] = [];

export function HubCockpitMap({ data, onStep, fixture }: {
  data: CockpitData;
  onStep?: (step: CockpitStep) => void;
  fixture?: boolean;
}) {
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [attempt, setAttempt] = useState(0);
  const segments = useMemo(() => data.route.map((line) =>
    line.map(([lng, lat]): [number, number] => [lat, lng])), [data.route]);
  const points = useMemo(() => data.steps.flatMap((step): HubRoutePoint[] => step.coordinate ? [{
    id: step.id, stepId: step.id, label: step.title, lat: step.coordinate[1],
    lon: step.coordinate[0], color: maplibreTokens.routeTrackActive,
  }] : []), [data.steps]);
  const hasGeometry = points.length > 0 || segments.some((segment) => segment.length >= 2);

  return (
    <div className={onStep ? styles.largeMap : styles.map} data-cv2-nodrag={onStep ? true : undefined}>
      {hasGeometry ? <>
        <HubRouteMap
          key={attempt}
          routeCoords={EMPTY_ROUTE}
          routeSegments={segments}
          points={points}
          interactive={Boolean(onStep)}
          onBasemapState={setState}
          onPointSelect={(point) => {
            const step = data.steps.find((item) => item.id === point.stepId);
            if (step) onStep?.(step);
          }}
        />
        {state !== 'ready' && <div className={styles.mapStatus} role="status">
          {state === 'loading' ? 'Chargement de la carte' : 'Fond cartographique indisponible'}
          {state === 'unavailable' && onStep && <button type="button" className="lkdv-cv2-chip" onClick={() => {
            setState('loading');
            setAttempt((value) => value + 1);
          }}>Réessayer</button>}
        </div>}
      </> : <div className={styles.mapStatus}>
        Aucun repère géolocalisé
        {onStep && !fixture && <Link className="lkdv-cv2-chip" href="/hub/itineraire">Ouvrir l’itinéraire</Link>}
      </div>}
    </div>
  );
}
