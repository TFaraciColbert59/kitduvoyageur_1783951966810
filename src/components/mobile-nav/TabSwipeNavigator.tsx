'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { DESTINATIONS, type DestinationId } from './destinationRegistry';

/**
 * Passage d'onglet en onglet au doigt, comme sur Instagram : sur une page
 * racine de la barre du bas, glisser horizontalement transforme la page en
 * carte aux coins arrondis qui suit le doigt, sur fond noir ; la page voisine
 * arrive du bord. Relâcher au-delà d'un tiers (ou d'un geste vif) l'ouvre,
 * sinon la carte revient. La barre du bas ne bouge pas : seule sa pastille
 * suit le geste.
 *
 * Le geste ne démarre jamais sur ce qui a déjà ses propres gestes : cartes,
 * carrousels et listes défilant horizontalement, posts, champs de saisie,
 * éléments en `touch-action: pan-y | none`, ni quand un drawer est ouvert.
 */

const GAP = 10;
const RADIUS = 38;
const EDGE = 18;
const DURATION = 280;
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

const OWN_GESTURES =
  'input, textarea, select, [contenteditable="true"], video, canvas, .maplibregl-map, .leaflet-container, ' +
  '.lkdv-feed-post, .lkdv-cd, [role="dialog"], [aria-modal="true"], .lkdv-floating-tabbar, [data-no-tab-swipe]';

const OPEN_LAYERS =
  '.lkdv-cd, [aria-modal="true"], .lkdv-compte-overlay, .lkdv-drawer-layer, .lkdv-form-layer, ' +
  '#sw:not([data-det="closed"]), .story.on, .lkdv-story-composer';

/** Pages posées sur la toile du Compte : la carte voisine reprend cette toile. */
const ACCOUNT_CANVAS = new Set<DestinationId>(['community', 'messages', 'me']);

/** Fond encre entre les deux cartes (le style en ligne passe devant `html { … !important }`). */
function setBackdrop(on: boolean) {
  const root = document.documentElement.style;
  if (on) root.setProperty('background-color', 'var(--ink-900)', 'important');
  else root.removeProperty('background-color');
}

function ownsHorizontal(start: Element | null, dx: number): boolean {
  for (let el: Element | null = start; el && el !== document.body; el = el.parentElement) {
    const style = window.getComputedStyle(el);
    const touch = style.touchAction || '';
    if (touch === 'none' || touch.includes('pan-y')) return true;
    const overflowX = style.overflowX;
    if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 2) {
      const canGoRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      const canGoLeft = el.scrollLeft > 1;
      // Doigt vers la gauche (dx < 0) : le contenu défile vers la droite.
      if ((dx < 0 && canGoRight) || (dx > 0 && canGoLeft)) return true;
    }
  }
  return false;
}

function emitLens(index: number | null) {
  window.dispatchEvent(new CustomEvent('lkdv:tab-swipe', { detail: { index } }));
}

type Swipe = {
  x: number;
  y: number;
  t: number;
  target: Element | null;
  locked: boolean;
  index: number;
  width: number;
  page: HTMLElement | null;
  canvas: HTMLElement | null;
  card: HTMLElement | null;
  neighbor: number | null;
  offset: number;
  lens: number | null;
};

