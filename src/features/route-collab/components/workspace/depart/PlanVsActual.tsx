'use client';

import { useMemo } from 'react';
import { Cap, PBtn } from '@/features/compas/v5/ui/primitives';
import { comparePlanToActual, overlayPaths, type RecordedSession } from '../../../depart/carnetCompare';
import { fmtDuration, fmtKm, fmtSignedDuration, fmtSignedKm } from '../../../fmt';
import { orderedLegs, polylineOf } from '../../../insights/shared';
import type { RouteWorkspaceState } from '../../../types';
import { RouteRow, RouteRows } from '../ui/RouteRow';
import { V5Scope } from '../ui/V5Scope';
import '../analyse/analyse.css';

/**
 * Carnet « plan contre réel » (9.9) : la version SUIVIE (jamais une publication plus récente) et la sortie
 * enregistrée, tracés superposés, écarts de temps par jour, sac emporté. Chaque valeur du réel vient de la sortie
 * (`hike_sessions`), aucune du plan.
 */
export function PlanVsActualBlock({
  workspace,
  sessions,
  status,
  reason,
  onReplay,
}: {
  workspace: RouteWorkspaceState;
  sessions: readonly RecordedSession[] | null;
  status: 'idle' | 'loading' | 'ready';
  reason: string | null;
  onReplay: (s: { sessionId: string; startedAt: string }) => void;
}) {
  return (
    <V5Scope>
      <div className="rcw-block" data-testid="plan-vs-actual">
        <Cap>Plan contre réel</Cap>
        {status === 'loading' ? <p className="rcw-sub-note">Lecture des sorties…</p> : null}
        {status === 'ready' && sessions == null ? <p className="rcw-sub-note" data-testid="sessions-unread">{reason ?? 'Sorties non lues.'}</p> : null}
        {status === 'ready' && sessions && sessions.length === 0 ? (
          <p className="rcw-sub-note" data-testid="sessions-none">{reason ?? 'Aucune sortie enregistrée avec cet itinéraire pour l’instant.'}</p>
        ) : null}
        {(sessions ?? []).map((s) => (
          <SessionCompare key={s.sessionId} workspace={workspace} session={s} onReplay={onReplay} />
        ))}
      </div>
    </V5Scope>
  );
}

function SessionCompare({ workspace, session, onReplay }: { workspace: RouteWorkspaceState; session: RecordedSession; onReplay: (s: { sessionId: string; startedAt: string }) => void }) {
  const rev = workspace.revisions.find((r) => r.id === session.routeRevisionId) ?? null;
  const cmp = useMemo(() => (rev ? comparePlanToActual({ points: rev.points, sections: rev.sections, stages: rev.stages, kitSnapshot: rev.kitSnapshot }, session) : null), [rev, session]);
  const paths = useMemo(() => {
    const planned = rev ? polylineOf(orderedLegs({ points: rev.points, sections: rev.sections })) : [];
    const actual = session.track.map((p) => [p.lon, p.lat] as [number, number]);
    return overlayPaths(planned, actual, 300, 150);
  }, [rev, session.track]);
  const date = session.startedAt.slice(0, 10).split('-').reverse().join('/');
  return (
    <section className="rcw-block" data-testid={`session-${session.sessionId}`} aria-label={`Sortie du ${date}`}>
      <b>Sortie du {date}</b>
      <p className="rcw-sub-note">
        {session.distanceKm != null ? fmtKm(session.distanceKm) : 'distance inconnue'}
        {session.durationSeconds != null ? ` · ${fmtDuration(session.durationSeconds / 60)}` : ''}
        {rev ? ` · version suivie v${rev.revisionNo}` : ' · version suivie non retrouvée : pas de comparaison'}
      </p>
      {paths ? (
        <svg className="rcw-overlay" viewBox="0 0 300 150" role="img" aria-label="Tracé prévu et tracé enregistré superposés" data-testid="overlay-svg">
          {paths.plannedPath ? <path d={paths.plannedPath} className="rcw-overlay-plan" fill="none" /> : null}
          {paths.actualPath ? <path d={paths.actualPath} className="rcw-overlay-real" fill="none" /> : null}
        </svg>
      ) : null}
      <ul className="rcw-legend">
        <li><i aria-hidden="true" className="rcw-overlay-key plan" />Prévu</li>
        <li><i aria-hidden="true" className="rcw-overlay-key real" />Enregistré</li>
      </ul>
      {cmp ? (
        <>
          <RouteRows testId={`compare-${session.sessionId}`}>
            <RouteRow
              icon="route"
              title="Distance"
              subtitle={`prévu ${cmp.plannedKm != null ? fmtKm(cmp.plannedKm) : 'inconnu'} · réel ${cmp.recordedKm != null ? fmtKm(cmp.recordedKm) : 'inconnu'}`}
              value={cmp.deltaKm != null ? fmtSignedKm(cmp.deltaKm) : 'Inconnu'}
              state={cmp.deltaKm == null ? 'unknown' : undefined}
              testId="compare-km"
            />
            {cmp.days.map((d) => (
              <RouteRow
                key={d.stageId}
                icon="clock"
                title={`Jour ${d.day}`}
                subtitle={`prévu ${d.plannedMin != null ? fmtDuration(d.plannedMin) : 'inconnu'} · réel ${d.actualMin != null ? fmtDuration(d.actualMin) : (d.reason ?? 'inconnu')}`}
                value={d.deltaMin != null ? fmtSignedDuration(d.deltaMin) : 'Inconnu'}
                state={d.deltaMin == null ? 'unknown' : undefined}
                testId={`compare-day-${d.day}`}
              />
            ))}
            <RouteRow
              icon="bag"
              title="Sac emporté"
              subtitle={
                cmp.kit.carried == null
                  ? 'Sac emporté non enregistré avec cette sortie'
                  : `${cmp.kit.carried} objet${cmp.kit.carried > 1 ? 's' : ''} pour ${cmp.kit.planned} prévu${cmp.kit.planned > 1 ? 's' : ''}${cmp.kit.missing.length > 0 ? ` · pas emporté : ${cmp.kit.missing.join(', ')}` : ''}${cmp.kit.extra.length > 0 ? ` · en plus : ${cmp.kit.extra.join(', ')}` : ''}`
              }
              value={cmp.kit.carriedGrams != null ? `${(cmp.kit.carriedGrams / 1000).toFixed(1).replace('.', ',')} kg` : 'Inconnu'}
              state={cmp.kit.carried == null ? 'unknown' : undefined}
              testId="compare-kit"
            />
          </RouteRows>
          <small className="rcw-expert-note">{cmp.method}</small>
        </>
      ) : null}
      <PBtn onClick={() => onReplay({ sessionId: session.sessionId, startedAt: session.startedAt })} data-testid={`replay-${session.sessionId}`}>
        Reprendre cette sortie
      </PBtn>
    </section>
  );
}
