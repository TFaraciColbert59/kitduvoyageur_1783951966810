'use client';

import { useMemo, useState } from 'react';
import { Chip, Li, Stepper } from '@/features/compas/v5/ui/primitives';
import { defaultSpeedKmHForSport } from '@/features/adventure-prep/routeRevision';
import { fmtDuration, fmtKm, fmtMeters } from '../../../fmt';
import { DEFAULT_NAISMITH, type NaismithParams } from '../../../insights/pace';
import { proposeStageSplit, type StageSplitProposal } from '../../../insights/stageSplit';
import { overnightCandidatesFrom, overnightFromCandidate } from '../../../nights';
import { activePoints } from '../../../engine';
import { routePlacePoints } from '../../../placesClient';
import { useRouteViewMode } from '../expertMode';
import { Block, Btn, Note, Pill } from '../track/atoms';
import { useRouteWorkspace } from '../WorkspaceContext';
import { useGroupPace } from './usePace';
import { loadPlaces, useRoutePlaces } from './useStagePlaces';

const DEFAULT_HOURS = 6;
const DEFAULT_ASCENT = 1000;

/**
 * 6.1 : « 3 jours de 5 à 6 h, nuits aux refuges X et Y », avec la règle utilisée. Les seuils (heures et D+ par
 * jour) se modifient en vue experte. Les nuits sont des lieux réels d'OpenStreetMap ; sans lieu près d'une
 * coupure, la nuit reste « à trouver ». Appliquer pose les coupures sur le tracé et retient ces nuits.
 */
