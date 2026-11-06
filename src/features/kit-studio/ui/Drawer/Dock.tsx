'use client';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { Grab } from './Grab';

interface DockProps {
  open: boolean;
  /** Nom de la vue courante (aria-label du dialogue). */
  label: string;
  onClose: () => void;
  children: ReactNode;
  /** Référence du tiroir (la pilule en mesure la hauteur réelle). */
  dockRef?: Ref<HTMLElement>;
}

/** Tiroir unique : dialogue non modal. Focus déplacé à l'ouverture, rendu au déclencheur à la fermeture. */
export function Dock({ open, label, onClose, children, dockRef }: DockProps) {
  const el = useRef<HTMLElement | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const [dragY, setDragY] = useState<number | null>(null);

  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      el.current = node;
      if (typeof dockRef === 'function') dockRef(node);
      else if (dockRef) (dockRef as { current: HTMLElement | null }).current = node;
    },
    [dockRef],
  );

  useEffect(() => {
    if (open) {
      const a = document.activeElement;
      trigger.current = a instanceof HTMLElement && a !== document.body ? a : null;
      el.current?.focus({ preventScroll: true });
      return;
    }
    const t = trigger.current;
    trigger.current = null;
    if (t && t.isConnected) t.focus({ preventScroll: true });
  }, [open]);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <section
      ref={setRefs}
      className={dragY == null ? 'ks-dock' : 'ks-dock ks-drag'}
      role="dialog"
      aria-modal="false"
      aria-label={label}
      tabIndex={-1}
      data-open={open}
      inert={!open}
      style={dragY == null ? undefined : { transform: `translate(-50%, ${dragY}px)` }}
      onKeyDown={onKeyDown}
    >
      <Grab onDrag={setDragY} onClose={onClose} />
      {children}
    </section>
  );
}
