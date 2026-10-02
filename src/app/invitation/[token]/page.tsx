import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AppShell from '@/components/shell/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getTripInvitationPreview } from '@/features/compas/server/invitationActions';
import { InvitationResponse } from '@/features/compas/components/TripInvitations';
import { invitationDates } from '@/features/compas/engine/team';

/**
 * Lien d'invitation à un voyage (partagé dans un message, un club, un groupe,
 * un commentaire ou hors de l'app). On voit le voyage, on accepte ou on
 * refuse ; l'accès au voyage n'existe qu'après acceptation.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Invitation à un voyage — Kit du Voyageur',
  robots: { index: false, follow: false },
};

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(`/invitation/${token}`)}`);

  const inv = await getTripInvitationPreview(token);
  const closed =
    !inv || inv.expired || inv.status === 'cancelled' || (!inv.isLink && inv.status === 'declined');
  const when = inv ? invitationDates(inv.startDate, inv.endDate) : null;

  let message: string | null = null;
  if (!inv) message = 'Ce lien d’invitation n’existe pas ou plus.';
  else if (!inv.forMe) message = 'Cette invitation est destinée à quelqu’un d’autre.';
  else if (closed) message = 'Cette invitation n’est plus ouverte. Demande un nouveau lien.';

  const initial =
    inv && (inv.alreadyMember || (!inv.isLink && inv.status === 'accepted'))
      ? ('accepted' as const)
      : ('pending' as const);

  return (
    <AppShell hasBottomNav videoBackground={false}>
      <div
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px 16px',
        }}
      >
        <section
          aria-labelledby="inv-title"
          style={{
            width: '100%',
            maxWidth: 440,
            padding: 20,
            display: 'grid',
            gap: 12,
            background: 'var(--glass-solid)',
            border: '1px solid var(--lkv-border)',
            borderRadius: 'var(--lkv-radius-card)',
            boxShadow: 'var(--glass-shadow)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 12,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--lkv-text-secondary)',
            }}
          >
            Invitation
          </p>
          {inv && !message ? (
            <>
              <h1 id="inv-title" style={{ margin: 0, fontSize: 22, color: 'var(--lkv-text-primary)' }}>
                {inv.tripTitle}
              </h1>
              <p style={{ margin: 0, fontSize: 15, color: 'var(--lkv-text-secondary)' }}>
                {[`${inv.inviterName} t’invite`, inv.destination, when].filter(Boolean).join(' · ')}
              </p>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--lkv-text-secondary)' }}>
                {inv.role === 'editor'
                  ? 'Tu pourras préparer le voyage avec l’équipe.'
                  : 'Tu pourras consulter le voyage.'}{' '}
                Rien n’est visible avant ton accord.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <InvitationResponse
                  token={inv.isLink ? token : undefined}
                  invitationId={inv.isLink ? undefined : inv.invitationId}
                  tripId={inv.tripId}
                  initial={initial}
                />
              </div>
            </>
          ) : (
            <>
              <h1 id="inv-title" style={{ margin: 0, fontSize: 20, color: 'var(--lkv-text-primary)' }}>
                {message}
              </h1>
              <Link href="/hub" style={{ color: 'var(--lkv-primary)', fontWeight: 600 }}>
                Retour au hub
              </Link>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
