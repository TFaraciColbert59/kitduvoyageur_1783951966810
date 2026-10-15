'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { IconButton } from '@/components/ui';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useSearchContext } from '@/contexts/SearchContext';

/** In-flow header: unlike floating fixed circles it never covers posts or
 * the iPhone status area. Uses the same menu whether logged in or not. */
export default function MobileCommunityHeader({ onSearchClick }: { onSearchClick?: () => void }) {
  const { triggerHaptic } = useHapticFeedback();
  const { openSearch } = useSearchContext();
  const [showCreate, setShowCreate] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCreate) return;
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setShowCreate(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowCreate(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showCreate]);

  return (
    <header className="lkdv-clean-community-header" aria-label="En-tête Communauté">
      <Link href="/communaute?tab=fil" className="lkdv-clean-community-title" aria-label="Accueil Communauté">
        <span className="text-[color:var(--lkv-text-primary)]">Communauté</span>
        <small>LKDV</small>
      </Link>
      <nav aria-label="Actions Communauté" className="lkdv-clean-community-header-actions">
        <div className="lkdv-clean-create-wrap" ref={menuRef}>
          <IconButton type="button" variant="ghost" aria-label="Créer" aria-expanded={showCreate}
            aria-haspopup="menu" onClick={() => { triggerHaptic('light'); setShowCreate((value) => !value); }}>
            <Icon name="plus" size={23} aria-hidden="true" />
          </IconButton>
          {showCreate && (
            <div className="lkdv-clean-create-menu" role="menu" aria-label="Créer dans LKDV">
              <Link href="/communaute/publier" role="menuitem" onClick={() => setShowCreate(false)}>Nouvelle publication</Link>
              <Link href="/carnets/nouveau" role="menuitem" onClick={() => setShowCreate(false)}>Nouveau carnet</Link>
            </div>
          )}
        </div>
        <IconButton type="button" variant="ghost" aria-label="Rechercher" onClick={() => {
          triggerHaptic('light');
          (onSearchClick || openSearch)();
        }}>
          <Icon name="search" size={23} aria-hidden="true" />
        </IconButton>
        <Link href="/messagerie" className="lkdv-clean-community-message" aria-label="Messagerie">
          <Icon name="send" size={22} aria-hidden="true" />
        </Link>
      </nav>
    </header>
  );
}
