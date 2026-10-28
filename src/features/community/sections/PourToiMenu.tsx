'use client';

import React, { useEffect, useRef } from 'react';
import type { SectionTabId } from './CommunityTabSelector';
import { LKDVIcon } from '@/components/ui/LKDVIcon';
import type { LKDVIconName } from '@/components/ui/LKDVIcon';

const ITEMS: Array<{ id: Exclude<SectionTabId, 'pour-toi'>; label: string; hint: string; icon: LKDVIconName }> = [
  { id: 'carnets', label: 'Carnets', hint: 'Lire les récits', icon: 'preparateur' },
  { id: 'clubs', label: 'Clubs', hint: 'Rejoindre une cordée', icon: 'communaute' },
  { id: 'sorties', label: 'Sorties', hint: 'Participer au terrain', icon: 'boussole' },
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
            <LKDVIcon name={item.icon} size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <b>{item.label}</b>
            <small>{item.hint}</small>
          </span>
          <LKDVIcon name="suivant" size={14} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export default PourToiMenu;
