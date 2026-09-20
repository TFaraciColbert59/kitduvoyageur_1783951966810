'use client';

// Hub V4 — Bento « Plus de sections » : sur desktop la grille reste complète ;
// sur mobile les cartes secondaires quittent le bento pour un tiroir sheet
// (un clic de plus, identique en contenu — aération sans perte d'accès).
import Icon from '@/components/ui/Icon';
import React, { useState } from 'react';
import { BentoGrid, type BentoCell } from '@/components/ui-layouts/bento-grid';
import { Sheet } from '@/components/ui/Sheet';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface MoreSectionsGridProps {
  cells: BentoCell[];
  moreCells: BentoCell[];
  /** grid-template-rows (desktop plein écran) — repris tel quel. */
  fitRows?: string;
}

export function MoreSectionsGrid({ cells, moreCells, fitRows }: MoreSectionsGridProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [open, setOpen] = useState(false);
  const { triggerHaptic } = useHapticFeedback();

  if (isDesktop) {
    return <BentoGrid cells={[...cells, ...moreCells]} fitRows={fitRows} />;
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
        className="glass-capsule-btn w-full mt-3 flex items-center gap-3 px-4 min-h-[44px] text-left cursor-pointer active:scale-[0.99] transition-transform"
      >
        <Icon
          name="more-horizontal"
          size={18}
          className="text-[var(--lkv-text-secondary)]"
          aria-hidden="true"
        />
        <span className="text-sm font-semibold text-[var(--lkv-text-primary)]">
          Plus de sections
        </span>
        <span className="ml-auto rounded-full bg-[var(--lkv-primary)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--lkv-primary)]">
          {moreCells.length}
        </span>
      </button>
      <Sheet open={open} onOpenChange={setOpen} title="Plus de sections">
        <div className="pb-2">
          <BentoGrid cells={moreCells} />
        </div>
      </Sheet>
    </>
  );
}

export default MoreSectionsGrid;
