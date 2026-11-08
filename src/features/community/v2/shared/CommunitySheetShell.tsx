'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { CapsuleTabs, type CapsuleTabItem } from '@/components/ui/CapsuleTabs';
import { LensPager } from '@/components/ui/drawer/LensPager';
import { SortMenuButton, type SortOption } from '@/components/ui/drawer/SortMenuButton';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { zIndex } from '@/lib/ui/zIndex';

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
}: CommunitySheetShellProps) {
  const { haptic } = useHapticFeedback();
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<'opening' | 'open' | 'closing'>('opening');
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const layerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startY: number; startAt: number; height: number } | null>(
    null,
  );

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
    const timeout = window.setTimeout(
      () => {
        setMounted(false);
        setState('opening');
        openerRef.current?.focus?.();
      },
      reducedMotion ? 0 : SHEET_EXIT_MS,
    );
    return () => window.clearTimeout(timeout);
    // `mounted` est volontairement hors dépendances : sinon la sortie se relance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reducedMotion]);

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

  useEffect(() => {
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

  // ── Glissement vertical de fermeture (poignée / barre de navigation) ─────
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

  const onDragMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const raw = Math.max(0, event.clientY - drag.startY);
    if (raw > 4 && !dragging) setDragging(true);
    const knee = drag.height * 0.35;
    const banded = raw <= knee ? raw : knee + (raw - knee) * 0.35;
    setDragY(banded);
    if (banded > 4 && event.cancelable) event.preventDefault();
  }, [dragging]);

  const onDragEnd = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      const raw = Math.max(0, event.clientY - drag.startY);
      const elapsed = Math.max(1, performance.now() - drag.startAt);
      const velocity = raw / elapsed;
      const shouldClose =
        raw > drag.height * SHEET_DRAG_CLOSE_RATIO || velocity > SHEET_DRAG_CLOSE_VELOCITY;
      setDragging(false);
      if (raw > 8) haptic(shouldClose ? 'medium' : 'selection');
      if (shouldClose) {
        requestClose();
      } else {
        setDragY(0);
      }
    },
    [haptic, requestClose],
  );

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
  const showCapsule = !detail;

  const shell = (
    <div
      ref={layerRef}
      className={cx('lkdv-communaute-v2', 'lkdv-cv2-layer', className)}
      style={{ '--cv2-layer-z': zIndex.modal } as CSSProperties}
      data-state={state}
    >
      <div className="lkdv-cv2-wrap" data-det="card" data-state={state}>
        <div
          ref={sheetRef}
          className="lkdv-cv2-sheet"
          role="dialog"
          aria-modal={state === 'closing' ? undefined : 'true'}
          aria-label={label}
          tabIndex={-1}
          style={sheetStyle}
        >
          <div
            className="lkdv-cv2-grab"
            data-cv2-drag
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            aria-hidden="true"
          >
            <span />
          </div>

          {showCapsule ? (
            <div className="lkdv-cv2-topnav" data-cv2-drag onPointerDown={onDragStart}>
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

          {detail ? (
            <div className="lkdv-cv2-detail" data-state={state}>
              <div className="lkdv-cv2-detail-nav" data-cv2-drag onPointerDown={onDragStart}>
                <button
                  type="button"
                  className="lkdv-cv2-back"
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
                <b className="lkdv-cv2-detail-title">{detail.title}</b>
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
                      role="group"
                      aria-label={`${detail.title} ${index + 1} sur ${detailCount}`}
                      aria-hidden={index !== detail.index}
                      inert={index !== detail.index}
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
            <div className={cx('lkdv-cv2-body', Boolean(footer) && 'has-footer', Boolean(mini) && 'has-mini')}>
              <LensPager
                index={capsule.active}
                count={panes.length}
                onIndexChange={capsule.onChange}
                label={`${label} — volets`}
              >
                {panes.map((pane, index) => {
                  const item = capsule.items[index];
                  return (
                    <div
                      key={item?.id ?? index}
                      id={item ? paneId(item.id) : undefined}
                      className="lkdv-cv2-pane"
                      role="tabpanel"
                      aria-label={item?.label}
                      aria-hidden={index !== capsule.active}
                      inert={index !== capsule.active}
                    >
                      {pane}
                    </div>
                  );
                })}
              </LensPager>
            </div>
          )}

          {footer && !detail ? <div className="lkdv-cv2-footer">{footer}</div> : null}

          {mini && !detail ? (
            <div
              className={cx(
                'lkdv-cv2-mini-slot',
                Boolean(footer) && 'has-footer',
                Boolean(mini.sort) && 'has-sort',
              )}
            >
              <CapsuleTabs
                items={mini.items.map((item) => ({ id: item.id, label: item.label, icon: item.icon }))}
                activeIndex={mini.active}
                onIndexChange={mini.onChange}
                ariaLabel={mini.label}
                size="sm"
                className="lkdv-cv2-mini"
                idFor={(id) => `cv2-mini-${id}`}
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
