'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui';
import { useAdminFetch } from './useCsrfToken';
import { errorMessage } from './adminResponse';

type Decision = 'approuve' | 'rejete' | 'signale';

/** Îlot client : traiter un signalement (décision + traçabilité serveur). */
export function ModerationActions({ id }: { id: string }) {
  const { csrfReady, call } = useAdminFetch();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(statut: Decision) {
    setBusy(true);
    setError(null);
    try {
      const res = await call(`/api/admin/moderation/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ statut }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(errorMessage(j, `Échec (${res.status})`));
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(['approuve', 'rejete', 'signale'] as const).map((s) => (
        <Button
          key={s}
          variant={s === 'rejete' ? 'destructive' : 'secondary'}
          size="sm"
          disabled={!csrfReady || busy}
          onClick={() => decide(s)}
        >
          {s === 'approuve' ? 'Approuver' : s === 'rejete' ? 'Rejeter' : 'Signaler'}
        </Button>
      ))}
      {error ? (
        <p role="alert" className="text-xs text-[color:var(--lkv-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
