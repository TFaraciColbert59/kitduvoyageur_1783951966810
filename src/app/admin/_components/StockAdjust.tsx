'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui';
import { useAdminFetch } from './useCsrfToken';
import { errorMessage } from './adminResponse';
import { AdminField, AdminInput, AdminSelect } from './AdminField';
import type { StockMovement } from '@/features/admin/productUtils';

/** Îlot client : ajustement de stock tracé + historique. */
export function StockAdjust({
  productId,
  currentStock,
  movements,
}: {
  productId: string;
  currentStock: number;
  movements: StockMovement[];
}) {
  const { csrfReady, call } = useAdminFetch();
  const router = useRouter();
  const [delta, setDelta] = useState('1');
  const [movementType, setMovementType] = useState('ajustement');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await call(`/api/admin/products/${productId}/stock`, {
        method: 'POST',
        body: JSON.stringify({
          quantity_change: Number(delta),
          movement_type: movementType,
          notes,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorMessage(j, `Échec (${res.status})`));
      setNotes('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[color:var(--glass-label)]">
        Stock actuel : <strong>{currentStock}</strong>
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <AdminField label="Quantité (+/−)">
          <AdminInput
            type="number"
            step="1"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            disabled={busy}
          />
        </AdminField>
        <AdminField label="Type">
          <AdminSelect value={movementType} onChange={(e) => setMovementType(e.target.value)} disabled={busy}>
            {['ajustement', 'entrée', 'sortie', 'retour', 'inventaire'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </AdminSelect>
        </AdminField>
        <AdminField label="Notes">
          <AdminInput
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1024}
            disabled={busy}
          />
        </AdminField>
        <Button variant="secondary" size="sm" disabled={!csrfReady || busy} onClick={submit}>
          Appliquer
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-[color:var(--lkv-danger)]">
          {error}
        </p>
      ) : null}
      {movements.length === 0 ? null : (
        <ul className="flex flex-col gap-1">
          {movements.slice(0, 10).map((m) => (
            <li key={m.id} className="text-xs text-[color:var(--glass-label-secondary)]">
              {new Date(m.created_at).toLocaleString('fr-FR')} · {m.movement_type} ·{' '}
              {m.quantity_before} → {m.quantity_after} ({m.quantity_change > 0 ? '+' : ''}
              {m.quantity_change}){m.notes ? ` · ${m.notes}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
