'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CircleCheckBig, Compass, Trophy, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import Icon from '@/components/ui/Icon';

/** Position verticale du declencheur sur le bord droit (3 tiroirs empiles). */
export type HubEdgeSlot = 'top' | 'mid' | 'bottom';

/**
 * Nature du tiroir. L icone est resolue DANS le composant client : les menus
 * du hub sont des Server Components, et une reference de composant lucide
 * traversant la frontière server -> client est interdite (le module RSC la
 * refuse). Seul un identifiant en chaine traverse donc la frontiere.
 */
export type HubEdgeKind = 'status' | 'progression' | 'cockpit';

export interface HubEdgeDrawerProps {
  kind: HubEdgeKind;
  /** Position du declencheur sur le bord droit de l'ecran. */
  slot?: HubEdgeSlot;
  /** Surcharges facultatives du libelle / titre. */
  label?: string;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** Ouvre le panneau au montage (redirection legacy /progression). */
  defaultOpen?: boolean;
}

const KIND_META: Record<HubEdgeKind, { icon: LucideIcon; label: string; title: string }> = {
  status: { icon: CircleCheckBig, label: 'État', title: 'État de l’aventure' },
  progression: { icon: Trophy, label: 'Points', title: 'Ma progression' },
  cockpit: { icon: Compass, label: 'Cockpit', title: 'Cockpit aventure' },
};

const SLOT_CLASS: Record<HubEdgeSlot, string> = {
  top: 'hub-edge-trigger--top',
  mid: 'hub-edge-trigger--mid',
  bottom: 'hub-edge-trigger--bottom',
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * HubEdgeDrawer — tiroir lateral droit (iOS 27).
 *
 * Le hub mobile ne doit plus empiler les cartes d etat, de progression et de
 * cockpit dans le flux : elles deviennent trois poignees de verre collees au
 * bord droit, qui ouvrent un panneau de verre ancre a droite. Le panneau
 * n est monte qu a l ouverture (Radix unmount), donc le contenu lourd reste
 * hors du chemin de rendu initial.
 */
export function HubEdgeDrawer({
  kind,
  slot = 'mid',
  label,
  title,
  description,
  children,
  className,
  defaultOpen = false,
}: HubEdgeDrawerProps) {
  const meta = KIND_META[kind];
  const TriggerIcon = meta.icon;
  const triggerLabel = label ?? meta.label;
  const panelTitle = title ?? meta.title;

  const [open, setOpen] = React.useState(defaultOpen);
  const [dragX, setDragX] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const dragStart = React.useRef<number | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && kind === 'progression') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('panel') === 'points' || params.get('points') === '1') {
        params.delete('panel');
        params.delete('points');
        const query = params.toString();
        window.history.replaceState(
          window.history.state,
          '',
          `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
        );
        setOpen(true);
      }
    }
  }, [kind]);

  React.useEffect(() => {
    if (open) {
      dragStart.current = null;
      setDragX(0);
      setDragging(false);
    }
  }, [open]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion()) return;
    dragStart.current = event.clientX;
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return;
    setDragX(Math.max(0, event.clientX - dragStart.current));
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return;
    const distance = Math.max(0, event.clientX - dragStart.current);
    const width = panelRef.current?.offsetWidth ?? 0;
    dragStart.current = null;
    setDragging(false);
    if (width > 0 && distance > width * 0.25) {
      setOpen(false);
      return;
    }
    setDragX(0);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={panelTitle}
        aria-haspopup="dialog"
        className={cn('hub-edge-trigger', SLOT_CLASS[slot], className)}
      >
        <TriggerIcon size={17} strokeWidth={2} aria-hidden="true" />
        <span className="hub-edge-trigger__label">{triggerLabel}</span>
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="hub-edge-overlay" />
          <Dialog.Content
            {...(description ? {} : { 'aria-describedby': undefined })}
            className="hub-edge-panel"
          >
            <div
              ref={panelRef}
              style={{
                transform: dragX > 0 ? `translateX(${dragX}px)` : undefined,
                transition: dragging
                  ? 'none'
                  : 'transform var(--motion-control-duration) var(--ease-glass)',
              }}
              className="hub-edge-panel__surface"
            >
              <div
                aria-hidden="true"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                className="hub-edge-panel__grip"
              >
                <span className="hub-edge-panel__grip-bar" />
              </div>

              <div className="hub-edge-panel__head">
                <div className="min-w-0">
                  <Dialog.Title className="hub-edge-panel__title">{panelTitle}</Dialog.Title>
                  {description ? (
                    <Dialog.Description className="hub-edge-panel__desc">
                      {description}
                    </Dialog.Description>
                  ) : null}
                </div>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label="Fermer"
                    className="hub-edge-panel__close"
                  >
                    <Icon name="x" size={16} aria-hidden="true" />
                  </button>
                </Dialog.Close>
              </div>

              <div className="hub-edge-panel__body">{children}</div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

export default HubEdgeDrawer;
