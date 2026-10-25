import type { Metadata } from 'next';
import Link from 'next/link';
import AppShell from '@/components/shell/AppShell';
import { Card } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import { NewPasswordForm } from '@/features/auth/NewPasswordForm';
import { PASSWORD_FORGOT_PATH, PASSWORD_RESET_TEXT } from '@/features/auth/passwordReset';

/**
 * Nouveau mot de passe : l'arrivée du lien du courriel « mot de passe oublié » (`/auth/callback`
 * a échangé le code contre une session, puis renvoie ici). Lu côté serveur :
 *  - session de compte ouverte : le formulaire ;
 *  - sinon (lien expiré, déjà servi, ouvert dans un autre navigateur) : le dire, avec le moyen
 *    d'en demander un nouveau. `?lien=echec` : l'échange du code a échoué dans `/auth/callback`.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Nouveau mot de passe',
  robots: { index: false, follow: false },
};

const P = { margin: 0, fontSize: 'var(--lkv-text-body-sm)', color: 'var(--lkv-text-primary)' } as const;

export default async function NewPasswordPage({ searchParams }: { searchParams: Promise<{ lien?: string }> }) {
  const { lien } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ready = !!user && user.is_anonymous !== true;

  return (
    <AppShell hasBottomNav videoBackground={false}>
      <main
        style={{
          width: '100%',
          maxWidth: 640,
          margin: '0 auto',
          padding: 'var(--space-4) 16px',
          boxSizing: 'border-box',
          display: 'grid',
          gap: 'var(--space-4)',
        }}
      >
        <Link
          href="/connexion"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 'var(--lkv-touch-min)',
            fontSize: 'var(--lkv-text-caption)',
            color: 'var(--lkv-text-muted)',
          }}
        >
          ← Connexion
        </Link>
        <h1 style={{ margin: 0, fontSize: 'var(--lkv-text-title-md)', fontWeight: 700, color: 'var(--lkv-text-primary)' }}>
          Nouveau mot de passe
        </h1>
        <Card variant="featured" style={{ padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)' }}>
          {ready ? (
            <>
              <p style={P}>Choisis ton nouveau mot de passe. Tu seras ensuite connecté·e sur cet appareil.</p>
              <NewPasswordForm email={user?.email ?? null} />
            </>
          ) : (
            <>
              <p role="alert" style={P}>
                {lien === 'echec' ? PASSWORD_RESET_TEXT.linkFailed : PASSWORD_RESET_TEXT.signedOut}
              </p>
              <p style={P}>
                <Link href={PASSWORD_FORGOT_PATH}>Demander un nouveau lien</Link>
              </p>
            </>
          )}
        </Card>
      </main>
    </AppShell>
  );
}
