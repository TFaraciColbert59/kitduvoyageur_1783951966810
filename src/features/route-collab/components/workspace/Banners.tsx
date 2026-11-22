import { useRouteWorkspace } from './WorkspaceContext';

/** Conflit métier affiché dans le tiroir (impact & statut sont en haut d'écran). */
export function Banners() {
  const {
    activeConflict,
    setActiveConflict,
    openSubDrawer,
    runOperation,
    handleCreateDetourVariant,
  } = useRouteWorkspace();
  return (
    <>
      {activeConflict ? (
        <div className="rcw-conflict" role="alert" data-testid="conflict-modal">
          <strong>Conflit métier · {activeConflict.conflict.entityLabel}</strong>
          <span>{activeConflict.conflict.message}</span>
          <span>
            Actuel : {activeConflict.conflict.currentSummary} · Votre saisie :{' '}
            {activeConflict.conflict.yourSummary}
          </span>
          <div className="rcw-inline-actions">
            <button type="button" className="xp-secondary" onClick={() => setActiveConflict(null)}>
              Garder actuel
            </button>
            <button
              type="button"
              className="xp-primary"
              onClick={() => {
                const pending = activeConflict.pendingOp;
                setActiveConflict(null);
                void runOperation(pending, {});
              }}
            >
              Appliquer ma version
            </button>
            <button
              type="button"
              className="xp-secondary"
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
      ) : null}
    </>
  );
}
