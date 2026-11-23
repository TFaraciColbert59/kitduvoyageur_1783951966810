'use client';

import { useEffect, useRef } from 'react';
import { POINT_ROLES, type PointRole } from '../../../pointInsertion';

/**
 * Menu de l'appui long sur la carte (2.2) : Point de passage, Arrêt, Fin d'étape, Repère. Posé à l'endroit
 * de l'appui, ramené dans la carte ; Échap ou un toucher à côté le ferme sans rien poser.
 */
export function PointRoleMenu({
  x,
  y,
  width,
  height,
  onPick,
  onClose,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  onPick: (role: PointRole) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const MENU_W = 220;
  const MENU_H = POINT_ROLES.length * 52 + 16;
  const left = Math.max(8, Math.min(x - MENU_W / 2, Math.max(8, width - MENU_W - 8)));
  const top = Math.max(8, Math.min(y + 12, Math.max(8, height - MENU_H - 8)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <button type="button" className="rcw-role-backdrop" aria-label="Fermer le menu" tabIndex={-1} onClick={onClose} />
      <div
        ref={ref}
        className="rcw-role-menu"
        role="menu"
        aria-label="Ajouter ici"
        data-testid="point-role-menu"
        style={{ left, top, width: MENU_W }}
      >
        {POINT_ROLES.map((r) => (
          <button
            key={r.id}
            type="button"
            role="menuitem"
            className="rcw-role-item"
            data-testid={`point-role-${r.id}`}
            onClick={() => onPick(r.id)}
          >
            <strong>{r.label}</strong>
            <span>{r.hint}</span>
          </button>
        ))}
      </div>
    </>
  );
}
