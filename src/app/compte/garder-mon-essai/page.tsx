import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AppShell from '@/components/shell/AppShell';
import { Card } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import { KEEP_TRIAL_PATH, KEEP_TRIAL_TEXT, keepTrialEnabled } from '@/features/demo/keepTrial';
import { KeepTrialEmailForm, KeepTrialPasswordForm } from '@/features/demo/KeepTrialForms';

/**
 * Garder son essai (PLAN-100 2.3) : un essai sans compte lie un e-mail à SA session au lieu de
 * créer un nouveau compte qui perdrait le voyage. Trois états, lus côté serveur :
 *  - essai en cours : l'e-mail (si l'interrupteur `NEXT_PUBLIC_KEEP_TRIAL=on` est allumé) ;
 *  - compte (l'e-mail est confirmé) : le choix d'un mot de passe, pour se reconnecter ailleurs ;
 *  - interrupteur éteint : le dire, sans bouton qui mènerait à une erreur.
 * `?lien=ok` : l'e-mail vient d'être confirmé ; `?lien=echec` : le lien a été ouvert ailleurs que dans ce navigateur.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Garder mon essai',
  robots: { index: false, follow: false },
};

const P = { margin: 0, fontSize: 'var(--lkv-text-body-sm)', color: 'var(--lkv-text-primary)' } as const;

export default async function KeepTrialPage({ searchParams }: { searchParams: Promise<{ lien?: string }> }) {
  const { lien } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Sans session ici, seul le message du lien ouvert ailleurs a un sens ; le reste demande de se connecter.
  if (!user && lien !== 'echec') redirect(`/connexion?next=${encodeURIComponent(KEEP_TRIAL_PATH)}`);
  const trial = user?.is_anonymous === true;
  const on = keepTrialEnabled();

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
          href={!user ? '/connexion' : trial ? '/compas' : '/compte'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 'var(--lkv-touch-min)',
            fontSize: 'var(--lkv-text-caption)',
            color: 'var(--lkv-text-muted)',
          }}
        >
          {!user ? '← Connexion' : trial ? '← Retour au Compas' : '← Mon compte'}
        </Link>
        <h1 style={{ margin: 0, fontSize: 'var(--lkv-text-title-md)', fontWeight: 700, color: 'var(--lkv-text-primary)' }}>
          {trial || !user ? 'Garder mon essai' : 'Ton mot de passe'}
        </h1>
        {lien === 'echec' && (
          <p role="note" style={{ ...P, color: 'var(--lkv-text-muted)' }}>
            Le lien de confirmation n’a pas pu s’ouvrir ici. Ouvre-le sur l’appareil et dans le navigateur où tu as
            commencé ton essai. S’il a expiré, redemande-le depuis ton essai.
          </p>
        )}
        {user && (
          <Card variant="featured" style={{ padding: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)' }}>
            {trial && on && (
              <>
                <p style={P}>
                  Ton essai s’efface après 7 jours sans visite. Donne une adresse e-mail pour le garder : ton voyage et
                  ton kit restent les mêmes, il n’y a rien à refaire.
                </p>
                <KeepTrialEmailForm />
              </>
            )}
            {trial && !on && (
              <>
                <p style={P}>{KEEP_TRIAL_TEXT.disabled}</p>
                <p style={{ ...P, color: 'var(--lkv-text-muted)' }}>
                  <Link href="/connexion?mode=inscription">Créer un compte</Link>
                </p>
              </>
            )}
            {!trial && (
              <>
                <p style={P}>
                  {lien === 'ok'
                    ? 'Ton e-mail est confirmé : ton essai est devenu ton compte, avec le même voyage. Choisis un mot de passe pour pouvoir te reconnecter depuis un autre appareil.'
                    : 'Choisis un mot de passe pour pouvoir te reconnecter avec ton e-mail depuis un autre appareil.'}
                </p>
                <KeepTrialPasswordForm email={user?.email ?? null} />
              </>
            )}
          </Card>
        )}
      </main>
    </AppShell>
  );
}
