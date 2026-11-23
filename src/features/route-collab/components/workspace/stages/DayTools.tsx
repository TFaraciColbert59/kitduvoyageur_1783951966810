'use client';

import { useMemo, useState } from 'react';
import { Li } from '@/features/compas/v5/ui/primitives';
import { poiLabel, type RoutePoi } from '@/features/compas/engine/routePois';
import { distanceKm } from '@/features/compas/engine/places';
import type { DayReading } from '../../../dayReading';
import { fmtKm } from '../../../fmt';
import { formatCoordinates, parseCoordinates } from '../../../pointEdit';
import { activePoints } from '../../../engine';
import type { CollaborativeStage } from '../../../types';
import { Btn, Note } from '../track/atoms';
import { useRouteWorkspace } from '../WorkspaceContext';
import { readPlaces } from './useStagePlaces';
import { stagePlacePoints } from '../../../placesClient';

const TURNAROUND_CATEGORIES = new Set(['viewpoint', 'peak', 'refuge', 'water', 'resto']);
const MAX_SHORT_KM = 6;

/**
 * 6.7 : après un jour, une journée de repos (sans tracé, même nuit) ou une étape courte (aller-retour depuis la
 * même nuit). Le demi-tour se choisit parmi des lieux réels relevés près de la nuit, ou par ses coordonnées ;
 * l'étape courte ne change pas le tracé qui suit. Un jour de repos ou une étape courte se retire d'un geste.
 */
export function DayTools({ stage, reading }: { stage: CollaborativeStage; reading: DayReading }) {
  const { workspace, runOperation, canEditStages, setStatusMessage } = useRouteWorkspace();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState('');
  const days = workspace.stages.slice().sort((a, b) => a.dayNumber - b.dayNumber);
  const isLast = days[days.length - 1]?.id === stage.id;
  const places = readPlaces(stagePlacePoints(workspace, stage));
  const base = useMemo(() => activePoints(workspace).find((p) => p.id === stage.endPointId) ?? null, [workspace, stage.endPointId]);
  const candidates: RoutePoi[] = useMemo(() => {
    if (!base) return [];
    return places.pois
      .filter((p) => TURNAROUND_CATEGORIES.has(p.category) && distanceKm(base, p) <= MAX_SHORT_KM && distanceKm(base, p) > 0.2)
      .sort((a, b) => distanceKm(base, a) - distanceKm(base, b))
      .slice(0, 5);
  }, [places.pois, base]);

  if (!canEditStages) return null;
  const stamp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

  if (reading.kind !== 'walk') {
    return (
      <div className="rts-actions">
        <Btn tone="warn" testId={`remove-${stage.id}`} onClick={() => void runOperation({ type: 'remove_stage', stageId: stage.id }, { [stage.id]: stage.entityVersion })}>
          {reading.kind === 'rest' ? 'Retirer ce jour de repos' : 'Retirer cette étape courte'}
        </Btn>
      </div>
    );
  }
  if (isLast) return null;

  const addShort = (lat: number, lon: number, name: string | null) => {
    const id = stamp();
    void runOperation(
      { type: 'insert_short_stage', afterStageId: stage.id, stageId: `stage-short-${id}`, turnaroundPointId: `pt-turn-${id}`, returnPointId: `pt-back-${id}`, lat, lon, name },
      { [stage.id]: stage.entityVersion }
    ).then((ok) => {
      if (ok) {
        setOpen(false);
        setCoords('');
        setStatusMessage('Étape courte ajoutée : aller-retour depuis la même nuit, le tracé suivant est inchangé.');
      }
    });
  };
  const parsed = coords.trim() ? parseCoordinates(coords) : null;

  return (
    <div className="rts-block" data-testid={`day-tools-${stage.id}`}>
      <div className="rts-actions">
        <Btn
          testId={`add-rest-${stage.id}`}
          onClick={() => void runOperation({ type: 'insert_rest_day', afterStageId: stage.id, stageId: `stage-rest-${stamp()}` }, { [stage.id]: stage.entityVersion }).then((ok) => ok && setStatusMessage('Jour de repos ajouté : les dates suivantes sont décalées d’un jour.'))}
        >
          Ajouter un jour de repos
        </Btn>
        <Btn onClick={() => setOpen((v) => !v)} testId={`add-short-${stage.id}`}>
          {open ? 'Fermer' : 'Ajouter une étape courte'}
        </Btn>
      </div>
      {open ? (
        <>
          <Note>Aller-retour depuis la nuit de ce soir : choisissez le lieu du demi-tour.</Note>
          {candidates.length > 0 ? (
            <div className="v5-grp">
              {candidates.map((p) => (
                <Li key={`${p.category}-${p.id}`} icon="locate" title={poiLabel(p)} detail={`${fmtKm(distanceKm(base!, p))} de la nuit à vol d’oiseau`} onClick={() => addShort(p.lat, p.lon, poiLabel(p))} />
              ))}
            </div>
          ) : (
            <Note>Aucun lieu relevé près de la nuit : saisissez des coordonnées{reading.night.status === 'unknown' ? ', ou relevez d’abord les lieux de la journée' : ''}.</Note>
          )}
          <form
            className="rts-row-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (parsed?.ok) addShort(parsed.value.lat, parsed.value.lon, null);
            }}
          >
            <label className="rts-field">
              Demi-tour (latitude, longitude)
              <input value={coords} inputMode="decimal" onChange={(e) => setCoords(e.target.value)} placeholder={base ? formatCoordinates(base) : ''} />
            </label>
            <Btn type="submit" disabled={!parsed?.ok}>
              Ajouter
            </Btn>
          </form>
          {parsed && !parsed.ok ? <Note tone="bad">{parsed.error}</Note> : null}
        </>
      ) : null}
    </div>
  );
}
