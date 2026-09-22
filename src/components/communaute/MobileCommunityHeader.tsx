'use client';

import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { IconButton } from '@/components/ui';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useSearchContext } from '@/contexts/SearchContext';

export default function MobileCommunityHeader({ onSearchClick }: { onSearchClick?: () => void }) {
  const { triggerHaptic } = useHapticFeedback();
  const { openSearch } = useSearchContext();
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] flex w-full items-center justify-between gap-[var(--space-3)] bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] saturate-[var(--glass-sat)] lkv-rim-inset px-[var(--space-4)] pb-[var(--space-3)] pt-[calc(var(--safe-top)+var(--space-3))] backdrop-blur-[var(--glass-blur-sm)]">
      <div>
        <span className="block font-mono text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-[0.14em] text-[color:var(--lkv-text-muted)]">
          LE KIT DU VOYAGEUR
        </span>
        <h1 className="text-[length:var(--lkv-text-title-sm)] font-bold leading-[var(--lkv-line-title)] text-[color:var(--lkv-text-primary)]">
          Communauté
        </h1>
      </div>
      <div className="flex items-center gap-[var(--space-2)]">
        <IconButton
          type="button"
          variant="glass"
          aria-label="Rechercher dans la communauté"
          onClick={() => {
            triggerHaptic('light');
            (onSearchClick || openSearch)();
          }}
        >
          <Icon name="search" size={20} aria-hidden="true" />
        </IconButton>
        <Link href="/carnets/nouveau" onClick={() => triggerHaptic('light')} className="inline-flex">
          <IconButton variant="solid" aria-label="Publier un récit">
            <Icon name="plus" size={22} aria-hidden="true" />
          </IconButton>
        </Link>
      </div>
    </header>
  );
}
