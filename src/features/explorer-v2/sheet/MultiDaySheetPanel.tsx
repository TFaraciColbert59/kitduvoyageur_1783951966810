'use client';

import React, { useMemo, useState } from 'react';
import type { SheetContext } from './context';
import {
  anchorStageToLodging,
  commitStageBoundaryMove,
  previewStageBoundaryMove,
  splitRouteIntoDays,
} from '@/features/planning/split';
import {
  continuousRouteFromExplorer,
  explorerSportToPlanningSport,
  lodgingsFromExplorerPois,
  trailSnapshotFromStage,
} from '@/features/planning/explorerAdapter';
import type { MultiDayPlan, StageRevision } from '@/features/planning/models';
import { getStageLaunchReadiness } from '@/features/planning/navigation';

/**
 * Planificateur trek / itinérance multi-jours dans Explorer (Lot R04 : K1.13, K2.29, K2.30, K2.31, K2.32).
 */
export function MultiDaySheetPanel({ ctx }: { ctx: SheetContext }) {
  const { state } = ctx;
  const activeRoute = ctx.routes.find((r) => String(r.id) === state.selection?.id) ?? ctx.routes[0];
  const [daysCount, setDaysCount] = useState<number>(3);
  const [boundaryDay, setBoundaryDay] = useState<number | null>(null);
  const [boundaryIndex, setBoundaryIndex] = useState<number | null>(null);
  const [lodgingDay, setLodgingDay] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const plan: MultiDayPlan | null = useMemo(() => {
    if (state.activeMultiDayPlan) return state.activeMultiDayPlan;
    const geom = state.trailRoute?.geojson ?? activeRoute?.geojson;
    if (!geom) return null;
    const continuous = continuousRouteFromExplorer({
      id: String(activeRoute?.id ?? state.trailRoute?.id ?? 'route'),
      name: activeRoute?.name ?? state.trailRoute?.name ?? 'Itinéraire',
      geojson: geom,
      sport: explorerSportToPlanningSport(state.searchSport),
    });
    if (!continuous) return null;
    return splitRouteIntoDays(continuous, {
      planId: continuous.id,
      targetDays: daysCount,
      nowIso: new Date().toISOString(),
      publicShareConsented: false,
    });
  }, [activeRoute, daysCount, state.activeMultiDayPlan, state.searchSport, state.trailRoute]);

  const stageForLodging = useMemo(
    () => (plan && lodgingDay != null ? plan.stages.find((s) => s.dayNumber === lodgingDay) ?? null : null),
    [plan, lodgingDay],
  );

  const availableLodgings = useMemo(() => {
    if (!stageForLodging) return [];
    return lodgingsFromExplorerPois(ctx.pois, stageForLodging.endCoord);
  }, [ctx.pois, stageForLodging]);

  const setPlan = (next: MultiDayPlan) => {
    state.patch({ activeMultiDayPlan: next });
  };

  if (!plan) {
    return (
      <div style={{ fontSize: 13, color: 'var(--xp-mut)' }}>
        Sélectionne d’abord un itinéraire avec géométrie chargée pour le répartir sur plusieurs jours.
      </div>
    );
  }

  const totalDistanceKm = plan.stages.reduce((acc, s) => acc + s.distanceKm, 0);
  const totalElevationGainM = plan.stages.reduce((acc, s) => acc + s.elevationGainM, 0);

  const stageForBoundary = boundaryDay != null ? plan.stages.find((s) => s.dayNumber === boundaryDay) : null;
  const nextForBoundary =
    boundaryDay != null ? plan.stages.find((s) => s.dayNumber === boundaryDay + 1) : null;

  const boundaryPreview =
    boundaryDay != null && boundaryIndex != null && stageForBoundary && nextForBoundary
      ? previewStageBoundaryMove(plan, boundaryDay, boundaryIndex, plan.revision)
      : null;

  const launchStage = (stage: StageRevision) => {
    const decision = getStageLaunchReadiness(
      plan,
      stage.dayNumber,
      { viewerId: plan.ownerId ?? null, friendIds: [], tribuIds: [], blockedUserIds: [] },
      null
    );
    if (!decision.launchable) {
      setNotice('Étape non lançable directement.');
      return;
    }
    const snapshot = trailSnapshotFromStage(plan.title, stage);
    state.setTrailRoute(snapshot);
    state.select({ kind: 'trail', id: snapshot.id }, 'trail', 'mid');
    state.showToast({
      title: `Jour ${stage.dayNumber} prêt`,
      sub: `${stage.distanceKm.toFixed(1)} km · ${plan.title}`,
      tone: 'good',
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{plan.title}</div>
          <div style={{ fontSize: 12, color: 'var(--xp-mut)' }}>
            {plan.daysCount} jours · {totalDistanceKm.toFixed(1)} km · D+ {Math.round(totalElevationGainM)} m · {plan.timezone}
          </div>
        </div>
        {!state.activeMultiDayPlan ? (
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            Jours :
            <select
              value={daysCount}
              aria-label="Nombre de jours du découpage"
              onChange={(e) => setDaysCount(Number(e.target.value))}
              style={{ height: 28, borderRadius: 8, border: '0.5px solid rgba(23,43,36,0.2)' }}
            >
              {[2, 3, 4, 5, 6, 7, 10, 14].map((d) => (
                <option key={d} value={d}>{d} j</option>
              ))}
            </select>
          </label>
        ) : (
          <button
            type="button"
            className="xp-chip"
            onClick={() => {
              const continuous = continuousRouteFromExplorer({
                id: plan.sourceRouteId ?? plan.id,
                name: plan.title,
                geojson: {
                  type: 'LineString',
                  coordinates: plan.stages.flatMap((s) => s.points.map((p) => [p.lon, p.lat])),
                },
                sport: plan.sport,
                countryCode: plan.countryCode,
                theme: plan.theme,
                timezone: plan.timezone,
                ownerId: plan.ownerId,
              });
              if (!continuous) return;
              const nextDays = Math.max(2, Math.min(14, plan.daysCount === 3 ? 4 : 3));
              setPlan(
                splitRouteIntoDays(continuous, {
                  planId: plan.id,
                  targetDays: nextDays,
                  nowIso: new Date().toISOString(),
                  publicShareConsented: plan.publicShareConsented,
                })
              );
            }}
          >
            Recalculer en {plan.daysCount === 3 ? 4 : 3} j
          </button>
        )}
      </div>

      {notice ? (
        <div role="status" style={{ fontSize: 12, color: '#166534', background: 'rgba(22,101,52,0.08)', padding: '6px 10px', borderRadius: 8 }}>
          {notice}
        </div>
      ) : null}

      {/* Cartes étapes + actions K2.30 (bornes), K2.31 (hébergement), K2.32 (démarrer cette étape) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {plan.stages.map((stage, idx) => {
          const isLast = idx === plan.stages.length - 1;
          return (
            <div
              key={stage.stageId}
              style={{
                border: '0.5px solid rgba(23,43,36,0.14)',
                borderRadius: 12,
                padding: 10,
                background: 'rgba(255,255,255,0.7)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 13 }}>
                  Jour {stage.dayNumber}
                  {stage.endLodging ? ` → ${stage.endLodging.name}` : ''}
                </strong>
                <span style={{ fontSize: 12, color: 'var(--xp-mut)' }}>
                  {stage.distanceKm.toFixed(1)} km · D+ {Math.round(stage.elevationGainM)} m · ~{stage.estimatedHours} h
                </span>
              </div>

              <div className="xp-chiprow">
                <button
                  type="button"
                  className="xp-chip"
                  onClick={() => launchStage(stage)}
                >
                  Démarrer cette étape
                </button>
                {!isLast ? (
                  <button
                    type="button"
                    className="xp-chip"
                    onClick={() => {
                      setBoundaryDay(stage.dayNumber);
                      setBoundaryIndex(stage.endPointIndex);
                      setLodgingDay(null);
                    }}
                  >
                    Ajuster la fin du jour
                  </button>
                ) : null}
                {!isLast ? (
                  <button
                    type="button"
                    className="xp-chip"
                    onClick={() => {
                      setLodgingDay(lodgingDay === stage.dayNumber ? null : stage.dayNumber);
                      setBoundaryDay(null);
                    }}
                  >
                    Ancrer à un refuge
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* K2.30 : Prévisualisation et validation d'ajustement des bornes */}
      {boundaryDay != null && stageForBoundary && nextForBoundary ? (
        <div
          style={{
            padding: 10,
            borderRadius: 12,
            background: 'rgba(47, 111, 120, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <strong style={{ fontSize: 12.5 }}>
            Déplacer la limite Jour {boundaryDay} / Jour {boundaryDay + 1}
          </strong>
          <input
            type="range"
            min={stageForBoundary.startPointIndex + 1}
            max={nextForBoundary.endPointIndex - 1}
            value={boundaryIndex ?? stageForBoundary.endPointIndex}
            onChange={(e) => setBoundaryIndex(Number(e.target.value))}
            aria-label="Position de la fin d'étape"
          />
          {boundaryPreview && !boundaryPreview.revisionConflict && boundaryPreview.dayNext ? (
            <div style={{ fontSize: 12 }}>
              Jour {boundaryDay} : {boundaryPreview.dayN.nextDistanceKm.toFixed(1)} km · Jour {boundaryDay + 1} :{' '}
              {boundaryPreview.dayNext.nextDistanceKm.toFixed(1)} km
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#B91C1C' }}>Déplacement hors limites pour ces étapes.</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="xp-primary"
              disabled={!boundaryPreview || boundaryPreview.revisionConflict || !boundaryPreview.dayNext}
              onClick={() => {
                if (boundaryIndex == null) return;
                const res = commitStageBoundaryMove(
                  plan,
                  boundaryDay,
                  boundaryIndex,
                  plan.revision,
                  new Date().toISOString(),
                );
                if (res.ok) {
                  setPlan(res.plan);
                  setBoundaryDay(null);
                  setNotice(`Limite Jour ${boundaryDay} / ${boundaryDay + 1} mise à jour.`);
                }
              }}
            >
              Valider la nouvelle étape
            </button>
            <button type="button" className="xp-chip" onClick={() => setBoundaryDay(null)}>
              Annuler
            </button>
          </div>
        </div>
      ) : null}

      {/* K2.31 : Sélecteur d'hébergement proche */}
      {lodgingDay != null ? (
        <div
          style={{
            padding: 10,
            borderRadius: 12,
            background: 'rgba(23,43,36,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <strong style={{ fontSize: 12.5 }}>Refuges et bivouacs proches (Jour {lodgingDay})</strong>
          {availableLodgings.length === 0 ? (
            <span style={{ fontSize: 12, color: 'var(--xp-mut)' }}>
              Aucun refuge ou bivouac répertorié dans la zone actuelle. Déplace la carte ou zoome près du tracé.
            </span>
          ) : (
            availableLodgings.slice(0, 6).map((lodge) => (
              <button
                key={lodge.id}
                type="button"
                className="xp-row"
                style={{ padding: '6px 8px', textAlign: 'left' }}
                onClick={() => {
                  const res = anchorStageToLodging(plan, lodgingDay, lodge, {
                    expectedPlanRevision: plan.revision,
                    nowIso: new Date().toISOString(),
                    maxSnapDistanceKm: 15,
                  });
                  if (!res.ok) {
                    setNotice(`Refuge trop éloigné du tracé (${res.reason}).`);
                    return;
                  }
                  setPlan(res.plan);
                  setLodgingDay(null);
                  setNotice(`Jour ${lodgingDay} terminé au refuge « ${lodge.name} ».`);
                }}
              >
                <span className="xp-row-title">{lodge.name}</span>
                <span className="xp-row-sub">{lodge.type === 'bivouac' ? 'Bivouac' : 'Refuge'}</span>
              </button>
            ))
          )}
          <button type="button" className="xp-chip" onClick={() => setLodgingDay(null)}>
            Fermer
          </button>
        </div>
      ) : null}
    </div>
  );
}
