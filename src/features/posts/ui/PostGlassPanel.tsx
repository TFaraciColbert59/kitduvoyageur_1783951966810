'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { isHorizontalSwipe, shouldDismiss } from '@/hooks/gestures';
import { SHEET_EXIT_MS, prefersReducedMotion } from '@/design/motion';

export interface PostGlassPanelProps {
  side: 'comments' | 'share';
  headerRef?: React.RefObject<HTMLElement | null>;
  topInset?: number;
  onClose: () => void;
  /** Conservé pour compatibilité : les gestes ne basculent plus d'un panneau à l'autre. */
  onSwitch?: (side: 'comments' | 'share') => void;
  children: React.ReactNode;
}

/**
 * Panneau verre partagé (commentaires / partage).
 *
 * - verre unique de la carte, sans seconde couche de blur ;
 * - plein cadre de la carte (406×541) ;
 * - Échap, piège de focus, restitution au déclencheur ;
 * - blur coupé pendant le geste et en reduced-motion ;
 * - gestes : partage ← photo → commentaires. Le geste inverse de celui qui a
 *   ouvert le panneau ramène à la photo (commentaires : vers la droite ; partage :
 *   vers la gauche) ; vers le bas : ferme aussi. Le panneau garde ses gestes pour
 *   lui (aucune propagation à la carte) et un geste ne déclenche qu'une action.
 */
export function PostGlassPanel({
  side,
  headerRef,
  topInset = 64,
  onClose: onClosed,
  children,
}: PostGlassPanelProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pointerStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const swipedRef = useRef(false);
  const [gesture, setGesture] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Clic fantôme iOS : le bouton « Commenter » est à l'endroit exact où le
  // champ de saisie apparaît. Pendant l'ouverture, le panneau ignore les
  // touchers et retire tout focus pris par un champ : le clavier ne s'ouvre
  // qu'à un vrai appui sur le champ, une fois le panneau posé.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const root = rootRef.current;
    const guard = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) target.blur();
    };
    root?.addEventListener('focusin', guard);
    const timer = window.setTimeout(() => {
      root?.removeEventListener('focusin', guard);
      setArmed(true);
    }, 650);
    return () => {
      window.clearTimeout(timer);
      root?.removeEventListener('focusin', guard);
    };
  }, []);
  const leaveTimer = useRef<number | null>(null);

  /* Sortie animée : le panneau repart vers le côté d'où il est venu, puis le
     parent le démonte. Sans mouvement réduit, fermeture immédiate. */
  const onClose = useCallback(() => {
    if (leaveTimer.current !== null) return;
    if (prefersReducedMotion()) {
      onClosed();
      return;
    }
    setLeaving(true);
    leaveTimer.current = window.setTimeout(() => {
      leaveTimer.current = null;
      onClosed();
    }, SHEET_EXIT_MS);
  }, [onClosed]);

  useEffect(
    () => () => {
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    },
    [],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const article = root.closest<HTMLElement>('.lkdv-feed-post');
    const header = headerRef?.current;
    if (!article || !header) {
      root.style.setProperty('--post-panel-top', `${topInset}px`);
      return;
    }

    const update = () => {
      const articleRect = article.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      const next = Math.max(56, Math.round(headerRect.bottom - articleRect.top + 8));
      root.style.setProperty('--post-panel-top', `${next}px`);
    };

    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(header);
    observer?.observe(article);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [headerRef, topInset]);

  /* Focus : entrée dans le panneau, piège de tabulation, restitution. */
  useEffect(() => {
    const root = rootRef.current;
    const previous = document.activeElement as HTMLElement | null;
    /* Le focus va au panneau lui-même, jamais au champ de saisie : le clavier
       ne s'ouvre qu'à l'appui sur « Écrire un commentaire ». */
    const focusFirst = () => {
      root?.focus?.({ preventScroll: true });
    };
    const timer = window.setTimeout(focusFirst, 20);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const surface = root?.querySelector<HTMLElement>('.lkdv-post-panel');
      const nodes = Array.from(
        (surface ?? root)?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((node) => node.getClientRects().length > 0);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || !root?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  return (
    <div
      key={side}
      ref={rootRef}
      className="lkdv-post-panel-slot"
      data-side={side}
      data-gesture={gesture ? 'true' : undefined}
      data-leaving={leaving ? 'true' : undefined}
      data-armed={armed ? 'true' : 'false'}
      tabIndex={-1}
      style={{ top: 'var(--post-panel-top, 64px)' }}
      onClickCapture={(event) => {
        // Un balayage qui démarre sur un bouton ne doit pas le déclencher au relâchement.
        if (swipedRef.current) {
          swipedRef.current = false;
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        swipedRef.current = false;
        // Seuls les champs de saisie gardent leur geste (sélection du texte) : un balayage
        // peut partir d'un bouton, d'une ligne ou d'un lien (liste de partage, commentaires).
        if ((event.target as HTMLElement).closest('input,textarea,select')) return;
        pointerStart.current = { x: event.clientX, y: event.clientY, t: performance.now() };
        setGesture(true);
      }}
      onPointerMove={(event) => {
        event.stopPropagation();
        const start = pointerStart.current;
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (isHorizontalSwipe(dx, dy)) {
          pointerStart.current = null;
          swipedRef.current = true;
          setGesture(false);
          // Retour à la photo par le geste inverse ; l'autre sens ne fait rien.
          const towardPhoto = side === 'comments' ? dx > 0 : dx < 0;
          if (towardPhoto) onClose();
        }
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        const start = pointerStart.current;
        pointerStart.current = null;
        setGesture(false);
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        const body = (event.target as HTMLElement).closest('.lkdv-post-panel-body') as HTMLElement | null;
        // Même décision de fermeture que toutes les feuilles : seuil ou flick (hooks/gestures).
        const elapsed = Math.max(1, performance.now() - start.t);
        if (dy > 0 && dy > Math.abs(dx) && shouldDismiss(dy, (dy / elapsed) * 1000) && (!body || body.scrollTop <= 0)) onClose();
      }}
      onPointerCancel={(event) => {
        event.stopPropagation();
        pointerStart.current = null;
        setGesture(false);
      }}
    >
      {children}
    </div>
  );
}

export default PostGlassPanel;
