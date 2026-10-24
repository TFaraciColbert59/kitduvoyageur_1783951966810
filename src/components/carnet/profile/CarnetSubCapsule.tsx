'use client';

import React from 'react';

export interface CarnetSubCapsuleItem {
  id: string;
  label: string;
}

export interface CarnetSubCapsuleProps {
  items: CarnetSubCapsuleItem[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}

/** Sous-sélecteur 30 px du Compte (`ig-tabs-float`), cellules de 30 × 26. */
export function CarnetSubCapsule({ items, active, onChange, ariaLabel }: CarnetSubCapsuleProps) {
  return (
    <div className="ckp-sub" role="group" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={item.id === active}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default CarnetSubCapsule;
