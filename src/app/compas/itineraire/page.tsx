import type { Metadata } from 'next';
import AppShell from '@/components/shell/AppShell';
import { createClient } from '@/lib/supabase/server';
import { RouteCollabPageClient } from '@/features/route-collab/components/RouteCollabPageClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Créateur d’itinéraire collaboratif — Compas LKDV',
  description: 'Préparation d’itinéraire multi-jours collaborative, hors ligne et reliée au sac.',
};

export default async function CompasItinerairePage() {
  let userId = 'guest-local';
  let userName = 'Voyageur';
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      userName =
        (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
        user.email?.split('@')[0] ||
        'Voyageur';
    }
  } catch {
    /* mode invité */
  }

  return (
    <AppShell hasBottomNav videoBackground={false}>
      <RouteCollabPageClient userId={userId} userName={userName} />
    </AppShell>
  );
}