export default function TabSwipeNavigator() {
  const pathname = usePathname();
  const router = useRouter();
  const pending = useRef<{ card: HTMLElement; timer: number } | null>(null);

  // Arrivée de la page voisine : la carte d'attente s'efface au-dessus d'elle.
  useEffect(() => {
    const waiting = pending.current;
    if (!waiting) return;
    pending.current = null;
    window.clearTimeout(waiting.timer);
    const frame = window.requestAnimationFrame(() => {
      waiting.card.style.transition = 'opacity 140ms ease';
      waiting.card.style.opacity = '0';
      window.setTimeout(() => {
        waiting.card.remove();
        setBackdrop(false);
      }, 160);
      emitLens(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  // Re-toucher l'onglet ouvert : retour en haut, comme sur Instagram.
  useEffect(() => {
    const onReselect = () => {
      const smooth: ScrollToOptions = { top: 0, behavior: 'smooth' };
      document.querySelectorAll<HTMLElement>('.lkdv-feed-main, [data-tab-scroll]').forEach((el) => el.scrollTo(smooth));
      window.scrollTo(smooth);
    };
    window.addEventListener('lkdv:tab-reselect', onReselect);
    return () => window.removeEventListener('lkdv:tab-reselect', onReselect);
  }, []);

  useEffect(() => {
    const index = DESTINATIONS.findIndex((destination) => destination.href === pathname);
    if (index < 0) return;
    let swipe: Swipe | null = null;

    const reset = (s: Swipe) => {
      for (const el of [s.page, s.canvas]) {
        if (!el) continue;
        el.style.transition = '';
        el.style.transform = '';
        el.style.clipPath = '';
        el.style.borderRadius = '';
        el.style.minHeight = '';
        el.style.willChange = '';
      }
      s.card?.remove();
      setBackdrop(false);
      emitLens(null);
    };

    const place = (s: Swipe, offset: number, animate: boolean) => {
      const transition = animate ? `transform ${DURATION}ms ${EASE}` : '';
      const move = `translate3d(${offset}px, 0, 0)`;
      for (const el of [s.page, s.canvas]) {
        if (!el) continue;
        el.style.transition = transition;
        el.style.transform = move;
      }
      if (s.card && s.neighbor !== null) {
        const side = s.neighbor > s.index ? 1 : -1;
        s.card.style.transition = transition;
        s.card.style.transform = `translate3d(${offset + side * (s.width + GAP)}px, 0, 0)`;
      }
    };

    const begin = (s: Swipe, dx: number) => {
      s.locked = true;
      s.width = window.innerWidth;
      const next = dx < 0 ? s.index + 1 : s.index - 1;
      s.neighbor = next >= 0 && next < DESTINATIONS.length ? next : null;
      s.page = document.querySelector<HTMLElement>('[data-page-root]');
      s.canvas = document.querySelector<HTMLElement>('.lkv-app-background');
      setBackdrop(true);
      if (s.page) {
        // La page devient une carte arrondie exactement de la taille de l'écran.
        s.page.style.minHeight = '100dvh';
        s.page.style.willChange = 'transform';
        const rect = s.page.getBoundingClientRect();
        const top = Math.max(0, -rect.top);
        const bottom = Math.max(0, rect.bottom - window.innerHeight);
        s.page.style.clipPath = `inset(${top}px 0 ${bottom}px 0 round ${RADIUS}px)`;
      }
      if (s.canvas) s.canvas.style.borderRadius = `${RADIUS}px`;
      if (s.neighbor !== null) {
        const destination = DESTINATIONS[s.neighbor];
        const card = document.createElement('div');
        card.className = 'lkdv-tab-swipe-card';
        if (ACCOUNT_CANVAS.has(destination.id)) card.classList.add('is-account');
        card.setAttribute('aria-hidden', 'true');
        card.innerHTML = '<span class="lkdv-route-spinner"></span>';
        document.body.appendChild(card);
        s.card = card;
      }
    };

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || window.innerWidth >= 768 || pending.current) return;
      // Page défilée : ses éléments fixes sauteraient sous la transformation.
      if (window.scrollY > 4) return;
      const touch = event.touches[0];
      if (touch.clientX < EDGE || touch.clientX > window.innerWidth - EDGE) return;
      const target = event.target as Element | null;
      if (target?.closest(OWN_GESTURES)) return;
      if (document.querySelector(OPEN_LAYERS)) return;
      swipe = {
        x: touch.clientX,
        y: touch.clientY,
        t: performance.now(),
        target,
        locked: false,
        index,
        width: window.innerWidth,
        page: null,
        canvas: null,
        card: null,
        neighbor: null,
        offset: 0,
        lens: null,
      };
    };

    const onMove = (event: TouchEvent) => {
      const s = swipe;
      if (!s) return;
      const touch = event.touches[0];
      const dx = touch.clientX - s.x;
      const dy = touch.clientY - s.y;
      if (!s.locked) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (Math.abs(dx) < Math.abs(dy) * 1.2 || ownsHorizontal(s.target, dx)) {
          swipe = null;
          return;
        }
        begin(s, dx);
      }
      event.preventDefault();
      // Sans voisine (premier ou dernier onglet) : résistance, la carte revient.
      const wanted = s.neighbor === null ? dx * 0.28 : dx;
      s.offset = Math.max(-s.width, Math.min(s.width, wanted));
      place(s, s.offset, false);
      const lens = s.neighbor !== null && Math.abs(s.offset) > s.width / 2 ? s.neighbor : s.index;
      if (lens !== s.lens) {
        s.lens = lens;
        emitLens(lens);
      }
    };

    const onEnd = () => {
      const s = swipe;
      swipe = null;
      if (!s?.locked) return;
      const elapsed = Math.max(1, performance.now() - s.t);
      const velocity = s.offset / elapsed;
      const commit =
        s.neighbor !== null &&
        (Math.abs(s.offset) > s.width / 3 || (Math.abs(velocity) > 0.45 && Math.abs(s.offset) > 30));
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (!commit || s.neighbor === null) {
        place(s, 0, !reduce);
        window.setTimeout(() => reset(s), reduce ? 0 : DURATION + 20);
        return;
      }
      const destination = DESTINATIONS[s.neighbor];
      const side = s.neighbor > s.index ? -1 : 1;
      emitLens(s.neighbor);
      place(s, side * (s.width + GAP), !reduce);
      if (s.card && !reduce) {
        // En se posant, la carte voisine perd ses coins arrondis.
        s.card.style.transition = `transform ${DURATION}ms ${EASE}, border-radius ${DURATION}ms ${EASE}`;
        s.card.style.borderRadius = '0px';
      }
      window.setTimeout(() => {
        // La carte voisine couvre l'écran : la page suivante se monte dessous.
        const card = s.card;
        s.card = null;
        reset(s);
        if (card) {
          card.style.transition = '';
          card.style.transform = 'translate3d(0, 0, 0)';
          card.style.borderRadius = '0px';
          emitLens(s.neighbor);
          const timer = window.setTimeout(() => {
            card.remove();
            setBackdrop(false);
            pending.current = null;
            emitLens(null);
          }, 4000);
          pending.current = { card, timer };
        }
        router.push(destination.href);
      }, reduce ? 0 : DURATION);
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
      if (swipe?.locked) reset(swipe);
      swipe = null;
    };
  }, [pathname, router]);

  return null;
}
