'use client';

import React, { useEffect, useRef } from 'react';
import Icon from '@/components/ui/Icon';
import type { SectionTabId } from './sectionTabs';

const ITEMS: Array<{ id: Exclude<SectionTabId, 'pour-toi'>; label: string; hint: string; icon: string }> = [
  { id: 'carnets', label: 'Carnets', hint: 'Lire les récits', icon: 'book-open' },
  { id: 'clubs', label: 'Clubs', hint: 'Rejoindre une cordée', icon: 'users' },
  { id: 'sorties', label: 'Sorties', hint: 'Participer au terrain', icon: 'compass' },
];

export function PourToiMenu({
  open,
  onSelect,
  onClose,
}: {
  open: boolean;
  onSelect: (id: Exclude<SectionTabId, 'pour-toi'>) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div ref={ref} className="lkdv-pourtoi-menu" role="menu" aria-label="Sections de la communauté">
      <div className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#56665D]">
        Explorer
      </div>
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            onSelect(item.id);
          }}
        >
          <span className="mi-ico" aria-hidden="true">
            <Icon name={item.icon} size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <b>{item.label}</b>
            <small>{item.hint}</small>
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export default PourToiMenu;
