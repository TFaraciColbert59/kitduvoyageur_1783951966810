'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui';
import { useAdminFetch } from './useCsrfToken';
import { errorMessage } from './adminResponse';
import { AdminInput, AdminSelect, AdminField } from './AdminField';

const GRANTABLE_ROLES = ['super_admin', 'admin', 'moderateur'] as const;

/** Îlot client : octroi / retrait de rôle + expiration, via API + CSRF. */
export function RoleManager({ userId, roles }: { userId: string; roles: string[] }) {
  const { csrfReady, call } = useAdminFetch();
  const router = useRouter();
  const [role, setRole] = useState<string>('moderateur');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function grant() {
    setBusy(true);
    setError(null);
    try {
      const res = await call(`/api/admin/users/${userId}/role`, {
        method: 'POST',
        body: JSON.stringify({
          role,
          ...(expiresAt ? { expires_at: new Date(expiresAt).toISOString() } : {}),
        }),
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

  async function revoke(r: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await call(`/api/admin/users/${userId}/role`, {
        method: 'DELETE',
        body: JSON.stringify({ role: r }),
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
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {roles.length === 0 ? (
          <span className="text-xs text-[color:var(--glass-label-tertiary)]">aucun rôle</span>
        ) : (
          roles.map((r) => (
            <span
              key={r}
              className="inline-flex items-center gap-1 rounded-full bg-[color:var(--g3-bg)] px-2 py-0.5 text-xs font-semibold text-[color:var(--g3-text)]"
            >
              {r}
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon={
                  <span aria-hidden="true" className="text-xs font-bold">
                    ×
                  </span>
                }
                aria-label={`Retirer le rôle ${r}`}
                disabled={!csrfReady || busy}
                onClick={() => revoke(r)}
              />
            </span>
          ))
        )}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <AdminField label="Rôle">
          <AdminSelect value={role} onChange={(e) => setRole(e.target.value)} disabled={busy}>
            {GRANTABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </AdminSelect>
        </AdminField>
        <AdminField label="Expire le (optionnel)">
          <AdminInput
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            disabled={busy}
          />
        </AdminField>
        <Button variant="secondary" size="sm" disabled={!csrfReady || busy} onClick={grant}>
          Octroyer
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
