'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { IconButton } from '@/components/ui';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useSearchContext } from '@/contexts/SearchContext';

/**
 * Social-first header: recognizable actions like Instagram, LKDV-owned
 * creation flows preserved. Accessible popover, no new API/backend dependency.
 */
export default function MobileCommunityHeader({ onSearchClick }: { onSearchClick?: () => void }) {
  const { triggerHaptic } = useHapticFeedback();
  const { openSearch } = useSearchContext();
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!createOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!createRef.current?.contains(event.target as Node)) setCreateOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCreateOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [createOpen]);

  return (
    <header className="lkdv-social-mobile-header">
      <Link href="/communaute?tab=fil" className="lkdv-social-brand" aria-label="Accueil Communauté LKDV">
        <span className="lkdv-social-brand-title">Communauté</span>
        <span className="lkdv-social-brand-signature">LKDV</span>
      </Link>
      <nav className="lkdv-social-header-actions" aria-label="Actions de la communauté">
        <div className="lkdv-social-create-wrap" ref={createRef}>
          <IconButton
            type="button"
            variant="ghost"
            aria-label="Créer un contenu"
            aria-expanded={createOpen}
            aria-haspopup="menu"
            onClick={() => { triggerHaptic('light'); setCreateOpen((open) => !open); }}
          >
            <Icon name="plus" size={24} aria-hidden="true" />
          </IconButton>
          {createOpen && (
            <div className="lkdv-social-create-menu" role="menu" aria-label="Choisir un contenu à publier">
              <Link href="/communaute/publier" role="menuitem" onClick={() => setCreateOpen(false)}>
                <Icon name="image" size={19} aria-hidden="true" />
                <span>Nouvelle publication</span>
              </Link>
              <Link href="/carnets/nouveau" role="menuitem" onClick={() => setCreateOpen(false)}>
                <Icon name="book-open" size={19} aria-hidden="true" />
                <span>Créer un carnet</span>
              </Link>
            </div>
          )}
        </div>
        <IconButton
          type="button"
          variant="ghost"
          aria-label="Rechercher dans la communauté"
          onClick={() => { triggerHaptic('light'); (onSearchClick || openSearch)(); }}
        >
          <Icon name="search" size={23} aria-hidden="true" />
        </IconButton>
        <Link className="lkdv-social-header-link" href="/messagerie" aria-label="Ouvrir la messagerie">
          <Icon name="send" size={23} aria-hidden="true" />
        </Link>
      </nav>
    </header>
  );
}
