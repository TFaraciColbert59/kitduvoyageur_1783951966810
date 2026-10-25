// src/design/account/AccountDrawerHost.tsx
//
// Drawer « en place » de la grammaire Compte : il occupe exactement la boîte de
// la carte et n'ajoute aucune quatrième surface.
//
// Géométrie mesurée sur la référence (430 × 932) :
//   .sw-wrap  inset 48px 12px 342.92px 12px   (r24, overflow hidden)
//   .sheet    même boîte, r24, capsule 48 en haut
// La barre basse sort (opacity 0) quand le drawer est ouvert : c'est au shell
// de le faire, pas au drawer.
//
// Aucune valeur de matière ici : le verre vient de `.sheet` (compte-v8.css).

'use client';

import React, { useEffect, useRef } from 'react';

/** Boîte de la carte, en dur : c'est un invariant de la grammaire. */
export const DRAWER_INSET = { top: 48, left: 12, right: 12, bottom: 342.92 } as const;

export interface AccountDrawerHostProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Sous-drawer : le retour ramène au volet parent, jamais une pile invisible. */
  onBack?: () => void;
}

export function AccountDrawerHost({
  open,
  title,
  subtitle,
  onClose,
  onBack,
  children,
}: AccountDrawerHostProps) {
  const sheetRef = useRef<HTMLElement>(null);

  // Échap ferme, focus ramené sur la feuille à l'ouverture.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    sheetRef.current?.focus({ preventScroll: true });
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div
      className="sw-wrap"
      data-det={open ? 'open' : 'closed'}
      aria-hidden={open ? undefined : true}
      style={{
        inset: `${DRAWER_INSET.top}px ${DRAWER_INSET.right}px ${DRAWER_INSET.bottom}px ${DRAWER_INSET.left}px`,
        borderRadius: 24,
        overflow: 'hidden',
      }}
    >
      <div className="scrim" data-a="close" onClick={onClose} />
      <section
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{ inset: 0, borderRadius: 24 }}
      >
        <header className="sh-h hf">
          {onBack ? (
            <button type="button" className="lg gbtn" aria-label="Retour" onClick={onBack}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
          ) : null}
          <div className="sh-t">
            <b>{title}</b>
            {subtitle ? <span>{subtitle}</span> : null}
          </div>
          <button type="button" className="lg gbtn" aria-label="Fermer" onClick={onClose}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div className="sh-b">{children}</div>
      </section>
    </div>
  );
}
