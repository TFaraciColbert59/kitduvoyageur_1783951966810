'use client';

import { useRouteViewMode } from '../expertMode';
import { useRouteWorkspace } from '../WorkspaceContext';
import { useRoutePillModel } from './useRoutePill';

const LIGHT_NAME = { green: 'verte', orange: 'orange', red: 'rouge' } as const;

/**
 * La pilule au-dessus de la carte (3.1, 3.2, 3.5 à 3.8) : « 3 j · 42 km · 2 180 m », les jours à glisser, un
 * voyant de qualité du tracé qui ouvre le tronçon fautif, « Presque prêt · 3 points » (jamais une note) et la
 * sauvegarde dite honnêtement. Un toucher sur le résumé ouvre le tiroir.
 */
export function RoutePill({ sayOpen, onToggleSay }: { sayOpen: boolean; onToggleSay: () => void }) {
  const ws = useRouteWorkspace();
  const {
    sheetOpen,
    setSheetOpen,
    setDetent,
    setTabIndex,
    setSelectedStageId,
    setSelectedSectionId,
    setSelectedPointId,
    setFocusCoord,
    selectedStage,
    orderedPoints,
    workspace,
    openSubDrawer,
    setStatusMessage,
    canEditGeo,
  } = ws;
  const { expert } = useRouteViewMode();
  const model = useRoutePillModel(ws);

  const focusPoint = (pointId: string | undefined) => {
    const pt = pointId ? orderedPoints.find((p) => p.id === pointId) : undefined;
    if (pt) setFocusCoord([pt.lon, pt.lat]);
  };

  const openSheet = () => {
    setSheetOpen(true);
    setDetent('mid');
  };

  const onLight = () => {
    const id = model.light.firstFaultySectionId;
    const section = id ? workspace.sections.find((s) => s.id === id) : undefined;
    if (section) {
      // Un toucher ouvre le tronçon fautif : sélectionné sur la carte, détaillé dans le sous-tiroir.
      setSelectedSectionId(section.id);
      setSelectedPointId(null);
      focusPoint(section.fromPointId);
      openSubDrawer('section');
      return;
    }
    setTabIndex(0);
    openSheet();
    setStatusMessage(model.light.reasons[0] ?? model.light.text);
  };

  const onDay = (stageId: string) => {
    const st = workspace.stages.find((s) => s.id === stageId);
    setSelectedStageId(stageId);
    focusPoint(st?.startPointId);
  };

  const saveNeedsLook = model.save.kind === 'conflict' || model.save.kind === 'queued';
  const saveEl = (
    <span className="rcw-save" data-testid="save-status" data-kind={model.save.kind} title={model.save.detail}>
      {model.save.label}
    </span>
  );

  return (
    <div className="rcw-pill" data-testid="top-telemetry-pill" data-light={model.light.level} data-save={model.save.kind}>
      <div className="rcw-pill-row">
        <button
          type="button"
          className="rcw-pill-light"
          data-testid="route-light"
          data-level={model.light.level}
          aria-label={`Qualité du tracé : voyant ${LIGHT_NAME[model.light.level]}. ${model.light.text}${model.light.firstFaultySectionId ? '. Ouvrir le tronçon à vérifier' : ''}`}
          title={model.light.text}
          onClick={onLight}
        >
          <span className="rcw-light-dot" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="rcw-pill-main v5-num"
          data-testid="route-pill-summary"
          aria-label={`Itinéraire : ${model.summary}. ${sheetOpen ? 'Tiroir ouvert' : 'Ouvrir le tiroir'}`}
          onClick={openSheet}
        >
          {model.summary}
        </button>
        <button
          type="button"
          className="rcw-pill-say"
          data-testid="say-trigger"
          aria-expanded={sayOpen}
          aria-label="Dis-le : demander une modification de l’itinéraire"
          disabled={!canEditGeo}
          onClick={onToggleSay}
        >
          Dis-le
        </button>
      </div>

      {model.days.length > 0 ? (
        <div className="rcw-pill-days" role="tablist" aria-label="Jour" data-testid="pill-days">
          {model.days.map((d) => (
            <button
              key={d.id}
              type="button"
              role="tab"
              className="rcw-day-chip"
              aria-selected={selectedStage?.id === d.id}
              aria-label={d.title}
              title={d.title}
              onClick={() => onDay(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
      ) : null}

      <p className="rcw-pill-state">
        <span data-testid="readiness-status" data-label={model.readiness.label}>
          {model.readiness.text}
        </span>
        <span aria-hidden="true">·</span>
        {saveNeedsLook ? (
          <button type="button" className="rcw-save-btn" onClick={() => openSubDrawer('offline-carnet')} aria-label={`${model.save.label}. ${model.save.detail}`}>
            {saveEl}
          </button>
        ) : (
          saveEl
        )}
        {expert && model.readiness.facts ? (
          <span className="rcw-pill-facts" data-testid="readiness-facts">
            {model.readiness.facts}
          </span>
        ) : null}
      </p>
    </div>
  );
}
