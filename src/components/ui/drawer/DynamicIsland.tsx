'use client';

import React, { useEffect, useRef } from 'react';

export interface DynamicIslandUndo {
  /** Libellé du bouton d'annulation (défaut : « Annuler »). */
  label?: string;
  onUndo: () => void;
}

export interface DynamicIslandAction {
  label: string;
  onAction: () => void;
}

export interface DynamicIslandProps {
  open: boolean;
  title: string;
  subtitle?: string;
  /** Action réversible : bouton « Annuler » qui déclenche `onUndo`. */
  undo?: DynamicIslandUndo;
  /** Action principale optionnelle (Voir, Partager, Ouvrir la page…). */
  action?: DynamicIslandAction;
  /** Appelé au repos (3800 ms par défaut), ou après une action. */
  onClose: () => void;
  /** Durée de vie de la confirmation, en ms (défaut : 3800). */
  durationMs?: number;
}

/**
 * Île dynamique de confirmation réutilisable (inspirée de `CarnetIsland`).
 *
 * - `position: fixed` centrée en haut de l'écran (top 5 px, largeur 366 px,
 *   rayon 21 px), au-dessus des tiroirs via `--cv2-z-island` (couche toast).
 * - `role="status"` + `aria-live="polite"` : l'annonce est faite une fois.
 * - Action principale optionnelle et bouton « Annuler » si l'action est
 *   réversible ; repos automatique après `durationMs` (3800 ms).
 * - `prefers-reduced-motion` : fondu court, sans ressort ni translation.
 *
 * Le CSS est auto-injecté (même motif que `DRAWER_SHELL_CSS`) : la primitive
 * reste utilisable hors de la feuille `communaute-v2.css` (/compte, carnet).
 */
export function DynamicIsland({
  open,
  title,
  subtitle,
  undo,
  action,
  onClose,
  durationMs = 3800,
}: DynamicIslandProps) {
  // La référence évite de réarmer le minuteur à chaque rendu du parent.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      onCloseRef.current();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, open, subtitle, title]);

  if (!open) return null;

  return (
    <div className="lkdv-island-host">
      <style dangerouslySetInnerHTML={{ __html: DYNAMIC_ISLAND_CSS }} />
      <div
        className="lkdv-island-pill"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="cv2-island"
      >
        <span className="lkdv-island-text">
          <b className="lkdv-island-title">{title}</b>
          {subtitle ? <span className="lkdv-island-sub">{subtitle}</span> : null}
        </span>
        {undo || action ? (
          <span className="lkdv-island-actions">
            {undo ? (
              <button
                type="button"
                className="lkdv-island-btn"
                onClick={() => {
                  undo.onUndo();
                  onClose();
                }}
              >
                {undo.label ?? 'Annuler'}
              </button>
            ) : null}
            {action ? (
              <button
                type="button"
                className="lkdv-island-btn is-primary"
                onClick={() => {
                  action.onAction();
                  onClose();
                }}
              >
                {action.label}
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * CSS auto-injecté de l'île. Aucun hexadécimal, aucune courbe littérale :
 * uniquement les jetons `--cv2-island-*`, `--lkv-*` et `--ease-*`/`--motion-*`.
 */
export const DYNAMIC_ISLAND_CSS = `
.lkdv-island-host{position:fixed;top:5px;left:0;right:0;z-index:var(--cv2-z-island,70);display:flex;justify-content:center;pointer-events:none;padding:0 8px;box-sizing:border-box;}
.lkdv-island-pill{display:flex;align-items:center;justify-content:space-between;gap:10px;width:min(366px,100%);min-height:41px;padding:4px 10px 4px 14px;border-radius:21px;background:var(--cv2-island-bg);color:var(--cv2-island-ink);box-shadow:var(--cv2-island-shadow);pointer-events:auto;box-sizing:border-box;transform-origin:top center;animation:lkdv-island-in .32s var(--ease-spring) both;}
.lkdv-island-text{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:1px;}
.lkdv-island-title{display:block;font:600 11.5px/1.15 var(--font-sans);color:var(--cv2-island-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lkdv-island-sub{display:block;font:500 10px/1.15 var(--font-sans);color:var(--cv2-island-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lkdv-island-actions{flex:none;display:flex;align-items:center;gap:6px;}
.lkdv-island-btn{position:relative;height:28px;min-width:44px;padding:0 11px;border:0;border-radius:999px;background:var(--cv2-island-btn-bg);color:var(--cv2-island-btn-ink);font:600 12.5px/1 var(--font-sans);cursor:pointer;white-space:nowrap;}
.lkdv-island-btn::after{content:"";position:absolute;inset:-8px -6px;}
.lkdv-island-btn.is-primary{background:var(--cv2-island-action-bg);color:var(--cv2-island-action-ink);}
.lkdv-island-btn:active{transform:scale(.96);transition:transform .12s var(--ease-spring);}
.lkdv-island-btn:focus-visible{outline:2px solid var(--cv2-island-action-bg);outline-offset:2px;}
@keyframes lkdv-island-in{from{opacity:0;transform:translateY(-8px) scale(.96);}to{opacity:1;transform:none;}}
@media(prefers-reduced-motion:reduce){.lkdv-island-pill{animation:none;}.lkdv-island-btn:active{transition:none;}}
`;

export default DynamicIsland;
