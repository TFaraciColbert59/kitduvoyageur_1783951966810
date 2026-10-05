import { CompasLightTheme } from '@/features/compas/components/CompasLightTheme';
import type { Metadata } from 'next';
import AppShell from '@/components/shell/AppShell';
import { COMPAS_STEPS, type CompasStepId } from '@/features/compas/engine/compasModel';
import { CompasScreen } from '@/features/compas/components/CompasScreen';
import { getCompasData } from '@/features/compas/server/getCompasData';
import { listCompasTrips } from '@/features/compas/server/myTrips';
import { CompasTripPicker } from '@/features/compas/components/CompasTripPicker';
import { CompasStart } from '@/features/compas/components/CompasStart';
import { createClient } from '@/lib/supabase/server';
import { listMyTripInvitations } from '@/features/compas/server/invitationActions';
import '@/features/compas/compas.css';

/**
 * Compas — le préparateur de voyage (il remplace `/prepare`, qui redirige ici),
 * branché sur les données réelles de l'aventure active du hub.
 *
 * Trois états, une seule route :
 *   - aventure active   -> le Compas ;
 *   - aucune aventure active mais des voyages -> le choix du voyage à préparer ;
 *   - aucun voyage, ou `?nouvelle=1` (intention explicite de créer) ->
 *     le Compas vide : le premier geste crée l'aventure (préparateur unique,
 *     l'ancien flux de création en trois étapes n'existe plus).
 *
 * `?etape=ou|nous|resa|verdict|kit` ouvre directement une étape (ex. `kit` pour
 * les anciens liens « configurateur »). Le rendu dépend de la session :
 * jamais prérendu.
 */
export const dynamic = 'force-dynamic';
/** Le préremplissage d'un long voyage (étapes, cartes, IA) peut prendre près d'une minute. */
export const maxDuration = 60;

export const metadata: Metadata = {
  title: 'Compas — Kit du Voyageur',
  description:
    'Où, quand, avec qui, quoi réserver et quoi emporter : tout le voyage au même endroit, sans score ni donnée inventée.',
};

/** Valeurs acceptées pour ouvrir le flux de création, par porte. */
const NEW_FLOW_VALUES = new Set(['1', 'oui', 'true', 'aventure']);
const STEP_IDS = new Set<string>(COMPAS_STEPS.map((s) => s.id));

export default async function CompasPage({
  searchParams,
}: {
  searchParams: Promise<{ nouvelle?: string; etape?: string }>;
}) {
  const { nouvelle, etape } = await searchParams;

  const start = async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const invitations = user ? await listMyTripInvitations() : [];
    return (
      <AppShell hasBottomNav videoBackground={false}>
        <CompasLightTheme />
        <CompasStart signedIn={Boolean(user)} invitations={invitations} />
      </AppShell>
    );
  };

  // Intention explicite : elle gagne même si une aventure est déjà active, et
  // évite une lecture de base inutile.
  if (NEW_FLOW_VALUES.has(nouvelle ?? '')) return start();

  const data = await getCompasData();
  if (!data) {
    // Aucune aventure active : choisir parmi ses voyages s'il y en a, sinon créer.
    const [trips, invitations] = await Promise.all([listCompasTrips(), listMyTripInvitations()]);
    if (trips.length === 0) return start();
    return (
      <AppShell hasBottomNav videoBackground={false}>
        <CompasLightTheme />
        <CompasTripPicker trips={trips} invitations={invitations} />
      </AppShell>
    );
  }

  const initialStep = STEP_IDS.has(etape ?? '') ? (etape as CompasStepId) : undefined;

  return (
    // Fond peint par `.cp-bg` (paysage éclairci de la maquette) : la toile
    // globale assombrie n'est pas rendue sur cette route.
    <AppShell hasBottomNav videoBackground={false}>
      <CompasLightTheme />
      <CompasScreen data={data} initialStep={initialStep} />
    </AppShell>
  );
}
