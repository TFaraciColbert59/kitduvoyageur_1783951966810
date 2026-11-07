import { createClient } from '@/lib/supabase/server';
import type { StudioData } from '@/features/kit-studio/domain/studioData';
import { getStudioData } from '@/features/kit-studio/server/getStudioData';
import { KitStudioClient } from '@/features/kit-studio/ui/KitStudioClient';

/**
 * Kit Studio v2 — page serveur (P1).
 *
 * La donnée réelle est lue ici (RLS, session) puis injectée au client, qui remplace le registre
 * de démonstration avant d'hydrater le store. Sans session, sans kit, ou si la base est
 * indisponible, on repasse en repli local : l'écran ne casse pas (`KitStudioClient` reprend le
 * jeu de démonstration et le stockage local, comportement hors-ligne historique).
 */
export const dynamic = 'force-dynamic';

async function loadStudioData(): Promise<StudioData | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const data = await getStudioData(user.id, undefined, supabase);
    // Un compte sans kit n'a rien à afficher ici (la création de kit n'est pas du périmètre P1) :
    // repli local explicite plutôt qu'un studio vide.
    return data.kits.length > 0 ? data : null;
  } catch (e) {
    console.warn(
      '[kit-studio] données serveur indisponibles, repli local :',
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

export default async function KitStudioPage() {
  const data = await loadStudioData();
  return <KitStudioClient initialData={data} />;
}
