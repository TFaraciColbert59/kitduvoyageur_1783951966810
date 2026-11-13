'use client';

/**
 * Drawer accessible générique (Lot O02-UI).
 *
 * S'appuie sur le contrat `@/features/accessibility` :
 * - `useDrawerFocusRestoration` installe le piège de focus et restaure le
 *   déclencheur à la fermeture ;
 * - `formatDrawerStateAnnouncement` / `announceToScreenReader` disent l'état
 *   du panneau aux lecteurs d'écran.
 *
 * Le composant ne remplace pas `SheetContent` (verrouillé) : il l'enveloppe
 * pour les panneaux qui doivent se comporter comme une vraie boîte de dialogue
 * modale (sous-drawers Compte/offres, confirmations, aide).
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import {
  announceToScreenReader,
  formatDrawerStateAnnouncement,
  useDrawerFocusRestoration,
} from '@/features/accessibility';
import { AccessibilityStyles } from './AccessibilityStyles';

export type AccessibleDrawerSide = 'bottom' | 'left' | 'right';

export interface AccessibleDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Ids externes si le titre/la description sont rendus hors du drawer. */
  labelledBy?: string;
  describedBy?: string;
  closeLabel?: string;
  /** Élément focalisé à l'ouverture (par défaut, le bouton Fermer). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Déclencheur à re-focaliser (par défaut, l'élément actif à l'ouverture). */
  restoreFocusTo?: HTMLElement | null;
  side?: AccessibleDrawerSide;
  /** `false` retire `aria-modal` et le piège de focus (panneau non modal). */
  modal?: boolean;
  closeOnScrimClick?: boolean;
  closeOnEscape?: boolean;
  onEscape?: () => void;
  showCloseButton?: boolean;
  /** Annonce « Panneau X ouvert » à l'ouverture (défaut : true). */
  announceOnOpen?: boolean;
  className?: string;
  bodyClassName?: string;
  style?: CSSProperties;
  testId?: string;
}

/**
 * Drawer modal avec titre, description, fermeture explicite et focus rendu.
 */
export function AccessibleDrawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  labelledBy,
  describedBy,
  closeLabel,
  initialFocusRef,
  restoreFocusTo,
  side = 'bottom',
  modal = true,
  closeOnScrimClick = true,
  closeOnEscape = true,
  onEscape,
  showCloseButton = true,
  announceOnOpen = true,
  className,
  bodyClassName,
  style,
  testId = 'accessible-drawer',
}: AccessibleDrawerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const openRef = useRef(open);
  openRef.current = open;

  const announceClosed = useCallback(() => {
    if (announceOnOpen) {
      announceToScreenReader(formatDrawerStateAnnouncement(title, false));
    }
  }, [announceOnOpen, title]);

  const requestClose = useCallback(() => {
    announceClosed();
    onCloseRef.current();
  }, [announceClosed]);

  const handleEscape = useCallback(() => {
    onEscape?.();
    if (closeOnEscape) requestClose();
  }, [closeOnEscape, onEscape, requestClose]);

  useDrawerFocusRestoration(open && modal, panelRef, {
    onEscape: handleEscape,
    initialFocus: initialFocusRef?.current ?? (showCloseButton ? closeRef.current : null),
    restoreFocusTo,
    allowTabExit: !modal,
  });

  // `useDrawerFocusRestoration` lit `initialFocus` au montage ; ce second effet
  // applique une cible personnalisée une fois la référence renseignée.
  useEffect(() => {
    if (!open || !modal) return;
    const target = initialFocusRef?.current;
    const panel = panelRef.current;
    if (!target || !panel?.contains(target)) return;
    try {
      target.focus({ preventScroll: true });
    } catch {
      target.focus?.();
    }
  }, [initialFocusRef, modal, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    if (modal) document.body.style.overflow = 'hidden';
    if (announceOnOpen) {
      announceToScreenReader(formatDrawerStateAnnouncement(title, true));
    }
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [announceOnOpen, modal, open, title]);

  // Filet de sécurité si le focus est sorti du panneau (contenu remplacé).
  useEffect(() => {
    if (!open || !modal) return;
    const onFocusIn = (event: FocusEvent) => {
      if (!openRef.current) return;
      const panel = panelRef.current;
      if (!panel) return;
      const target = event.target as Node | null;
      if (target && panel.contains(target)) return;
      const fallback = closeRef.current ?? panel;
      try {
        fallback.focus({ preventScroll: true });
      } catch {
        fallback.focus?.();
      }
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, [modal, open]);

  if (!open || typeof document === 'undefined') return null;

  const closeText = closeLabel ?? `Fermer ${title}`;
  const describedByIds = [description ? descriptionId : null, describedBy ?? null]
    .filter(Boolean)
    .join(' ');

  return createPortal(
    <div className="lkdv-a11y-root">
      <AccessibilityStyles />
      <div
        className="lkdv-a11y-scrim"
        data-side={side}
        data-testid={`${testId}-scrim`}
        onClick={(event) => {
          if (!closeOnScrimClick) return;
          if (event.target === event.currentTarget) requestClose();
        }}
      >
        <section
          ref={(node) => {
            panelRef.current = node;
          }}
          className={['lkdv-a11y-sheet', className].filter(Boolean).join(' ')}
          data-side={side}
          data-testid={testId}
          data-state="open"
          role="dialog"
          aria-modal={modal ? 'true' : undefined}
          aria-labelledby={labelledBy ?? titleId}
          aria-describedby={describedByIds || undefined}
          tabIndex={-1}
          style={style}
        >
          <header className="lkdv-a11y-sheet-head">
            <div className="lkdv-a11y-sheet-heading">
              <h2 id={titleId} className="lkdv-a11y-sheet-title">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="lkdv-a11y-sheet-desc">
                  {description}
                </p>
              ) : null}
            </div>
            {showCloseButton ? (
              <button
                ref={closeRef}
                type="button"
                className="lkdv-a11y-close"
                aria-label={closeText}
                onClick={requestClose}
              >
                <span aria-hidden="true">×</span>
              </button>
            ) : null}
          </header>
          <div className={['lkdv-a11y-sheet-body', bodyClassName].filter(Boolean).join(' ')}>
            {children}
          </div>
          {footer ? <footer className="lkdv-a11y-sheet-footer">{footer}</footer> : null}
        </section>
      </div>
    </div>,
    document.body,
  );
}

export default AccessibleDrawer;
