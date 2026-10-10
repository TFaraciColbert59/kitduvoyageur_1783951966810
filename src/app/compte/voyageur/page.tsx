import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AppShell from '@/components/shell/AppShell';
import { Card } from '@/components/ui';
import TravellerCard from '@/components/identity/TravellerCard';
import { createClient } from '@/lib/supabase/server';
import { travellerView } from '@/features/compas/engine/traveller';
import { readTravellerState } from '@/features/compas/server/traveller';

/**
 * Profil voyageur (PLAN-100 4.1) : nationalité, pays de résidence, devise, langue,
 * fuseau, domicile. Privé (la personne seule), facultatif ; lu ici côté serveur et
 * rendu à la seule personne concernée, sans coordonnées. Un essai sans compte n'en
 * a pas. Une seule mise en page (AppShell gère les zones sûres et la navigation).
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Profil voyageur',
  robots: { index: false, follow: false },
};

export default async function TravellerProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent('/compte/voyageur')}`);
  const trial = user.is_anonymous === true;
  const state = trial ? null : await readTravellerState(supabase, user.id);
  // Lecture en échec : jamais un formulaire vide (« Enregistrer » écraserait le profil rangé).
  const view = state && !state.failed ? travellerView(state.traveller) : null;

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
          href="/compte"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 'var(--lkv-touch-min)',
            fontSize: 'var(--lkv-text-caption)',
            color: 'var(--lkv-text-muted)',
          }}
        >
          ← Mon compte
        </Link>
        <h1 style={{ margin: 0, fontSize: 'var(--lkv-text-title-md)', fontWeight: 700, color: 'var(--lkv-text-primary)' }}>
          Profil voyageur
        </h1>
        <Card variant="featured" style={{ padding: 'var(--space-4)' }}>
          {view ? (
            <TravellerCard mode="edit" initial={view} />
          ) : (
            <p style={{ margin: 0, fontSize: 'var(--lkv-text-body-sm)', color: 'var(--lkv-text-primary)' }}>
              {state?.failed
                ? 'Ton profil voyageur ne peut pas être lu pour le moment : réessaie dans un instant.'
                : 'Crée ton compte pour garder un profil voyageur : un essai sans compte ne garde rien.'}
            </p>
          )}
        </Card>
      </main>
    </AppShell>
  );
}
