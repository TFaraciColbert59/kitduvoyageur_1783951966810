'use client';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import Icon from '@/components/ui/Icon';
import { CapsuleTabs, type CapsuleTabItem } from '@/components/ui/CapsuleTabs';
import { LensPager } from '@/components/ui/drawer/LensPager';
import { SortMenuButton, type SortOption } from '@/components/ui/drawer/SortMenuButton';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { zIndex } from '@/lib/ui/zIndex';
import { SheetPreviewSlot } from './SheetPreview';

/** Durée de l'entrée du tiroir (/compte : `.72s var(--ease-out)`). */
export const SHEET_ENTER_MS = 720;
/** Durée de la sortie (/compte : `.56s`, démontage à 570 ms). */
export const SHEET_EXIT_MS = 560;
/** Seuil de fermeture par glissement : 30 % de la hauteur… */
export const SHEET_DRAG_CLOSE_RATIO = 0.3;
/** …ou 0,55 px/ms de vélocité (`00-MISSION` § 3, coque `/compte`). */
export const SHEET_DRAG_CLOSE_VELOCITY = 0.55;

export interface SheetCapsuleItem {
  id: string;
  /** Libellé lu par les lecteurs d'écran (icône seule à l'écran). */
  label: string;
  icon: ReactNode;
}

export interface SheetMiniCapsule {
  items: SheetCapsuleItem[];
  active: number;
  onChange: (index: number) => void;
  label: string;
  /**
   * Contenu par mini-onglet, indexé par volet/type de la capsule :
   * `mini.pages[capsule.active][mini.active]`. Quand cette prop est fournie,
   * le glisser horizontal change de **filtre/étape** (mini-capsule), jamais de
   * volet/type — conforme à `00-MISSION § 3` (`LensPager` entre filtres).
   * Sans elle, l'ancien comportement (glisser entre volets) est conservé.
   */
  pages?: ReactNode[][];
  /** Bouton de tri (Carnets, Clubs) : masqué en Recherche/Sorties. */
  sort?: {
    value: string;
    defaultValue: string;
    options: SortOption[];
    onChange: (value: string) => void;
  };
}

export interface SheetDetail {
  pages: ReactNode[];
  index: number;
  onIndexChange?: (index: number) => void;
  /** Titre affiché dans la barre du détail (`‹ Retour` à gauche). */
  title: string;
  /** Méta à droite (ex. « 1 / 8 », « /sorties/s3 »). */
  meta?: string;
  label?: string;
  onBack: () => void;
}

