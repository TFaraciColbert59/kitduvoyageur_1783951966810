// src/design/account/AccountDrawerHost.tsx
//
// Drawer « en place » de la grammaire Compte.
//
// Géométrie mesurée sur la référence Cloudflare (430 × 932, 25/10/2026 16 h 45) :
//   support  12 / 48 / 406 × 708,3  — il couvre la carte et déborde sur la carte
//            du bas (932 − 48 − 175,7), r24, overflow hidden
//   feuille  même boîte, matière §1.5 (linear-gradient 245/242/236 + blur 30)
//   poignée  capsule blanche centrée, zone de 18 px
//   nav      5 lentilles icônes, capsule 378 × 48
// La barre basse sort (opacity 0) quand le drawer est ouvert.

'use client';

import React, { useEffect, useRef } from 'react';

/** Boîte mesurée du drawer ouvert, en dur : c'est un invariant de la grammaire. */
export const DRAWER_INSET = { top: 48, left: 12, right: 12, bottom: 175.7 } as const;

export interface DrawerTab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export interface AccountDrawerHostProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Nav interne (lentilles icônes) — absente = pas de nav. */
  tabs?: DrawerTab[];
  activeTab?: string | null;
  onTabChange?: (id: string) => void;
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
  tabs,
  activeTab = null,
  onTabChange,
}: AccountDrawerHostProps) {
  const sheetRef = useRef<HTMLElement>(null);

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
      data-det={open ? 'card' : 'closed'}
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
        <div className="grab" aria-hidden="true">
          <span />
        </div>

        <div className="lkdv-sheet-body">
          <header className="lkdv-sheet-head">
            {onBack ? (
              <button type="button" className="lg gbtn" aria-label="Retour" onClick={onBack}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
            ) : null}
            <div className="lkdv-sheet-title">
              <b>{title}</b>
              {subtitle ? <span>{subtitle}</span> : null}
            </div>
            <button type="button" className="lg gbtn" aria-label="Fermer" onClick={onClose}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </header>

          {tabs && tabs.length ? (
            <div className="lkdv-drawer-nav" role="tablist" aria-label={`Volets — ${title}`} style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === t.id}
                  aria-label={t.label}
                  onClick={() => onTabChange?.(t.id)}
                >
                  {t.icon}
                </button>
              ))}
            </div>
          ) : null}

          <div className="lkdv-sheet-scroll">{children}</div>
        </div>
      </section>
    </div>
  );
}

export default AccountDrawerHost;
