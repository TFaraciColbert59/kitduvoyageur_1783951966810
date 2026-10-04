'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui';
import { useAdminFetch } from './useCsrfToken';
import { AdminField, AdminInput } from './AdminField';

/** Îlot client : approuver / rejeter un retrait via la route durcie. */
export function WithdrawalActions({ withdrawalId }: { withdrawalId: string }) {
  const { csrfReady, call } = useAdminFetch();
  const router = useRouter();
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await call('/api/admin/rewards', {
        method: 'POST',
        body: JSON.stringify({
          action: 'process_withdrawal',
          withdrawal_id: withdrawalId,
          approve,
          reference: reference || null,
          reason: reason || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? `Échec (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <AdminField label="Référence paiement">
          <AdminInput
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="virement-…"
            maxLength={255}
            disabled={busy}
          />
        </AdminField>
        <AdminField label="Motif (si rejet)">
          <AdminInput
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="justificatif…"
            maxLength={1024}
            disabled={busy}
          />
        </AdminField>
        <Button variant="secondary" size="sm" disabled={!csrfReady || busy} onClick={() => decide(true)}>
          Approuver
        </Button>
        <Button variant="destructive" size="sm" disabled={!csrfReady || busy} onClick={() => decide(false)}>
          Rejeter
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-[color:var(--lkv-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Îlot client : clôturer une période de récompense. */
export function FinalizePeriodForm() {
  const { csrfReady, call } = useAdminFetch();
  const router = useRouter();
  const [periodId, setPeriodId] = useState('');
  const [revenue, setRevenue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const res = await call('/api/admin/rewards', {
        method: 'POST',
        body: JSON.stringify({
          action: 'finalize_period',
          period_id: periodId,
          eligible_revenue: Number(revenue),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? `Échec (${res.status})`);
      }
      setDone(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <AdminField label="Période (AAAA-MM)" hint="Identifiant reward_periods">
          <AdminInput
            value={periodId}
            onChange={(e) => setPeriodId(e.target.value)}
            placeholder="2026-09"
            maxLength={7}
            disabled={busy}
          />
        </AdminField>
        <AdminField label="Revenu éligible (€)">
          <AdminInput
            type="number"
            min="0"
            step="0.01"
            value={revenue}
            onChange={(e) => setRevenue(e.target.value)}
            disabled={busy}
          />
        </AdminField>
        <Button variant="secondary" size="sm" disabled={!csrfReady || busy} onClick={submit}>
          Clôturer
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-[color:var(--lkv-danger)]">
          {error}
        </p>
      ) : null}
      {done ? <p className="text-xs">Période clôturée et journalisée.</p> : null}
    </div>
  );
}
