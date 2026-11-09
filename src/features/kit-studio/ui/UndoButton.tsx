'use client';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useKitStore } from '../store/kitStore';

export const UNDO_LABEL = 'Annuler la dernière modification';

/**
 * ↺ (KS-006), tant qu'une annulation existe.
 *
 * Il flotte au-dessus du tiroir, sur la ligne de la pilule de poids, aligné sur le bord gauche du
 * verre — la place de l'« Annuler » de la maquette d'origine. Dans la barre basse il faisait
 * déborder la capsule des familles : cette barre (mode, points, six familles à 38 px) occupe déjà
 * toute la largeur d'un iPhone, exactement comme dans Kit_Studio_v2.html, qui n'y met pas de ↺.
 */
export function UndoButton() {
  const canUndo = useKitStore((s) => s.canUndo);
  const { haptic } = useHapticFeedback();
  if (!canUndo) return null;
  return (
    <button
      type="button"
      className="ks-undo"
      aria-label={UNDO_LABEL}
      onClick={() => {
        if (useKitStore.getState().undo()) haptic('light');
      }}
    >
      <svg viewBox="0 0 24 24" className="ks-icon" aria-hidden="true" focusable="false">
        <path d="M9 7 4.5 11.5 9 16M5 11.5h8.5a5 5 0 0 1 0 10H11" />
      </svg>
    </button>
  );
}
