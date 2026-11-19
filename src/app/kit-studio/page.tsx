import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getStudioData } from '@/features/kit-studio/server/getStudioData';
import { resolveStudioPageState } from '@/features/kit-studio/server/studioMode';
import { KitStudioClient } from '@/features/kit-studio/ui/KitStudioClient';
import { StudioEmptyState } from '@/features/kit-studio/ui/StudioEmptyState';
import { StudioUnavailable } from '@/features/kit-studio/ui/StudioUnavailable';

/**
 * Kit Studio v2 — page serveur (P1).
 *
 * Règle de production : le jeu de démonstration n'est affiché QUE sur `?debug=1` explicite
 * (comme la maquette de référence), avec un bandeau permanent. Toute autre requête :
 * - sans session → redirection `/connexion?next=/kit-studio` (convention du dépôt, cf.
 *   `/inscription` et `/connexion`) ;
 * - session sans kit → état vide explicite (CTA création de kit) ;
 * - base indisponible → état « indisponible » avec réessai ; repli possible sur le dernier
 *   cache serveur RÉEL côté client, jamais sur la démonstration.
 * La donnée réelle est lue ici (RLS, session) puis injectée au client, qui remplace le
 * registre de démonstration avant d'hydrater le store.
 */
export const dynamic = 'force-dynamic';

const NEXT_PATH = '/kit-studio';

export default async function KitStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ debug?: string | string[]; kit?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawKit = Array.isArray(params.kit) ? params.kit[0] : params.kit;
  const requestedKitId = typeof rawKit === 'string' && rawKit.trim() ? rawKit.trim() : undefined;
  const state = await resolveStudioPageState({
    debug: params.debug,
    next: NEXT_PATH,
    getUser: async () => {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user ? { id: user.id } : null;
    },
    getData: async (userId) => {
      const supabase = await createClient();
      return getStudioData(userId, requestedKitId, supabase);
    },
  });

  switch (state.kind) {
    case 'debug':
      return <KitStudioClient mode="debug" />;
    case 'login':
      return <StudioEmptyState unauthenticated />;
    case 'empty':
      return <StudioEmptyState />;
    case 'unavailable':
      return <StudioUnavailable />;
    case 'studio':
      return <KitStudioClient mode="server" initialData={state.data} />;
  }
}
