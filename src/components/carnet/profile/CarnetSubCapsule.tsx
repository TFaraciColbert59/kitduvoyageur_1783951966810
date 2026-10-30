'use client';

import React from 'react';

export interface CarnetSubCapsuleItem {
  id: string;
  /** Nom accessible — jamais affiché quand la pastille porte une icône. */
  label: string;
  icon?: React.ReactNode;
}

export interface CarnetSubCapsuleProps {
  items: CarnetSubCapsuleItem[];
  /** `''` ou un id absent : aucune lentille, aucune pastille active. */
  active: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}

/**
 * Sous-sélecteur 30 px de la feuille, non flottant : il vit dans le flux, à
 * 16 px sous la poignée. Deux formes du même gabarit :
 *
 * - icônes seules (statistiques) — cellules de 41,5 × 25, largeur
 *   `3 × 41,5 + 5 = 129,5`, ancré à gauche, lentille blanche identique à celle
 *   du sélecteur de la carte, `aria-label` pour chaque icône ;
 * - libellés courts (tri des commentaires) — mêmes 30 px, même verre, la
 *   cellule active reçoit la même lentille blanche, à sa propre largeur.
 */
export function CarnetSubCapsule({ items, active, onChange, ariaLabel }: CarnetSubCapsuleProps) {
  const iconsOnly = items.length > 0 && items.every((item) => item.icon);
  const index = items.findIndex((item) => item.id === active);

  return (
    <div
      className={`ckp-sub${iconsOnly ? ' ckp-sub--icons' : ''}`}
      role="group"
      aria-label={ariaLabel}
      style={{ '--n': items.length } as React.CSSProperties}
    >
      {iconsOnly ? (
        <span
          className="ckp-th"
          aria-hidden="true"
          data-off={index < 0 ? 'true' : undefined}
          style={{ '--i': Math.max(0, index) } as React.CSSProperties}
        />
      ) : null}
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={item.id === active}
          aria-label={item.label}
          title={item.label}
          onClick={() => onChange(item.id)}
        >
          {item.icon ?? item.label}
        </button>
      ))}
    </div>
  );
}

export default CarnetSubCapsule;
