'use client';

// Hub V4 — Bento « Plus de sections » : sur desktop la grille reste complète ;
// sur mobile les cartes secondaires quittent le bento pour un tiroir sheet
// (un clic de plus, identique en contenu — aération sans perte d'accès).
import React, { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { BentoGrid, type BentoCell } from '@/components/ui-layouts/bento-grid';
import { GlassModal } from '@/components/ui/GlassModal';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface MoreSectionsGridProps {
  cells: BentoCell[];
  moreCells: BentoCell[];
}

export function MoreSectionsGrid({ cells, moreCells }: MoreSectionsGridProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [open, setOpen] = useState(false);
  const { triggerHaptic } = useHapticFeedback();

  if (isDesktop) {
    return <BentoGrid cells={[...cells, ...moreCells]} />;
  }

  return (
    <>
      <BentoGrid cells={cells} />
      <button
        type="button"
        onClick={() => {
          triggerHaptic('light');
          setOpen(true);
        }}
        className="w-full mt-3 flex items-center gap-3 px-4 min-h-[44px] rounded-2xl border border-white/60 bg-white/55 text-left cursor-pointer active:scale-[0.99] transition-transform"
      >
        <MoreHorizontal size={18} className="text-[var(--lkv-text-secondary)]" aria-hidden="true" />
        <span className="text-sm font-semibold text-[var(--lkv-text-primary)]">Plus de sections</span>
        <span className="ml-auto rounded-full bg-[var(--lkv-primary)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--lkv-primary)]">
          {moreCells.length}
        </span>
      </button>
      <GlassModal open={open} onOpenChange={setOpen} title="Plus de sections" variant="sheet">
        <div className="pb-2">
          <BentoGrid cells={moreCells} />
        </div>
      </GlassModal>
    </>
  );
}

export default MoreSectionsGrid;
