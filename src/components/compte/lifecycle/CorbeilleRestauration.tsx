'use client';

/**
 * Lot A02 — corbeille et restauration 30 jours (S1.24).
 *
 * La fenêtre est calculée par le contrat (`canRestoreActivity`). Une séance
 * dont la rétention est dépassée n'est plus restaurable : l'UI l'affiche
 * explicitement au lieu de laisser un bouton actif qui échouerait.
 */

import React, { useState } from 'react';
import { ArchiveRestore, Clock3, Trash2 } from 'lucide-react';
import { canRestoreActivity, type LifecycleActivityRecord } from '@/features/compte/lifecycle';
import {
  formatDateShort,
  formatDistanceKm,
  formatElevation,
  formatRemainingDays,
  sportLabel,
} from './format';
import { Chip, Notice } from './primitives';
import type { SubmitResult } from './types';

export interface CorbeilleRestaurationProps {
  items: readonly LifecycleActivityRecord[];
  busyId?: string | null;
  nowMs?: number;
  onRestore: (id: string) => Promise<SubmitResult>;
}

export function CorbeilleRestauration({
  items,
  busyId = null,
  nowMs = Date.now(),
  onRestore,
}: CorbeilleRestaurationProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  if (items.length === 0) {
    return (
      <div className="lkv-life__empty" data-testid="corbeille-vide">
        <strong>Corbeille vide</strong>
        <p>Aucune séance supprimée. Les séances supprimées restent 30 jours ici.</p>
      </div>
    );
  }

  async function restore(id: string) {
    setError(null);
    setPendingId(id);
    try {
      const result = await onRestore(id);
      if (result.ok === false) setError({ id, message: result.error });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div data-testid="corbeille-restauration">
      <Notice tone="info">
        <span>
          <Clock3 size={14} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 4 }} />
          Les séances supprimées sont restaurables pendant 30 jours. La purge définitive est traitée
          par le job de base ; elle n’est jamais déclenchée par cet écran.
        </span>
      </Notice>

      <ul className="lkv-life__list" style={{ marginTop: 12 }}>
        {items.map((record) => {
          const eligibility = canRestoreActivity(record, { nowMs });
          const busy = pendingId === record.id || busyId === record.id;
          return (
            <li
              key={record.id}
              className="lkv-life__row"
              style={{ cursor: 'default', alignItems: 'flex-start' }}
              data-testid={`corbeille-item-${record.id}`}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-flex',
                  width: 36,
                  height: 36,
                  flex: '0 0 36px',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  background: 'var(--lkv-danger-bg)',
                  color: 'var(--lkv-danger-dark)',
                }}
              >
                <Trash2 size={16} />
              </span>
              <div className="lkv-life__row-main">
                <span className="lkv-life__row-title">{record.title}</span>
                <span className="lkv-life__row-meta">
                  {sportLabel(record.sport)} · {formatDateShort(record.startedAt)} ·{' '}
                  {formatDistanceKm(record.stats.distanceKm)} ·{' '}
                  {formatElevation(record.stats.elevationGainM)} D+
                </span>
                <span className="lkv-life__row-meta">
                  Supprimée le {formatDateShort(record.deletedAt)}
                </span>
                {eligibility.eligible ? (
                  <span className="lkv-life__countdown">
                    <Clock3 size={13} aria-hidden="true" />
                    Reste {formatRemainingDays(eligibility.remainingMs)}
                  </span>
                ) : (
                  <Chip tone="accent">
                    {eligibility.reason === 'retention_expired'
                      ? 'Délai de 30 jours dépassé'
                      : 'Restauration indisponible'}
                  </Chip>
                )}
                {error?.id === record.id ? <Notice tone="error">{error.message}</Notice> : null}
              </div>
              <div className="lkv-life__row-side">
                <button
                  type="button"
                  className="lkv-life__btn"
                  data-variant="primary"
                  onClick={() => void restore(record.id)}
                  disabled={!eligibility.eligible || busy}
                  aria-label={`Restaurer ${record.title}`}
                >
                  <ArchiveRestore size={15} aria-hidden="true" />
                  {busy ? 'Restauration…' : 'Restaurer'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
