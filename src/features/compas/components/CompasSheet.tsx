'use client';

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import Icon from '@/components/ui/Icon';

export type Detent = 'medium' | 'large';

/**
 * Tiroir en verre à deux hauteurs.
 * - `medium` : occupe la zone haute, s'arrête AU-DESSUS de la carte ;
 * - `large`  : recouvre l'écran du Compas.
 * La poignée se tire (haut = agrandir, bas = réduire puis fermer) ou se touche
 * (bascule). Échap ferme. Le focus entre dans le tiroir à l'ouverture.
 */
export function CompasSheet({
  title,
  detent,
  onDetent,
  onClose,
  onBack,
  children,
}: {
  title: string;
  detent: Detent;
  onDetent: (d: Detent) => void;
  onClose: () => void;
  onBack?: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; moved: boolean } | null>(null);
  const promoted = useRef(false);

  // Contenu plus haut que la hauteur moyenne (petit écran, formulaire) : le
  // tiroir s'ouvre en grand plutôt que de couper quoi que ce soit.
  useLayoutEffect(() => {
    const el = body.current;
    if (!el || detent !== 'medium' || promoted.current) return;
    if (el.scrollHeight > el.clientHeight + 1) {
      promoted.current = true;
      onDetent('large');
    }
  });

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <button type="button" className="cp-scrim" aria-label="Fermer le tiroir" tabIndex={-1} onClick={onClose} />
      <div
        ref={ref}
        className="cp-sheet cp-sheet-glass"
        data-detent={detent}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <button
          type="button"
          className="cp-sheet__grab"
          aria-label={detent === 'medium' ? 'Agrandir le tiroir' : 'Réduire le tiroir'}
          onPointerDown={(e) => {
            drag.current = { y: e.clientY, moved: false };
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || d.moved) return;
            const dy = e.clientY - d.y;
            if (dy < -36) {
              d.moved = true;
              onDetent('large');
            } else if (dy > 36) {
              d.moved = true;
              if (detent === 'large') onDetent('medium');
              else onClose();
            }
          }}
          onPointerUp={() => {
            const d = drag.current;
            drag.current = null;
            if (d && !d.moved) onDetent(detent === 'medium' ? 'large' : 'medium');
          }}
        />
        <div className="cp-sheet__h">
          {onBack && (
            <button type="button" className="cp-ibtn cp-glass" onClick={onBack} aria-label="Retour">
              <Icon name="chevron-left" size={18} />
            </button>
          )}
          <h3>{title}</h3>
          <button type="button" className="cp-ibtn cp-glass" onClick={onClose} aria-label="Fermer">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="cp-sheet__body" ref={body}>
          {children}
        </div>
      </div>
    </>
  );
}
