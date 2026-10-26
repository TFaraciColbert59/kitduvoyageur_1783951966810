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
// Deux variantes :
//   `floating` (défaut) — la boîte fixe ci-dessus.
//   `card` — se cale sur la carte de la page (`#card`), bord à bord, avec la
//   languette et l'animation `.sw-wrap[data-det="card"].in` du Compte.
//
// Aucune valeur de matière ici : le verre vient de `.sheet` (compte-v8.css).

'use client';

import React, { useEffect, useRef, useState } from 'react';

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
  /**
   * `floating` (défaut) : boîte fixe de la grammaire.
   * `card` : drawer superposé à la carte `#card` de la page, languette en
   * haut et animation d'ouverture/fermeture identique au Compte.
   */
  variant?: 'floating' | 'card';
}

export function AccountDrawerHost({
  open,
  title,
  subtitle,
  onClose,
  onBack,
  children,
  variant = 'floating',
}: AccountDrawerHostProps) {
  const sheetRef = useRef<HTMLElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; left: number; right: number; bottom: number }>({
    top: DRAWER_INSET.top,
    left: DRAWER_INSET.left,
    right: DRAWER_INSET.right,
    bottom: DRAWER_INSET.bottom,
  });

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

  // Variante carte : on mesure la carte de la page pour s'y superposer
  // exactement (elle bouge avec le clavier et la hauteur du shell).
  useEffect(() => {
    if (variant !== 'card') return;
    const measure = () => {
      const card = document.getElementById('card');
      const phone = card?.closest('.phone') as HTMLElement | null;
      if (!card || !phone) return;
      const c = card.getBoundingClientRect();
      const p = phone.getBoundingClientRect();
      setBox({
        top: Math.max(0, c.top - p.top),
        left: Math.max(0, c.left - p.left),
        right: Math.max(0, p.right - c.right),
        bottom: Math.max(0, p.bottom - c.bottom),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    const card = document.getElementById('card');
    if (card) observer.observe(card);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [variant, open]);

  // Variante carte : l'animation Compte attend le `.in` posé après montage.
  useEffect(() => {
    if (variant !== 'card') return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (!open) {
      wrap.classList.remove('in');
      return;
    }
    const frame = requestAnimationFrame(() => wrap.classList.add('in'));
    return () => cancelAnimationFrame(frame);
  }, [open, variant]);

  const isCard = variant === 'card';

  return (
    <div
      ref={wrapRef}
      className="sw-wrap"
      data-det={open ? (isCard ? 'card' : 'open') : 'closed'}
      aria-hidden={open ? undefined : true}
      style={
        isCard
          ? {
              ['--card-top' as string]: `${box.top}px`,
              ['--card-left' as string]: `${box.left}px`,
              ['--card-right' as string]: `${box.right}px`,
              ['--card-bottom' as string]: `${box.bottom}px`,
              ['--card-radius' as string]: '26px',
            }
          : {
              inset: `${DRAWER_INSET.top}px ${DRAWER_INSET.right}px ${DRAWER_INSET.bottom}px ${DRAWER_INSET.left}px`,
              borderRadius: 24,
              overflow: 'hidden',
            }
      }
    >
      <div className="scrim" data-a="close" onClick={onClose} />
      <section
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{ inset: 0, borderRadius: isCard ? 26 : 24 }}
      >
        {isCard ? (
          <span className="grab" aria-hidden="true">
            <span />
          </span>
        ) : null}
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
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div className="sh-b">{children}</div>
      </section>
    </div>
  );
}
