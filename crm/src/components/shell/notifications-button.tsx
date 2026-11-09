'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import s from '../../ui/crm.module.css';
import { Chip } from '../../ui/chip';
import { IconBell } from '../../ui/icons';
import { Button } from '../../ui/button';

/**
 * Notifications : uniquement des faits disponibles (demandes à valider).
 * Une valeur absente s'affiche « non renseigné ».
 */
export function NotificationsButton({ pending }: { pending: number | null }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className={`${s.btn} ${s.btnSoft} ${s.btnIcon}`}
        aria-label={`Notifications${pending ? ` (${pending} demande${pending > 1 ? 's' : ''} à valider)` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <IconBell />
      </button>
      {open ? (
        <div
          className={`${s.card} ${s.pad}`}
          style={{ position: 'absolute', right: 0, top: 52, width: 300, zIndex: 'var(--z-popover)', display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <span className={s.label}>À valider</span>
          <span style={{ fontSize: 13 }}>
            {pending === null ? 'non renseigné' : `${pending} demande${pending > 1 ? 's' : ''} en attente`}
          </span>
          <div className={s.rowFlexWrap}>
            <Chip tone={pending ? 'warn' : 'stone'}>{pending ? 'Action attendue' : 'Rien en attente'}</Chip>
          </div>
          <Link href="/journal" className={s.btn} style={{ minHeight: 36 }}>
            Ouvrir le journal d’audit
          </Link>
          <Button size="sm" tone="soft" onClick={() => setOpen(false)}>
            Fermer
          </Button>
        </div>
      ) : null}
    </div>
  );
}
