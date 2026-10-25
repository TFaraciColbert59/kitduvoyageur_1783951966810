'use client';

import React from 'react';

export interface CarnetMediaTab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export interface CarnetMediaTabsProps {
  items: CarnetMediaTab[];
  activeIndex: number;
  onChange: (index: number) => void;
  ariaLabel: string;
}

/** Sélecteur 31 px du Compte (`.ig-tabs` + lentille `.ig-th`). */
export function CarnetMediaTabs({ items, activeIndex, onChange, ariaLabel }: CarnetMediaTabsProps) {
  return (
    <div
      className="ckp-tabs"
      role="tablist"
      aria-label={ariaLabel}
      style={{ '--n': items.length } as React.CSSProperties}
    >
      <span className="ckp-th" aria-hidden="true" style={{ '--i': activeIndex } as React.CSSProperties} />
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={index === activeIndex}
          aria-label={item.label}
          onClick={() => onChange(index)}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
}

export default CarnetMediaTabs;
