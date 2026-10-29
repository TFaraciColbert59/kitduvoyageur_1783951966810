'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Compass, House, Send, UsersRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { HUB_SWITCHER_AUTOPEN_KEY, isHubSurfacePathname } from '@/features/hub/context/adventureLists';
import {
  DESTINATIONS,
  getActiveDestinationId,
  type DestinationId,
} from './destinationRegistry';
import BottomNavReservation from './navigation/BottomNavReservation';

const TAB_ICON: Record<Exclude<DestinationId, 'me'>, typeof House> = {
  adventures: House,
  explorer: Compass,
  community: UsersRound,
  messages: Send,
};

/** Une seule fois par session : les cinq onglets sont préchargés au repos. */
let tabsWarmed = false;

/**
 * Barre du bas, Liquid Glass façon Apple Music (iOS 26/27) :
 * - capsule de verre clair flottante, icône + libellé ;
 * - pastille de verre sous l'onglet actif, qui glisse en s'étirant ;
 * - à l'appui, la pastille devient une goutte de verre qui déborde de la
 *   capsule et suit le doigt le long de la barre ; relâcher ouvre l'onglet ;
 * - l'onglet Compte montre l'avatar ; toucher l'onglet ouvert remonte en haut.
 * Changer d'onglet est instantané : les cinq pages sont préchargées.
 */
