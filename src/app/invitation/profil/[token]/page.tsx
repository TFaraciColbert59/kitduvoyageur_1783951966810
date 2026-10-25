import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AppShell from '@/components/shell/AppShell';
import { createClient } from '@/lib/supabase/server';
import { profileInvitationLoginPath } from '@/lib/invitationPaths';
import { ProfileInvitationAccept } from './ProfileInvitationAccept';

/**
 * Lien public d'invitation à un profil privé.
 *
 * Un visiteur non connecté est renvoyé vers la connexion avec un `next`
 * interne ; une fois connecté, `ProfileInvitationAccept` appelle réellement
 * `POST /api/compte/invitations` avec le jeton de l'URL.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Invitation à un profil privé — Kit du Voyageur',
  robots: { index: false, follow: false },
};

export default async function ProfileInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(profileInvitationLoginPath(token));

  return (
    <AppShell videoBackground={false}>
      <main className="lkdv-profile-invitation-page">
        <ProfileInvitationAccept token={token} />
      </main>
    </AppShell>
  );
}
