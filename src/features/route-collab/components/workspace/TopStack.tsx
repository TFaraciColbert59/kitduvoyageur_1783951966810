import { AnimatePresence, motion } from 'framer-motion';
import { useRouteWorkspace } from './WorkspaceContext';

/** Pilule télémétrie / notifications éphémères (2 s) en haut d'écran. */
export function TopStack() {
  const {
    setSheetOpen,
    drawingMode,
    setDrawingMode,
    editingMode,
    setEditingMode,
    lastImpactText,
    setLastImpactText,
    statusMessage,
    setStatusMessage,
    totals,
  } = useRouteWorkspace();
  return (
    <div className="rcw-top-stack">
      <AnimatePresence mode="wait" initial={false}>
        {statusMessage ? (
          <motion.div
            key="top-status"
            className="rcw-top-toast"
            role="status"
            data-testid="status-message"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <span>{statusMessage}</span>
            <button
              type="button"
              className="xp-chip"
              onClick={() => setStatusMessage(null)}
              aria-label="Fermer le message"
            >
              ✕
            </button>
          </motion.div>
        ) : lastImpactText ? (
          <motion.div
            key="top-impact"
            className="rcw-top-toast rcw-top-toast--impact"
            role="status"
            data-testid="impact-banner"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <span>
              <strong>Impact · </strong>
              {lastImpactText}
            </span>
            <button
              type="button"
              className="xp-chip"
              onClick={() => setLastImpactText(null)}
              aria-label="Fermer l'impact"
            >
              ✕
            </button>
          </motion.div>
        ) : drawingMode ? (
          <motion.div
            key="top-draw"
            className="rcw-top-toast rcw-top-toast--mode"
            role="status"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <span>Mode tracé actif · dessinez directement sur la carte</span>
            <button
              type="button"
              className="xp-chip"
              onClick={() => {
                setDrawingMode(false);
                setSheetOpen(true);
              }}
            >
              Terminer
            </button>
          </motion.div>
        ) : editingMode ? (
          <motion.div
            key="top-edit"
            className="rcw-top-toast rcw-top-toast--mode"
            role="status"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <span>Mode édition actif · glissez les repères numérotés</span>
            <button type="button" className="xp-chip" onClick={() => setEditingMode(false)}>
              Terminer
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="top-telemetry"
            className="rcw-top-telemetry-pill"
            data-testid="top-telemetry-pill"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <span>{totals.distanceKm} km</span>
            <span className="rcw-top-telemetry-sep">·</span>
            <span>D+ {totals.ascentM != null ? `${totals.ascentM} m` : '—'}</span>
            <span className="rcw-top-telemetry-sep">·</span>
            <span>D− {totals.descentM != null ? `${totals.descentM} m` : '—'}</span>
            <span className="rcw-top-telemetry-sep">·</span>
            <span>{totals.durationMin != null ? `${totals.durationMin} min` : '—'}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