export interface CommunitySheetShellProps {
  open: boolean;
  onClose: () => void;
  /** Nom accessible du dialogue (ex. « Explorer la communauté »). */
  label: string;
  capsule: {
    items: SheetCapsuleItem[];
    active: number;
    onChange: (index: number) => void;
    ariaLabel?: string;
  };
  mini?: SheetMiniCapsule | null;
  /** Barre de validation du formulaire (Création) : reste collée en bas. */
  footer?: ReactNode;
  /** Une pane par élément de la capsule : glisser horizontal = LensPager. */
  panes: ReactNode[];
  detail?: SheetDetail | null;
  /** Vrai si une couche interne (menu, peek, confirmation) doit consommer Échap. */
  onEscape?: () => boolean;
  /** Contenu additionnel dans la couche (peek, confirmation, île locale…). */
  children?: ReactNode;
  /** Réinitialisation de l'état interne quand le tiroir change de nature. */
  resetKey?: string;
  className?: string;
  /** Île de confirmation/annulation rendue hors du tiroir (au-dessus). */
  island?: ReactNode;
  /** Nature du tiroir : pose `data-testid="communaute-v2-<kind>"` sur la couche. */
  kind?: 'explore' | 'create';
  /**
   * FID-077 — vrai quand l'utilisateur n'est pas connecté (ou anonyme) : pose
   * une pilule « Mode invité · lecture seule » sous la capsule, hors du corps
   * défilant et hors du détail empilé. Testable : `data-testid="cv2-guest-mode"`,
   * `role="status"`.
   */
  guestNotice?: boolean;
  /**
   * FID-056 — cible de l'**aperçu vivant** : quand ce callback est fourni, la
   * coque rend un emplacement `150 px` entre la capsule et le pager (hors du
   * défilement). Les formulaires y portent leur aperçu via `SheetPreview`.
   * L'emplacement disparaît quand un détail est empilé (le formulaire n'est
   * plus à l'écran).
   */
  previewSlotRef?: (element: HTMLDivElement | null) => void;
  /** Contenu statique au-dessus du pager (ex: barre de recherche ou agenda). */
  staticSlot?: ReactNode;
  /** Plafonne le tiroir à 40% de hauteur en mode Recherche. */
  compactSearch?: boolean;
  initialDetent?: 'card' | 'large';
  hideCapsule?: boolean;
  hideDetailTitle?: boolean;
  showClose?: boolean;
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function focusableWithin(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((node) => node.getClientRects().length > 0);
}

/**
 * Coque commune des tiroirs Explorer et Création — traduction React de la coque
 * `/compte` (`SlotShell` + `DrawerShell` + `LensPager` + pile de détails) :
 * carte clippée, capsule 56 px, mini-capsule 30 px + bouton de tri, poignée avec
 * rubber-band, fond inerte, pas de voile, Échap ordonné, piège de focus.
 *
 * Le fond de page est rendu `inert` + `aria-hidden` pendant l'ouverture (valeurs
 * précédentes restaurées à la fermeture), le focus est rendu au déclencheur.
 */
export function CommunitySheetShell({
  open,
  onClose,
  label,
  capsule,
  mini = null,
  footer = null,
  panes,
  detail = null,
  onEscape,
  children,
  resetKey,
  className,
  island = null,
  kind,
  guestNotice = false,
  previewSlotRef,
  staticSlot = null,
  compactSearch = false,
  initialDetent = 'card',
  hideCapsule = false,
  hideDetailTitle = false,
  showClose = false,
}: CommunitySheetShellProps) {
  const { haptic } = useHapticFeedback();
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<'opening' | 'open' | 'closing'>('opening');
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [detent, setDetent] = useState<'card' | 'large'>(initialDetent);
  const [scrolled, setScrolled] = useState(false);
  const [edgeBackX, setEdgeBackX] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  const layerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startX: number;
    startAt: number;
    height: number;
    fromScrollTop?: boolean;
  } | null>(null);
  const edgeSwipeRef = useRef<{ pointerId: number; startX: number; startY: number } | null>(null);

