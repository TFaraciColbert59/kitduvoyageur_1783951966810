'use client';

import { useState } from 'react';

import { Button } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { getSsoProviders } from '@/lib/auth/sso';
import { useTranslation } from '@/lib/i18n/context';

/**
 * Boutons SSO — rendus uniquement si `NEXT_PUBLIC_SSO_PROVIDERS` déclare
 * des fournisseurs configurés côté dashboard Supabase. Redirection via
 * `/auth/callback` (échange PKCE serveur, `next` validé same-origin).
 */
export function SsoButtons({ nextPath }: { nextPath: string | null }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const providers = getSsoProviders();

  if (providers.length === 0) return null;

  async function signIn(provider: (typeof providers)[number]) {
    setBusy(provider.id);
    setError('');
    try {
      const supabase = createClient();
      const redirectTo =
        `${window.location.origin}/auth/callback` +
        (nextPath ? `?next=${encodeURIComponent(nextPath)}` : '');
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: provider.id,
        options: { redirectTo },
      });
      if (err) throw err;
    } catch {
      setError(t('auth.ssoError'));
      setBusy(null);
    }
  }

  return (
    <div className="mt-[var(--space-4)]">
      <div className="mb-[var(--space-3)] flex items-center gap-3">
        <span aria-hidden="true" className="h-px flex-1 bg-[color:var(--lkv-border-subtle)]" />
        <span className="text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">
          {t('auth.ssoDivider')}
        </span>
        <span aria-hidden="true" className="h-px flex-1 bg-[color:var(--lkv-border-subtle)]" />
      </div>
      <div className="flex flex-col gap-2">
        {providers.map((p) => (
          <Button
            key={p.id}
            variant="secondary"
            fullWidth
            size="lg"
            loading={busy === p.id}
            disabled={busy !== null}
            onClick={() => signIn(p)}
          >
            {p.label}
          </Button>
        ))}
      </div>
      {error ? (
        <div
          className="mt-2 rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-danger)] bg-[color:var(--lkv-danger-bg)] p-[10px] text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-danger)]"
          role="alert"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
