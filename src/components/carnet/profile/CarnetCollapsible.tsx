'use client';

import React, { useId, useState } from 'react';

export interface CarnetCollapsibleProps {
  /** En-tête de section : 10,5/600 `.08em` `#8A968D`, jamais une phrase. */
  label: string;
  /** La section commence ouverte : aucune donnée ne disparaît par défaut. */
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Section repliable de la feuille : en-tête de 44 px, chevron qui pivote de
 * 180° en 180 ms, corps ouvert par `grid-template-rows: 0fr → 1fr` — une seule
 * propriété animée, donc aucune hauteur mesurée en JS et aucun saut de mise en
 * page. Le contenu reste monté quand la section est fermée : rien n'est perdu,
 * il est seulement replié.
 */
export function CarnetCollapsible({ label, defaultOpen = true, children }: CarnetCollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <div className="ckp-collapsible">
      <button
        type="button"
        className="ckp-collapse-head"
        aria-expanded={open}
        aria-controls={`${id}-body`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="ckp-section-head">{label}</span>
        <span className="ckp-collapse-chevron" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      <div className="ckp-collapse" id={`${id}-body`} data-open={open ? 'true' : undefined}>
        <div>{children}</div>
      </div>
    </div>
  );
}

export default CarnetCollapsible;