  // ── prefers-reduced-motion ────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener?.('change', sync);
    return () => query.removeEventListener?.('change', sync);
  }, []);

  // ── Ouverture / sortie animée ─────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setDetent(initialDetent);
      openerRef.current = (document.activeElement as HTMLElement | null) ?? null;
      setMounted(true);
      setState('opening');
      let frame2 = 0;
      const frame1 = window.requestAnimationFrame(() => {
        frame2 = window.requestAnimationFrame(() => setState('open'));
      });
      return () => {
        window.cancelAnimationFrame(frame1);
        window.cancelAnimationFrame(frame2);
      };
    }
    if (!mounted) return;
    setState('closing');
    setDragY(0);
    setDragging(false);
    // Restitution du focus au déclencheur. Le fond n'est rendu focusable qu'APRÈS
    // le nettoyage de l'effet `inert` (commit React suivant) : un focus synchrone
    // serait un no-op silencieux. On le diffère d'une frame, puis on réessaie
    // quelques fois si le navigateur (WebKit) n'a pas encore acheté le commit :
    // sans ces reprises, le focus restait sur `body` dans Safari iOS.
    const retryTimers: number[] = [];
    const restoreOpenerFocus = (attempt: number) => {
      const opener = openerRef.current;
      if (!opener || !document.contains(opener)) return;
      if (document.activeElement === opener) return;
      opener.focus({ preventScroll: true });
      if (document.activeElement !== opener && attempt < 4) {
        retryTimers.push(
          window.setTimeout(() => restoreOpenerFocus(attempt + 1), 40 * (attempt + 1)),
        );
      }
    };
    const timeout = window.setTimeout(
      () => {
        setMounted(false);
        setState('opening');
        window.requestAnimationFrame(() => restoreOpenerFocus(0));
      },
      reducedMotion ? 0 : SHEET_EXIT_MS,
    );
    return () => {
      window.clearTimeout(timeout);
      retryTimers.forEach((timer) => window.clearTimeout(timer));
    };
    // `mounted` est volontairement hors dépendances : sinon la sortie se relance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reducedMotion, initialDetent]);

  // Un changement de nature (Explorer <-> Création) remonte la position de drag.
  useEffect(() => {
    setDragY(0);
  }, [resetKey]);

  // ── Fond inerte + verrou de scroll ────────────────────────────────────────
  useEffect(() => {
    if (!mounted || typeof document === 'undefined') return;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    const layer = layerRef.current;
    const saved: Array<{ el: Element; inert: boolean; ariaHidden: string | null }> = [];
    Array.from(body.children).forEach((el) => {
      if (el === layer) return;
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'TEMPLATE') return;
      const html = el as HTMLElement;
      saved.push({ el, inert: html.inert, ariaHidden: el.getAttribute('aria-hidden') });
      html.inert = true;
      el.setAttribute('aria-hidden', 'true');
    });
    return () => {
      saved.forEach(({ el, inert, ariaHidden }) => {
        (el as HTMLElement).inert = inert;
        if (ariaHidden == null) el.removeAttribute('aria-hidden');
        else el.setAttribute('aria-hidden', ariaHidden);
      });
      body.style.overflow = previousOverflow;
    };
  }, [mounted]);

  // ── Focus initial ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted || !open) return;
    const frame = window.requestAnimationFrame(() => {
      const sheet = sheetRef.current;
      if (!sheet) return;
      const target =
        sheet.querySelector<HTMLElement>('[data-cv2-autofocus]') ??
        sheet.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') ??
        sheet;
      target.focus?.({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mounted, open]);

  // ── Échap ordonné + piège de focus ────────────────────────────────────────
  const requestClose = useCallback(() => {
    if (state === 'closing') return;
    haptic('medium');
    onClose();
  }, [haptic, onClose, state]);

  // `useLayoutEffect` : le niveau actif (menu → peek → confirmation → détail →
  // tiroir) peut changer dans la même frame qu'un appui Échap ; poser l'écouteur
  // avant la peinture évite une frame sans gestionnaire où Échap ne serait pas
  // consommé (constat e2e 11a).
  useLayoutEffect(() => {
    if (!mounted || !open || typeof document === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Les couches internes (menu de tri, peek, confirmation) coupent la
        // propagation avant d'ici ; `onEscape` est le filet de sécurité.
        if (onEscape?.()) {
          event.preventDefault();
          return;
        }
        if (detail) {
          event.preventDefault();
          haptic('light');
          detail.onBack();
          return;
        }
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = focusableWithin(sheetRef.current);
      if (!nodes.length) {
        event.preventDefault();
        sheetRef.current?.focus();
        return;
      }
      const first = nodes[0] as HTMLElement;
      const last = nodes[nodes.length - 1] as HTMLElement;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === sheetRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [detail, haptic, mounted, onEscape, open, requestClose]);

  // ── Glissement vertical de fermeture / detent (poignée / barre / scrollTop === 0) ──
  const onDragStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!open || state === 'closing') return;
      if (event.button > 0) return;
      const target = event.target as Element | null;
      if (target?.closest('button, a, input, textarea, select, [role="tab"], [data-cv2-nodrag]')) return;
      const height = sheetRef.current?.getBoundingClientRect().height ?? 0;
      dragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startX: event.clientX,
        startAt: performance.now(),
        height,
      };
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* capture optionnelle (Safari ancien, tests) */
      }
    },
    [open, state],
  );

  const onBodyPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!open || state === 'closing') return;
      if (event.button > 0) return;
      const target = event.target as Element | null;
      if (target?.closest('button, a, input, textarea, select, [role="tab"], [data-cv2-nodrag]')) return;
      const scrollHost = target?.closest('.lkdv-cv2-pane, .lkdv-cv2-detail-body') as HTMLElement | null;
      if (scrollHost && scrollHost.scrollTop > 2) return;
      const height = sheetRef.current?.getBoundingClientRect().height ?? 0;
      dragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startX: event.clientX,
        startAt: performance.now(),
        height,
        fromScrollTop: true,
      };
    },
    [open, state],
  );

  const onDragMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dy = event.clientY - drag.startY;
      const dx = event.clientX - drag.startX;
      if (drag.fromScrollTop) {
        if (dy <= 6 || Math.abs(dy) <= Math.abs(dx) * 1.2) {
          if (dy < -8) dragRef.current = null;
          return;
        }
      }
      const raw = Math.max(0, dy);
      if (raw > 4 && !dragging) setDragging(true);
      const knee = drag.height * 0.35;
      const banded = raw <= knee ? raw : knee + (raw - knee) * 0.35;
      setDragY(banded);
      if (banded > 4 && event.cancelable) event.preventDefault();
    },
    [dragging],
  );

  const onDragEnd = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      const dy = event.clientY - drag.startY;
      // Glisser vers le haut sur la poignée étend la feuille en pleine hauteur (`large`)
      if (!drag.fromScrollTop && dy < -48 && detent === 'card') {
        setDragging(false);
        setDragY(0);
        setDetent('large');
        haptic('selection');
        return;
      }
      const raw = Math.max(0, dy);
      const elapsed = Math.max(1, performance.now() - drag.startAt);
      const velocity = raw / elapsed;
      const shouldClose =
        raw > drag.height * SHEET_DRAG_CLOSE_RATIO || velocity > SHEET_DRAG_CLOSE_VELOCITY;
      setDragging(false);
      if (raw > 8) haptic(shouldClose ? 'medium' : 'selection');
      if (shouldClose) {
        if (detent === 'large' && raw < drag.height * 0.55 && velocity <= SHEET_DRAG_CLOSE_VELOCITY) {
          setDetent('card');
          setDragY(0);
        } else {
          requestClose();
        }
      } else {
        setDragY(0);
      }
    },
    [detent, haptic, requestClose],
  );

  // ── Edge-swipe bord gauche pour dépiler une vue détail d'une main ────────
  const onDetailPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!detail || event.button > 0) return;
      const rect = sheetRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (event.clientX - rect.left <= 28) {
        edgeSwipeRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
      }
    },
    [detail],
  );

  const onDetailPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const sw = edgeSwipeRef.current;
    if (!sw || sw.pointerId !== event.pointerId) return;
    const dx = Math.max(0, event.clientX - sw.startX);
    const dy = Math.abs(event.clientY - sw.startY);
    if (dy > 32 && dx < 24) {
      edgeSwipeRef.current = null;
      setEdgeBackX(0);
      return;
    }
    if (dx > 8) setEdgeBackX(Math.min(120, dx * 0.6));
  }, []);

  const onDetailPointerEnd = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const sw = edgeSwipeRef.current;
      if (!sw || sw.pointerId !== event.pointerId) return;
      edgeSwipeRef.current = null;
      const dx = event.clientX - sw.startX;
      const dy = Math.abs(event.clientY - sw.startY);
      setEdgeBackX(0);
      if (detail && dx >= 56 && dx > dy * 1.4) {
        haptic('light');
        detail.onBack();
      }
    },
    [detail, haptic],
  );

  const onSheetScrollCapture = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target || typeof target.scrollTop !== 'number') return;
    if (target.classList.contains('lkdv-cv2-pane') || target.classList.contains('lkdv-cv2-detail-body')) {
      setScrolled(target.scrollTop > 6);
    }
  }, []);

  const sheetStyle = useMemo<CSSProperties>(() => {
    if (dragY <= 0 && !dragging) return {};
    return {
      transform: `translateY(${dragY}px)`,
      transition: dragging ? 'none' : 'transform .34s var(--motion-ease-standard)',
    };
  }, [dragY, dragging]);

  if (!mounted || typeof document === 'undefined') {
    return island ? <>{island}</> : null;
  }

  const capsuleItems: CapsuleTabItem[] = capsule.items.map((item) => ({
    id: item.id,
    label: item.label,
    icon: item.icon,
  }));
  const paneId = (id: string) => `cv2-pane-${id}`;
  const detailPages = detail?.pages ?? [];
  const detailCount = detailPages.length;
  const showCapsule = !detail && !hideCapsule;
  // Le LensPager suit les filtres/étapes (mini-capsule) quand `mini.pages` est
  // fourni ; sinon il conserve le glisser entre volets (compatibilité).
  const filterPages = mini?.pages?.[capsule.active] ?? null;
  const activePaneIndex = filterPages ? mini?.active ?? 0 : capsule.active;
  const onActivePaneChange = filterPages ? mini?.onChange ?? (() => {}) : capsule.onChange;
  const activeVoletItem = capsule.items[capsule.active];

  const shell = (
    <div
      ref={layerRef}
      className={cx('lkdv-communaute-v2', 'lkdv-cv2-layer', className)}
      style={{ '--cv2-layer-z': zIndex.modal } as CSSProperties}
      data-state={state}
      data-cv2-kind={kind}
      data-testid={kind ? `communaute-v2-${kind}` : 'communaute-v2-sheet'}
      onClick={(e) => {
        const target = e.target as Node | null;
        if (!target || !sheetRef.current) return;
        if (sheetRef.current.contains(target)) return;
        if (target instanceof Element && target.closest('.lkdv-cv2-island-layer, .lkdv-cv2-peek')) return;
        onClose();
      }}
    >
      <div
        className="lkdv-cv2-wrap"
        data-det="card"
        data-detent={detent}
        data-search-compact={compactSearch ? 'true' : undefined}
        data-state={state}
      >
        <div
          ref={sheetRef}
          className="lkdv-cv2-sheet"
          data-testid="cv2-sheet"
          data-dragging={dragging ? 'true' : undefined}
          data-scrolled={scrolled ? 'true' : undefined}
          role="dialog"
          aria-modal={state === 'closing' ? undefined : 'true'}
          aria-label={label}
          tabIndex={-1}
          style={sheetStyle}
          onScrollCapture={onSheetScrollCapture}
        >
          <div
            className={cx('lkdv-cv2-grab', showClose && 'lkdv-cv2-grab--with-close')}
            data-cv2-drag
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            onDoubleClick={() => {
              setDetent((prev) => (prev === 'card' ? 'large' : 'card'));
              haptic('selection');
            }}
            aria-hidden="true"
          >
            <span />
          </div>

          {showCapsule ? (
            <div
              className="lkdv-cv2-topnav"
              data-testid="cv2-capsule"
              data-cv2-drag
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
            >
              <CapsuleTabs
                items={capsuleItems}
                activeIndex={capsule.active}
                onIndexChange={capsule.onChange}
                ariaLabel={capsule.ariaLabel ?? label}
                className="lkdv-cv2-capsule"
                idFor={(id) => `cv2-tab-${id}`}
                panelIdFor={paneId}
              />
            </div>
          ) : null}

          {guestNotice && !detail ? (
            <p className="lkdv-cv2-guest" role="status" data-testid="cv2-guest-mode">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="5.5" y="10.5" width="13" height="9" rx="2.4" />
                <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
              </svg>
              <span>Mode invité · lecture seule</span>
            </p>
          ) : null}

          {/* FID-056 : emplacement fixe de l'aperçu, au-dessus du pager. */}
          {previewSlotRef && !detail ? <SheetPreviewSlot slotRef={previewSlotRef} /> : null}
          {staticSlot && !detail ? <div className="lkdv-cv2-static-slot">{staticSlot}</div> : null}

          {detail ? (
            <div
              className="lkdv-cv2-detail"
              data-state={state}
              data-testid="cv2-detail"
              style={
                edgeBackX > 0
                  ? { transform: `translateX(${edgeBackX}px)`, transition: 'none' }
                  : undefined
              }
              onPointerDown={(e) => {
                onDetailPointerDown(e);
                onBodyPointerDown(e);
              }}
              onPointerMove={(e) => {
                onDetailPointerMove(e);
                onDragMove(e);
              }}
              onPointerUp={(e) => {
                onDetailPointerEnd(e);
                onDragEnd(e);
              }}
              onPointerCancel={(e) => {
                onDetailPointerEnd(e);
                onDragEnd(e);
              }}
            >
              <div
                className="lkdv-cv2-detail-nav"
                data-cv2-drag
                onPointerDown={onDragStart}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onPointerCancel={onDragEnd}
              >
                <button
                  type="button"
                  className="lkdv-cv2-back"
                  data-testid="cv2-back"
                  onClick={() => {
                    haptic('light');
                    detail.onBack();
                  }}
                  aria-label="Retour"
                  data-cv2-autofocus
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M15 5l-7 7 7 7" />
                  </svg>
                </button>
                <b className={hideDetailTitle ? 'sr-only' : 'lkdv-cv2-detail-title'}>{detail.title}</b>
                {detail.meta ? <span className="lkdv-cv2-detail-meta">{detail.meta}</span> : null}
              </div>
              {detailCount > 1 ? (
                <LensPager
                  index={detail.index}
                  count={detailCount}
                  onIndexChange={(index) => detail.onIndexChange?.(index)}
                  label={detail.label ?? 'Détails'}
                >
                  {detailPages.map((page, index) => (
                    <div
                      key={index}
                      className="lkdv-cv2-pane lkdv-cv2-detail-pane"
                      data-testid={`cv2-detail-pane-${index}`}
                      role="group"
                      aria-label={`${detail.title} ${index + 1} sur ${detailCount}`}
                      aria-hidden={index !== detail.index}
                      inert={index !== detail.index}
                      tabIndex={index === detail.index ? 0 : -1}
                    >
                      {page}
                    </div>
                  ))}
                </LensPager>
              ) : (
                <div className="lkdv-cv2-detail-body">{detailPages[0] ?? null}</div>
              )}
            </div>
          ) : (
            <div
              className={cx('lkdv-cv2-body', Boolean(footer) && 'has-footer', Boolean(mini) && 'has-mini')}
              onPointerDown={onBodyPointerDown}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
            >
              {capsule.items.map((voletItem, voletIndex) => {
                const isActive = voletIndex === capsule.active;
                const filterMode = Boolean(mini?.pages);
                const resolvedPages = filterMode
                  ? mini?.pages?.[voletIndex] ?? []
                  : [panes[voletIndex] ?? null];
                const paneIndex = filterMode ? activePaneIndex : 0;
                const paneChange = filterMode ? onActivePaneChange : () => {};
                return (
                  <div
                    key={voletItem.id}
                    id={paneId(voletItem.id)}
                    className={cx('lkdv-cv2-pane', 'lkdv-cv2-pane--volet', isActive && 'active')}
                    data-testid={`cv2-pane-${voletItem.id}`}
                    role="tabpanel"
                    aria-label={voletItem.label}
                    aria-hidden={!isActive}
                    inert={!isActive}
                  >
                    {isActive ? (
                      <LensPager
                        index={Math.min(paneIndex, Math.max(0, resolvedPages.length - 1))}
                        count={resolvedPages.length}
                        onIndexChange={paneChange}
                        label={`${label} — ${mini?.label ?? 'filtres'}`}
                      >
                        {resolvedPages.map((pane, index) => {
                          const miniItem = mini?.items[index];
                          return (
                            <div
                              key={miniItem?.id ?? index}
                              id={`cv2-mini-pane-${voletItem.id}-${miniItem?.id ?? index}`}
                              className="lkdv-cv2-pane"
                              data-testid={`cv2-filter-pane-${miniItem?.id ?? index}`}
                              role="tabpanel"
                              aria-label={miniItem?.label}
                              aria-hidden={index !== paneIndex}
                              inert={index !== paneIndex}
                              tabIndex={index === paneIndex ? 0 : -1}
                            >
                              {pane}
                            </div>
                          );
                        })}
                      </LensPager>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {!detail && (mini || footer) ? (
            footer && mini ? (
              <div className="lkdv-cv2-bottom-dock">
                <div className="lkdv-cv2-footer">{footer}</div>
                {mini.items.length > 1 || Boolean(mini.sort) ? (
                  <div
                    className={cx(
                      'lkdv-cv2-mini-slot',
                      'has-footer',
                      Boolean(mini.sort) && 'has-sort',
                    )}
                    data-testid="cv2-mini-capsule"
                  >
                    <CapsuleTabs
                      items={mini.items.map((item) => ({ id: item.id, label: item.label, icon: item.icon }))}
                      activeIndex={mini.active}
                      onIndexChange={mini.onChange}
                      ariaLabel={mini.label}
                      size="sm"
                      className="lkdv-cv2-mini"
                      idFor={(id) => `cv2-mini-${id}`}
                      panelIdFor={
                        filterPages && activeVoletItem
                          ? (id) => `cv2-mini-pane-${activeVoletItem.id}-${id}`
                          : undefined
                      }
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                {mini && (mini.items.length > 1 || Boolean(mini.sort)) ? (
                  <div
                    className={cx(
                      'lkdv-cv2-mini-slot',
                      Boolean(mini.sort) && 'has-sort',
                    )}
                    data-testid="cv2-mini-capsule"
                  >
                    <CapsuleTabs
                      items={mini.items.map((item) => ({ id: item.id, label: item.label, icon: item.icon }))}
                      activeIndex={mini.active}
                      onIndexChange={mini.onChange}
                      ariaLabel={mini.label}
                      size="sm"
                      className="lkdv-cv2-mini"
                      idFor={(id) => `cv2-mini-${id}`}
                      panelIdFor={
                        filterPages && activeVoletItem
                          ? (id) => `cv2-mini-pane-${activeVoletItem.id}-${id}`
                          : undefined
                      }
                    />
                    {mini.sort ? (
                      <SortMenuButton
                        value={mini.sort.value}
                        defaultValue={mini.sort.defaultValue}
                        options={mini.sort.options}
                        onChange={mini.sort.onChange}
                      />
                    ) : null}
                  </div>
                ) : null}
                {footer ? (
                  <div className="lkdv-cv2-bottom-dock lkdv-cv2-bottom-dock--footer-only">
                    <div className="lkdv-cv2-footer">{footer}</div>
                  </div>
                ) : null}
              </>
            )
          ) : null}

          {showClose && <button type="button" className="lkdv-cv2-back lkdv-cv2-close" aria-label="Fermer" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>}
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(
    <>
      {shell}
      {island}
    </>,
    document.body,
  );
}

export default CommunitySheetShell;
