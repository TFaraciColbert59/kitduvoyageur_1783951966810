import { conflictPositions, formatCoord, formatMeters } from '../../team';
import { useRouteWorkspace } from './WorkspaceContext';

/**
 * Conflit métier affiché dans le tiroir (impact & statut sont en haut d'écran).
 * 8.5 : sur un même point, les deux positions côte à côte, puis trois gestes dits simplement :
 * « Garder la mienne », « Garder la sienne », « Proposer ».
 */
export function Banners() {
  const {
    activeConflict,
    setActiveConflict,
    openSubDrawer,
    runOperation,
    handleCreateDetourVariant,
    handleProposeFromConflict,
    canPropose,
    workspace,
  } = useRouteWorkspace();
  if (!activeConflict) return null;
  const { conflict, pendingOp } = activeConflict;
  // `workspace` est déjà l'état courant relu après le refus : les positions « sienne » sont celles en place.
  const positions = conflictPositions(conflict, pendingOp, workspace);
  const theirName = positions?.theirName ?? conflict.currentActorName ?? null;
  return (
    <div className="rcw-conflict" role="alert" data-testid="conflict-modal">
      <strong>
        {positions
          ? `Deux positions pour ${positions.pointLabel}`
          : `Conflit sur ${conflict.entityLabel}`}
      </strong>
      <span>
        {positions
          ? `${theirName ?? 'Quelqu’un'} a déplacé ce point pendant que vous le déplaciez aussi.`
          : conflict.message}
      </span>
      {positions ? (
        <div className="rcw-conflict-sides" data-testid="conflict-sides">
          <div className="rcw-conflict-side" data-side="mine">
            <span className="rcw-conflict-cap">La mienne</span>
            <span className="rcw-conflict-val v5-num">{formatCoord(positions.mine)}</span>
          </div>
          <div className="rcw-conflict-side" data-side="theirs">
            <span className="rcw-conflict-cap">La sienne{theirName ? ` · ${theirName}` : ''}</span>
            <span className="rcw-conflict-val v5-num">{formatCoord(positions.theirs)}</span>
          </div>
          <span className="rcw-conflict-gap">
            {positions.distanceM === 0
              ? 'Même position.'
              : `${formatMeters(positions.distanceM)} d’écart entre les deux.`}
          </span>
        </div>
      ) : (
        <span>
          En place : {conflict.currentSummary} · Votre saisie : {conflict.yourSummary}
        </span>
      )}
      <div className="rcw-inline-actions">
        <button
          type="button"
          className="xp-primary rcw-tap"
          onClick={() => {
            setActiveConflict(null);
            void runOperation(pendingOp, {});
          }}
        >
          Garder la mienne
        </button>
        <button type="button" className="xp-secondary rcw-tap" onClick={() => setActiveConflict(null)}>
          Garder la sienne
        </button>
        {canPropose ? (
          <button type="button" className="xp-secondary rcw-tap" onClick={handleProposeFromConflict}>
            Proposer
          </button>
        ) : null}
        <button
          type="button"
          className="xp-secondary rcw-tap"
          onClick={() => {
            setActiveConflict(null);
            void handleCreateDetourVariant();
            openSubDrawer('variants');
          }}
        >
          Créer une variante
        </button>
      </div>
    </div>
  );
}
