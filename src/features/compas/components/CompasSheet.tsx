'use client';

import { useEffect, useLayoutEffect, useRef, type ReactNode, type UIEvent } from 'react';
import Icon from '@/components/ui/Icon';

export type Detent = 'small' | 'medium' | 'large';

/**
 * Tiroir en verre à trois hauteurs.
 * - `small`  : un coup d'œil, environ la moitié de la zone haute (le contenu défile) ;
 * - `medium` : occupe la zone haute, s'arrête AU-DESSUS de la carte ;
 * - `large`  : recouvre l'écran du Compas.
 * La poignée se tire (haut = agrandir, bas = réduire puis fermer) ou se touche
 * (petit → moyen → grand, puis retour au moyen). Échap ferme. Le focus entre
 * dans le tiroir à l'ouverture.
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

  // Maquette finale : défiler le tiroir vers le bas réduit la barre d'onglets
  // à l'onglet actif ; remonter (ou fermer) la rend entière.
  const lastTop = useRef(0);
  const compasRoot = useRef<HTMLElement | null>(null);
  const setTabMin = (on: boolean) => {
    // La racine est mémorisée : au démontage, la ref du tiroir est déjà vide.
    const root = (compasRoot.current ??= ref.current?.closest<HTMLElement>('.compas') ?? null);
    if (!root) return;
    if (on) root.setAttribute('data-tabmin', '');
    else root.removeAttribute('data-tabmin');
  };
  useEffect(() => () => setTabMin(false), []);
  const onBodyScroll = (e: UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    if (top > 24 && top > lastTop.current + 2) setTabMin(true);
    else if (top < lastTop.current - 2 || top <= 24) setTabMin(false);
    lastTop.current = top;
  };

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
      <button
        type="button"
        className="cp-scrim"
        aria-label="Fermer le tiroir"
        tabIndex={-1}
        onClick={onClose}
      />
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
          aria-label={detent === 'large' ? 'Réduire le tiroir' : 'Agrandir le tiroir'}
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
              onDetent(detent === 'small' ? 'medium' : 'large');
            } else if (dy > 36) {
              d.moved = true;
              if (detent === 'large') onDetent('medium');
              else if (detent === 'medium') onDetent('small');
              else onClose();
            }
          }}
          onPointerUp={() => {
            const d = drag.current;
            drag.current = null;
            if (d && !d.moved)
              onDetent(detent === 'small' ? 'medium' : detent === 'medium' ? 'large' : 'medium');
          }}
        />
        {/* Maquette finale : fermer à gauche, titre centré et discret,
            plein écran à droite. Le retour, quand il existe, précède. */}
        <div className="cp-sheet__h">
          <span className="cp-sheet__side">
            {onBack && (
              <button
                type="button"
                className="cp-ibtn cp-glass"
                onClick={onBack}
                aria-label="Retour"
              >
                <Icon name="chevron-left" size={18} />
              </button>
            )}
            <button
              type="button"
              className="cp-ibtn cp-glass"
              onClick={onClose}
              aria-label="Fermer"
            >
              <Icon name="x" size={18} />
            </button>
          </span>
          <h3>{title}</h3>
          <span className="cp-sheet__side cp-sheet__side--end">
            <button
              type="button"
              className="cp-ibtn cp-glass"
              onClick={() => onDetent(detent === 'large' ? 'medium' : 'large')}
              aria-label={detent === 'large' ? 'Taille moyenne' : 'Plein écran'}
            >
              <Icon name={detent === 'large' ? 'chevron-down' : 'chevron-up'} size={18} />
            </button>
          </span>
        </div>
        <div className="cp-sheet__body" ref={body} onScroll={onBodyScroll}>
          {children}
        </div>
      </div>
    </>
  );
}