export function SplitAssistant() {
  const { workspace, runOperation, canEditStages, setStatusMessage } = useRouteWorkspace();
  const { expert } = useRouteViewMode();
  const { pace } = useGroupPace();
  const routePlaces = useRoutePlaces(workspace);
  const [mode, setMode] = useState<'limits' | 'days'>('limits');
  const [days, setDays] = useState(Math.max(2, workspace.stages.length));
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [ascent, setAscent] = useState(DEFAULT_ASCENT);
  const [proposal, setProposal] = useState<StageSplitProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const walking = workspace.sport === 'marche';
  const hasTrack = activePoints(workspace).length >= 2 && workspace.sections.length > 0;

  /** À vélo l'allure Naismith n'a pas de sens : vitesse moyenne du routeur (ou du sport) et montée de 800 m/h. */
  const params: NaismithParams = useMemo(() => {
    if (walking) return pace.params;
    const km = workspace.sections.reduce((a, s) => a + s.distanceKm, 0);
    const min = workspace.sections.every((s) => s.durationMin != null) ? workspace.sections.reduce((a, s) => a + (s.durationMin ?? 0), 0) : null;
    const speed = min && min > 0 && km > 0 ? Math.round((km / (min / 60)) * 10) / 10 : defaultSpeedKmHForSport(workspace.sport);
    return { speedKmh: speed || DEFAULT_NAISMITH.speedKmh, ascentMPerHour: 800 };
  }, [walking, pace.params, workspace.sections, workspace.sport]);

  const propose = async () => {
    setBusy(true);
    try {
      const placesNow = await loadPlaces(routePlacePoints(workspace));
      const p = proposeStageSplit(workspace, {
        days: mode === 'days' ? days : undefined,
        maxHoursPerDay: hours,
        maxAscentPerDay: ascent,
        overnightCandidates: overnightCandidatesFrom(placesNow.pois),
        pace: params,
      });
      setProposal(p);
      if (placesNow.status === 'error') setStatusMessage('Lieux de nuit indisponibles : les nuits resteront à trouver.');
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!proposal?.ok) return;
    const now = new Date().toISOString();
    const stamp = Date.now().toString(36);
    const ok = await runOperation(
      {
        type: 'apply_stage_split',
        cuts: proposal.stages.slice(0, -1).map((st, i) => ({
          pointId: `pt-split-${stamp}-${i}`,
          lat: st.endLat,
          lon: st.endLon,
          name: st.overnight?.name ?? null,
          overnightPlace: st.overnight ? overnightFromCandidate(st.overnight, now) : null,
        })),
      },
      {},
      { gesture: `split-${stamp}` }
    );
    if (ok) {
      setProposal(null);
      setStatusMessage(`Itinéraire découpé en ${proposal.stages.length} jour${proposal.stages.length > 1 ? 's' : ''}.`);
    }
  };

  const placesNote =
    routePlaces.places.status === 'error'
      ? 'Lieux d’OpenStreetMap indisponibles : aucune nuit n’est proposée.'
      : routePlaces.places.status === 'partial'
        ? 'Relevé des lieux partiel : des nuits réelles peuvent manquer.'
        : null;

  return (
    <Block title="Découper en jours" testId="split-assistant">
      <div className="rts-chips" role="group" aria-label="Façon de découper">
        <Chip pressed={mode === 'limits'} onClick={() => setMode('limits')}>
          Selon mes limites
        </Chip>
        <Chip pressed={mode === 'days'} onClick={() => setMode('days')}>
          Un nombre de jours
        </Chip>
      </div>
      {mode === 'days' ? (
        <div className="rts-actions" style={{ alignItems: 'center' }}>
          <span>
            <b>{days}</b> jour{days > 1 ? 's' : ''}
          </span>
          <Stepper value={days} min={1} max={14} onChange={setDays} lessLabel="Un jour de moins" moreLabel="Un jour de plus" />
        </div>
      ) : null}
      {expert || mode === 'limits' ? (
        <div className="rts-thresholds" data-testid="split-thresholds">
          <div>
            <small className="rts-note">Heures max par jour</small>
            <div className="rts-actions" style={{ alignItems: 'center' }}>
              <b>{hours} h</b>
              <Stepper value={hours} min={2} max={14} onChange={setHours} lessLabel="Moins d’heures par jour" moreLabel="Plus d’heures par jour" />
            </div>
          </div>
          {expert ? (
            <div>
              <small className="rts-note">D+ max par jour</small>
              <div className="rts-actions" style={{ alignItems: 'center' }}>
                <b>{fmtMeters(ascent)}</b>
                <Stepper value={ascent} min={200} max={3000} step={100} onChange={setAscent} lessLabel="Moins de D+ par jour" moreLabel="Plus de D+ par jour" />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <Btn tone="primary" disabled={!hasTrack || busy || !canEditStages} onClick={() => void propose()} testId="propose-split">
        {busy ? 'Recherche des refuges et hébergements réels…' : 'Proposer un découpage'}
      </Btn>
      {!hasTrack ? <Note>Tracez au moins deux points pour proposer un découpage.</Note> : null}
      {placesNote ? <Note tone="warn">{placesNote}</Note> : null}

      {proposal ? (
        <div className="rts-proposal" data-testid="split-proposal">
          {proposal.ok ? (
            <>
              <strong>{proposal.explanation}</strong>
              <Note>
                {walking ? proposal.rule : `Durées au rythme moyen du routeur (${params.speedKmh} km/h) et ${params.ascentMPerHour} m de montée par heure ; ${proposal.rule.replace(/\(.*?\)/, '').trim()}`}
              </Note>
              {expert ? (
                <Note>
                  Seuils : {proposal.thresholds.maxHoursPerDay} h et {fmtMeters(proposal.thresholds.maxAscentPerDay)} de D+ par jour.
                </Note>
              ) : null}
              <div className="v5-grp">
                {proposal.stages.map((st) => (
                  <Li
                    key={st.dayNumber}
                    icon="flag"
                    title={`Jour ${st.dayNumber} · ${fmtKm(st.distanceKm)} · ${st.durationIsLowerBound ? '≥ ' : '≈ '}${fmtDuration(st.durationMin)}`}
                    detail={
                      st.overnightStatus === 'none'
                        ? `Arrivée · ${st.ascentM != null ? `+${fmtMeters(st.ascentM)}` : 'D+ inconnu'}`
                        : `${st.ascentM != null ? `+${fmtMeters(st.ascentM)}` : 'D+ inconnu'} · ${st.overnight ? `nuit : ${st.overnight.name}` : 'nuit à trouver'}`
                    }
                    right={st.exceeds.length > 0 ? <Pill tone="warn">Dépasse un seuil</Pill> : st.overnight ? <Pill tone="good">Lieu réel</Pill> : undefined}
                  />
                ))}
              </div>
              {proposal.warnings.map((w) => (
                <Note key={w} tone="warn">
                  {w}
                </Note>
              ))}
              <div className="rts-actions">
                <Btn tone="primary" disabled={!canEditStages} onClick={() => void apply()} testId="apply-split">
                  Appliquer ce découpage
                </Btn>
                <Btn onClick={() => setProposal(null)}>Fermer</Btn>
              </div>
            </>
          ) : (
            <Note tone="warn">{proposal.explanation}</Note>
          )}
        </div>
      ) : null}
    </Block>
  );
}
