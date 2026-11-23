'use client';

import { useEffect } from 'react';
import { PBtn } from '@/features/compas/v5/ui/primitives';
import { V5Icon } from '@/features/compas/v5/ui/icons';
import type { CollaborativeStage } from '../../../types';
import { useRouteViewMode } from '../expertMode';
import { useTrackTools } from '../useTrackTools';
import { Block, Btn, Note } from '../track/atoms';
import { V5Scope } from '../ui/V5Scope';
import { useRouteWorkspace } from '../WorkspaceContext';
import { DayArrival, DayBailoutRow, DayDate, DayStats, DayWater, ScheduleForm } from './DayParts';
import { DayTools } from './DayTools';
import { NightPicker } from './NightPicker';
import { ProfileCuts } from './ProfileCuts';
import { useDayReadings } from './useDayReadings';
import { useStagePlaces } from './useStagePlaces';

/**
 * Tiroir « Jour » de l'itinéraire (6.9) : la même lecture que `drawers/day.tsx` du Compas v5 (flèches jour
 * précédent / suivant, « A → B · Jour N · date », trois chiffres, « Ce soir » avec les nuits réelles, source),
 * avec en plus ce que l'itinéraire sait d'une journée : arrivée et coucher, eau, ravitaillement, repli.
 */
export function DayView({ stage }: { stage: CollaborativeStage }) {
  const { workspace, canEditStages, setSelectedStageId, setSubDrawer, runOperation, stageNotesDraft, setStageNotesDraft, orderedPoints } = useRouteWorkspace();
  const { expert } = useRouteViewMode();
  const { days, byId, group } = useDayReadings();
  const tools = useTrackTools();
  const reading = byId.get(stage.id);
  const { load } = useStagePlaces(workspace, stage);
  const kind = reading?.kind;
  useEffect(() => {
    if (kind && kind !== 'rest') void load();
  }, [load, kind]);

  if (!reading) return <Note>Cette journée n’existe plus.</Note>;
  const idx = days.findIndex((d) => d.stageId === stage.id);
  const go = (to: number) => {
    const target = days[to];
    if (target) setSelectedStageId(target.stageId);
  };
  const title = reading.kind === 'rest' ? 'Jour de repos' : `${reading.from ?? 'Départ'} → ${reading.to ?? 'Arrivée'}`;

  return (
    <V5Scope>
      <div className="rts-block" data-testid="subdrawer-stage">
        <div className="rts-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" className="rts-icon-btn" aria-label="Jour précédent" disabled={idx <= 0} onClick={() => go(idx - 1)}>
            <V5Icon name="left" size="s" />
          </button>
          <p className="v5-meta" style={{ margin: 0, textAlign: 'center' }}>
            <b>{title}</b> · Jour {reading.dayNumber}
          </p>
          <button type="button" className="rts-icon-btn" aria-label="Jour suivant" disabled={idx >= days.length - 1} onClick={() => go(idx + 1)}>
            <V5Icon name="right" size="s" />
          </button>
        </div>
        <DayDate reading={reading} />
        <DayStats reading={reading} />
        {expert && reading.kind !== 'rest' ? <Note>{group.description}</Note> : null}
        <DayArrival reading={reading} />

        <NightPicker stage={stage} reading={reading} onLoad={() => void load(true)} canEdit={canEditStages} runOperation={runOperation} />

        <Block title="Sur l’étape">
          <DayWater reading={reading} />
          <DayBailoutRow reading={reading} />
        </Block>

        <ProfileCuts onlyStageId={stage.id} />

        <Block title="Horaire du jour">
          <ScheduleForm key={`${stage.id}-${stage.entityVersion}`} stage={stage} />
        </Block>

        {expert && canEditStages && orderedPoints.length >= 3 && reading.kind === 'walk' ? (
          <Block title="Fin d’étape sur un point existant">
            <label className="rts-field">
              Point de fin d’étape
              <select
                value={stage.endPointId}
                onChange={(e) => void runOperation({ type: 'move_day_boundary', stageId: stage.id, newEndPointId: e.target.value }, { [stage.id]: stage.entityVersion })}
              >
                {orderedPoints.slice(1).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.kind}
                  </option>
                ))}
              </select>
            </label>
          </Block>
        ) : null}

        <Block title="Notes de journée">
          <label className="rts-field">
            Ravitaillement, horaire refuge, passage délicat…
            <textarea value={stageNotesDraft} onChange={(e) => setStageNotesDraft(e.target.value)} disabled={!canEditStages} />
          </label>
          {canEditStages ? (
            <Btn disabled={stageNotesDraft === stage.notes} onClick={() => void runOperation({ type: 'update_stage_note', stageId: stage.id, notes: stageNotesDraft }, { [stage.id]: stage.entityVersion })}>
              Enregistrer la note
            </Btn>
          ) : null}
        </Block>

        <DayTools stage={stage} reading={reading} />

        {reading.kind !== 'rest' ? (
          <Btn onClick={() => tools.exportGpx(stage.id)} testId="export-stage">
            Exporter le GPX du jour {stage.dayNumber}
          </Btn>
        ) : null}
        <PBtn onClick={() => setSubDrawer(null)}>Retour aux étapes</PBtn>
      </div>
    </V5Scope>
  );
}
