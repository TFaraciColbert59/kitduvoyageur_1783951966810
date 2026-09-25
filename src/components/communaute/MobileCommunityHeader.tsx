'use client';

import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { FloatingPageControls, IconButton } from '@/components/ui';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useSearchContext } from '@/contexts/SearchContext';

/**
 * Phase 3 — plus de topbar pleine largeur : seuls deux contrôles flottent
 * (créer à gauche, recherche à droite) ; le titre vit dans le contenu.
 */
export default function MobileCommunityHeader({ onSearchClick }: { onSearchClick?: () => void }) {
  const { triggerHaptic } = useHapticFeedback();
  const { openSearch } = useSearchContext();
  return (
    <>
      <FloatingPageControls
        leading={
          <Link href="/carnets/nouveau" onClick={() => triggerHaptic('light')} className="inline-flex">
            <IconButton variant="glass" aria-label="Publier un récit">
              <Icon name="plus" size={22} aria-hidden="true" />
            </IconButton>
          </Link>
        }
        trailing={
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
        }
      />
      <div className="w-full pt-[calc(var(--safe-top)+var(--space-2)+var(--control-height-md)+var(--space-2))]">
        <span className="block font-mono text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-[0.14em] text-[color:var(--lkv-text-primary)]">
          Le kit du voyageur
        </span>
        <h1 className="text-[length:var(--lkv-text-title-lg)] font-bold leading-[var(--lkv-line-title)] tracking-[var(--lkv-tracking-title)] text-[color:var(--lkv-text-primary)]">
          Communauté
        </h1>
      </div>
    </>
  );
}
