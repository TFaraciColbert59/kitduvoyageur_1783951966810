'use client';

import { useEffect, useRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { trapTab } from '../../components/focusTrap';
import { V5Icon } from './icons';

/**
 * Coquille visuelle du tiroir du Compas v5 : poignée, verre `.v5-sheet`, en-tête (capsule, titre, ligne de
 * contexte, croix), corps défilant. Aucune donnée : elle ne dépend ni de `useV5()` ni du registre `DRAWERS`.
 *
 * Elle sert `V5Sheet` (le Compas) ET le tiroir de `/compas/itineraire`. Même nœud racine, ouvert ou fermé : la
 * transition d'entrée (`[data-open]`) joue sur le même élément. Échap, Tab piégé et focus à l'ouverture sont des
 * options : l'itinéraire, dont les niveaux (menu de la carte, détail, sous-tiroir, tiroir) ont leur propre règle
 * « un niveau par Échap », garde la main sur Échap (`onEscape` absent) et ne piège pas le clavier hors de la carte.
 */
export interface SheetShellProps {
  open: boolean;
  /** Nom accessible du tiroir (`aria-label`) ; ignoré si `labelledBy` est donné. */
  label?: string;
  labelledBy?: string;
  title: ReactNode;
  titleId?: string;
  subtitle?: ReactNode;
  /** Libellé de la croix et de la poignée par défaut. */
  closeLabel: string;
  onClose: () => void;
  /** Échap ferme le tiroir (le Compas) ; absent, Échap n'est pas écouté ici. */
  onEscape?: () => void;
  /** Tab reste dans le tiroir (le Compas) ; faux, le clavier circule librement. */
  trapFocus?: boolean;
  /** Le tiroir prend le focus à l'ouverture (le Compas). */
  autoFocus?: boolean;
  /** Au-dessus du titre : la capsule d'icônes (`Flow`). */
  head?: ReactNode;
  /** Dans la ligne du titre, avant la croix (interrupteurs, retour). */
  actions?: ReactNode;
  /** Entre l'en-tête et le corps (chiffres de tête). */
  summary?: ReactNode;
  /** Après le corps (sélecteur flottant). */
  footer?: ReactNode;
  /** Remplace le comportement de la poignée (trois hauteurs au doigt et au clavier). */
  handle?: { label: string; expanded?: boolean } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'aria-expanded'>;
  className?: string;
  style?: CSSProperties;
  role?: 'dialog' | 'region';
  /** Attributs `data-*` posés sur la racine. */
  data?: Record<string, string | undefined>;
  bodyClassName?: string;
  bodyProps?: Record<string, unknown>;
  /** Change avec le contenu (onglet) : le corps est remonté, son défilement repart en haut. */
  bodyKey?: string;
  children: ReactNode;
}

/** Distance de glissement vers le bas qui ferme le tiroir (poignée par défaut). */
export const SHEET_DRAG_CLOSE_PX = 48;

export function SheetShell({
  open,
  label,
  labelledBy,
  title,
  titleId,
  subtitle,
  closeLabel,
  onClose,
  onEscape,
  trapFocus = true,
  autoFocus = true,
  head,
  actions,
  summary,
  footer,
  handle,
  className,
  style,
  role = 'dialog',
  data,
  bodyClassName,
  bodyProps,
  bodyKey,
  children,
}: SheetShellProps) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    if (autoFocus) ref.current?.focus({ preventScroll: true });
    if (!onEscape && !trapFocus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape?.();
      else if (e.key === 'Tab' && trapFocus) trapTab(e, ref.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onEscape, trapFocus, autoFocus]);

  if (!open) return <div className={`v5-sheet${className ? ` ${className}` : ''}`} aria-hidden="true" style={style} />;

  const { label: handleLabel, expanded, ...handleProps } = handle ?? { label: closeLabel };
  const defaultGrab: ButtonHTMLAttributes<HTMLButtonElement> = handle
    ? {}
    : {
        onClick: onClose,
        onPointerDown: (e) => {
          drag.current = { y: e.clientY };
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        },
        onPointerMove: (e) => {
          if (drag.current && e.clientY - drag.current.y > SHEET_DRAG_CLOSE_PX) {
            drag.current = null;
            onClose();
          }
        },
        onPointerUp: () => {
          drag.current = null;
        },
      };

  return (
    <div
      ref={ref}
      className={`v5-sheet${className ? ` ${className}` : ''}`}
      data-open=""
      role={role}
      aria-modal={role === 'dialog' ? 'false' : undefined}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      tabIndex={-1}
      style={style}
      {...data}
    >
      <button
        type="button"
        className="v5-sgrab"
        aria-label={handleLabel}
        aria-expanded={expanded}
        {...defaultGrab}
        {...handleProps}
      >
        <i />
      </button>
      <div className="v5-shead">
        {head}
        <div className="v5-sttl">
          <h2 id={titleId}>{title}</h2>
          {subtitle ? <span>{subtitle}</span> : null}
          {actions}
          <button type="button" className="v5-sx" aria-label={closeLabel} onClick={onClose}>
            <V5Icon name="x" size="s" />
          </button>
        </div>
      </div>
      {summary}
      <div key={bodyKey} className={`v5-sbody${bodyClassName ? ` ${bodyClassName}` : ''}`} {...bodyProps}>
        {children}
      </div>
      {footer}
    </div>
  );
}