export function FloatingLiquidTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useAuth();
  const avatarUrl = profile?.avatar_url || null;

  // La pastille part vers l'onglet touché tout de suite, sans attendre la page.
  const [pendingId, setPendingId] = useState<DestinationId | null>(null);
  useEffect(() => setPendingId(null), [pathname]);
  const activeId = pendingId ?? getActiveDestinationId(pathname);
  const activeIndex = Math.max(0, DESTINATIONS.findIndex((d) => d.id === activeId));

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const lensRef = useRef<HTMLSpanElement | null>(null);
  const shownIndex = useRef(activeIndex);
  // Index affiché pendant un glisser du doigt le long de la barre (ou d'une page).
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Préchargement : tous les onglets une fois la page posée, puis à l'appui.
  useEffect(() => {
    if (tabsWarmed) return;
    tabsWarmed = true;
    const warmAll = () => DESTINATIONS.forEach((d) => router.prefetch(d.href));
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(warmAll, { timeout: 2500 });
    else window.setTimeout(warmAll, 1200);
  }, [router]);
  const warm = (href: string) => {
    if (href !== pathname) router.prefetch(href);
  };

  // Glissement de la pastille avec étirement (transform seulement).
  const lensIndex = dragIndex ?? activeIndex;
  useLayoutEffect(() => {
    const lens = lensRef.current;
    if (!lens) return;
    const from = shownIndex.current;
    const to = lensIndex;
    shownIndex.current = to;
    const target = `translateX(${to * 100}%)`;
    if (from === to || dragIndex !== null || typeof lens.animate !== 'function') {
      lens.style.transform = target;
      return;
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    lens.style.transform = target;
    if (reduce) return;
    const mid = (from + to) / 2;
    const stretch = 1 + Math.min(0.55, Math.abs(to - from) * 0.28);
    lens.animate(
      [
        { transform: `translateX(${from * 100}%) scaleX(1)` },
        { transform: `translateX(${mid * 100}%) scaleX(${stretch}) scaleY(0.92)`, offset: 0.45 },
        { transform: target },
      ],
      { duration: 380, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' },
    );
  }, [lensIndex, dragIndex]);

  // Les gestes de page (TabSwipeNavigator) pilotent aussi la pastille.
  useEffect(() => {
    const onProgress = (event: Event) => {
      const detail = (event as CustomEvent<{ index: number | null }>).detail;
      setDragIndex(detail?.index ?? null);
    };
    window.addEventListener('lkdv:tab-swipe', onProgress);
    return () => window.removeEventListener('lkdv:tab-swipe', onProgress);
  }, []);

  // Appui long sur Hub : sélecteur d'aventures (écouté par HubShell sur le Hub ;
  // ailleurs, signal consommé à l'arrivée sur /hub).
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };
  const startLongPress = () => {
    cancelLongPress();
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      if (isHubSurfacePathname(pathname)) {
        window.dispatchEvent(new CustomEvent('hub:open-switcher'));
      } else {
        try {
          sessionStorage.setItem(HUB_SWITCHER_AUTOPEN_KEY, '1');
        } catch {
          /* stockage indisponible : navigation simple */
        }
        router.push('/hub');
      }
    }, 500);
  };
  useEffect(() => cancelLongPress, []);

  const go = useCallback(
    (index: number) => {
      const destination = DESTINATIONS[index];
      if (!destination) return;
      if (destination.href === pathname) {
        // Comme Instagram : l'onglet déjà ouvert remonte en haut.
        window.dispatchEvent(new CustomEvent('lkdv:tab-reselect', { detail: { href: destination.href } }));
        return;
      }
      setPendingId(destination.id);
      router.push(destination.href);
    },
    [pathname, router],
  );

  // Appui sur la barre : la goutte de verre se pose sous le doigt et le suit ;
  // le relâcher ouvre l'onglet choisi.
  const barDrag = useRef<{ x: number; moved: boolean } | null>(null);
  const indexAt = (clientX: number) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return activeIndex;
    const ratio = (clientX - rect.left) / rect.width;
    return Math.min(DESTINATIONS.length - 1, Math.max(0, Math.floor(ratio * DESTINATIONS.length)));
  };

  return (
    <>
      <BottomNavReservation hasUpperExtension={false} hasDayPlateau={false} />
      <nav className="lkdv-floating-tabbar" aria-label="Navigation principale">
        <div
          ref={surfaceRef}
          className="lkdv-floating-tabbar-surface"
          data-dragging={dragIndex !== null ? 'true' : undefined}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            barDrag.current = { x: event.clientX, moved: false };
            setDragIndex(indexAt(event.clientX));
          }}
          onPointerMove={(event) => {
            const drag = barDrag.current;
            if (!drag) return;
            if (!drag.moved && Math.abs(event.clientX - drag.x) < 14) return;
            if (!drag.moved) {
              drag.moved = true;
              cancelLongPress();
              (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
            }
            setDragIndex(indexAt(event.clientX));
          }}
          onPointerUp={(event) => {
            const drag = barDrag.current;
            barDrag.current = null;
            if (!drag) return;
            const index = indexAt(event.clientX);
            if (longPressFired.current) {
              // Appui long sur Hub : le sélecteur d'aventures s'est ouvert.
              setDragIndex(null);
              return;
            }
            longPressFired.current = true; // le clic qui suit ne doit rien refaire
            go(index);
            setDragIndex(null);
          }}
          onPointerCancel={() => {
            barDrag.current = null;
            setDragIndex(null);
          }}
        >
          <span ref={lensRef} className="lkdv-floating-lens" aria-hidden="true" />
          {DESTINATIONS.map((destination, index) => {
            const active = index === lensIndex;
            const Icon = destination.id === 'me' ? null : TAB_ICON[destination.id];
            return (
              <Link
                key={destination.id}
                href={destination.href}
                prefetch={false}
                onPointerDown={() => {
                  longPressFired.current = false;
                  warm(destination.href);
                  if (destination.id === 'adventures') startLongPress();
                }}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onContextMenu={(event) => {
                  if (destination.id === 'adventures') event.preventDefault();
                }}
                onMouseEnter={() => warm(destination.href)}
                onClick={(event) => {
                  if (longPressFired.current) {
                    longPressFired.current = false;
                    event.preventDefault();
                    return;
                  }
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                  event.preventDefault();
                  go(index);
                }}
                aria-label={destination.ariaLabel}
                aria-current={activeId === destination.id ? 'page' : undefined}
                className={`lkdv-floating-tab${active ? ' is-active' : ''}`}
              >
                <span className="lkdv-floating-tab-icon" aria-hidden="true">
                  {Icon ? (
                    <Icon
                      size={26}
                      strokeWidth={active ? 2.4 : 1.9}
                      fill={active && destination.id === 'adventures' ? 'currentColor' : 'none'}
                    />
                  ) : avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- avatar distant, 26 px
                    <img className="lkdv-floating-avatar" src={avatarUrl} alt="" />
                  ) : (
                    <span className="lkdv-floating-avatar is-empty" />
                  )}
                </span>
                <span className="lkdv-floating-tab-label">{destination.label.fr}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export default FloatingLiquidTabBar;
