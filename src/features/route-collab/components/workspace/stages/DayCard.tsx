'use client';

import { V5Icon } from '@/features/compas/v5/ui/icons';
import { OVERNIGHT_LABELS } from '../labels';
import type { DayReading } from '../../../dayReading';
import type { CollaborativeStage } from '../../../types';
import { useRouteViewMode } from '../expertMode';
import { Pill } from '../track/atoms';
import { RouteRow, RouteRows } from '../ui/RouteRow';
import { useRouteWorkspace } from '../WorkspaceContext';
import { DayArrival, DayBailoutRow, DayDate, DayStats, DayWater } from './DayParts';
import { DayTools } from './DayTools';
import { loadPlaces } from './useStagePlaces';
import { stagePlacePoints } from '../../../placesClient';
import { Btn } from '../track/atoms';

const KIND_TITLE = { walk: '', rest: 'Jour de repos', short: 'Étape courte' } as const;

function nightLine(r: DayReading): string {
  switch (r.night.status) {
    case 'last':
      return 'Arrivée';
    case 'chosen':
      return `${OVERNIGHT_LABELS[r.night.chosen.type]} · ${r.night.chosen.name}`;
    case 'candidates':
      return `${r.night.options.length} nuit${r.night.options.length > 1 ? 's' : ''} réelle${r.night.options.length > 1 ? 's' : ''} possible${r.night.options.length > 1 ? 's' : ''}`;
    case 'to_find':
      return 'Nuit à trouver';
    default:
      return 'Nuit : lieux pas encore relevés';
  }
}

/** Une journée de l'onglet Étapes : même lecture que le tiroir « Jour » du Compas v5, en résumé. */
export function DayCard({ stage, reading }: { stage: CollaborativeStage; reading: DayReading }) {
  const { workspace, setSelectedStageId, openSubDrawer } = useRouteWorkspace();
  const { expert } = useRouteViewMode();
  const needsPlaces = reading.kind !== 'rest' && reading.night.status === 'unknown' && reading.night.reason === 'not_loaded';
  const title = `Jour ${reading.dayNumber}${KIND_TITLE[reading.kind] ? ` · ${KIND_TITLE[reading.kind]}` : reading.title && !/^Jour \d+$/.test(reading.title) ? ` · ${reading.title}` : ''}`;
  return (
    <article className="rts-day v5-grp" style={{ padding: 8 }} data-testid={`day-category-${stage.id}`} data-kind={reading.kind}>
      <button
        type="button"
        className="rts-day-head rcw-day-head"
        onClick={() => {
          setSelectedStageId(stage.id);
          openSubDrawer('stage');
        }}
        aria-label={`Ouvrir ${title}`}
      >
        <span className="t">
          <b>{title}</b>
          <small>{reading.kind === 'rest' ? (reading.to ?? 'Même lieu') : `${reading.from ?? 'Départ'} → ${reading.to ?? 'Arrivée'}`}</small>
        </span>
        {reading.arrival.late ? <Pill tone="warn">Arrivée après le coucher</Pill> : null}
        <V5Icon name="right" size="s" />
      </button>
      <DayDate reading={reading} />
      <DayStats reading={reading} />
      <DayArrival reading={reading} />
      <RouteRows>
        <RouteRow
          icon="bed"
          testId={`day-night-${stage.id}`}
          title={nightLine(reading)}
          subtitle={reading.night.status === 'chosen' ? reading.night.chosen.provenance : null}
          state={reading.night.status === 'to_find' ? 'to_check' : reading.night.status === 'chosen' ? 'confirmed' : undefined}
        />
      </RouteRows>
      {expert || reading.water.status === 'known' ? <DayWater reading={reading} /> : null}
      {expert || reading.bailout.status === 'found' ? <DayBailoutRow reading={reading} /> : null}
      {needsPlaces ? (
        <Btn onClick={() => void loadPlaces(stagePlacePoints(workspace, stage))} testId={`load-places-${stage.id}`}>
          Relever nuits, eau et sorties
        </Btn>
      ) : null}
      <DayTools stage={stage} reading={reading} />
    </article>
  );
}
