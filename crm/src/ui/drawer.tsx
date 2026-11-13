'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import s from './crm.module.css';
import { IconClose } from './icons';

/**
 * Tiroir latéral : jamais de grand formulaire dans une fenêtre modale (§ 5).
 * Échap ferme, le focus entre dans le tiroir, le défilement de la page est bloqué.
 */
export function Drawer({
  open,
  title,
  subtitle,
  onClose,
  footer,
  children
}: {
  open: boolean;
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const first = panelRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])'
    );
    first?.focus();
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={s.drawerScrim} onClick={onClose} role="presentation">
      <div
        className={s.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panelRef}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={s.drawerHead}>
          <div className={s.grow}>
            <h2 className={s.titleSm} style={{ fontSize: 20 }}>
              {title}
            </h2>
            {subtitle ? <span className={s.muted} style={{ fontSize: 13 }}>{subtitle}</span> : null}
          </div>
          <button type="button" className={s.btn} aria-label="Fermer" onClick={onClose} style={{ minWidth: 44, padding: '0 12px' }}>
            <IconClose />
          </button>
        </div>
        <div className={s.drawerBody}>{children}</div>
        {footer ? <div className={s.drawerFoot}>{footer}</div> : null}
      </div>
    </div>
  );
}
