'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { IconButton } from '@/components/ui';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useSearchContext } from '@/contexts/SearchContext';
import { useRouter } from 'next/navigation';
import {
  hasNativeCommunityToolbar, setNativeCommunityToolbar,
  onNativeCommunityToolbarAction, presentNativeActions,
} from '@/lib/native/ui';

/**
 * Social-first header: recognizable actions like Instagram, LKDV-owned
 * creation flows preserved. Accessible popover, no new API/backend dependency.
 */
export default function MobileCommunityHeader({ onSearchClick }: { onSearchClick?: () => void }) {
  const { triggerHaptic } = useHapticFeedback();
  const { openSearch } = useSearchContext();
  const router = useRouter();
  const [nativeToolbarActive, setNativeToolbarActive] = useState(false);
  const actionsRef = useRef({ openSearch, onSearchClick, router });
  actionsRef.current = { openSearch, onSearchClick, router };

  // Hide the HTML actions ONLY after the real SwiftUI toolbar acknowledges
  // activation. A single listener owns navigation so the native shell never
  // becomes an independent router.
  useEffect(() => {
    let mounted = true;
    let removeListener: (() => Promise<void>) | undefined;
    void (async () => {
      if (!(await hasNativeCommunityToolbar()) || !mounted) return;
      const unsub = await onNativeCommunityToolbarAction(({ actionId }) => {
        const current = actionsRef.current;
        if (actionId === 'search') {
          (current.onSearchClick || current.openSearch)();
        } else if (actionId === 'messages') {
          current.router.push('/messagerie');
        } else if (actionId === 'create') {
          void presentNativeActions({
            title: 'Créer dans LKDV',
            actions: [
              { id: 'publication', title: 'Nouvelle publication' },
              { id: 'carnet', title: 'Créer un carnet' },
            ],
          }).then((choice) => {
            if (choice === 'publication' || choice === undefined)
              current.router.push('/communaute/publier');
            else if (choice === 'carnet')
              current.router.push('/carnets/nouveau');
          });
        }
      });
      if (!mounted) { await unsub?.(); return; }
      removeListener = unsub;
      if (!unsub) return;
      const active = await setNativeCommunityToolbar(true);
      if (!mounted) { void setNativeCommunityToolbar(false); return; }
      setNativeToolbarActive(active);
    })();

    return () => {
      mounted = false;
      if (removeListener) void removeListener();
      void setNativeCommunityToolbar(false);
    };
  }, []);
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!createOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!createRef.current?.contains(event.target as Node)) setCreateOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCreateOpen(false);
        createRef.current?.querySelector('button')?.focus();
      }
    };
    const focusFrame = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLAnchorElement>('[role="menuitem"]')?.focus();
    });
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [createOpen]);

  return (
    <header className="lkdv-social-mobile-header">
      <Link href="/communaute?tab=fil" className="lkdv-social-brand" aria-label="Accueil Communauté LKDV">
        <span className="lkdv-social-brand-title text-[color:var(--lkv-text-primary)]">Communauté</span>
        <span className="lkdv-social-brand-signature">LKDV</span>
      </Link>
      {!nativeToolbarActive && (
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
            <div
              ref={menuRef}
              className="lkdv-social-create-menu"
              role="menu"
              aria-label="Choisir un contenu à publier"
              onKeyDown={(event) => {
                if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
                const items = Array.from(menuRef.current?.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]') ?? []);
                if (items.length === 0) return;
                const index = items.indexOf(document.activeElement as HTMLAnchorElement);
                const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
                event.preventDefault();
                items[(next + items.length) % items.length]?.focus();
              }}
            >
              <Link href="/communaute/publier" role="menuitem" onClick={() => setCreateOpen(false)}>
                <Icon name="image-plus" size={19} aria-hidden="true" />
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
      )}
    </header>
  );
}
