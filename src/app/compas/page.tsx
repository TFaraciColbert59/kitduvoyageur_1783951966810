import type { Metadata } from 'next';
import AppShell from '@/components/shell/AppShell';
import { COMPAS_STEPS, type CompasStepId } from '@/features/compas/engine/compasModel';
import { CompasScreen } from '@/features/compas/components/CompasScreen';
import { getCompasData } from '@/features/compas/server/getCompasData';
import { listCompasTrips } from '@/features/compas/server/myTrips';
import { CompasTripPicker } from '@/features/compas/components/CompasTripPicker';
import AdventurePrepScreen from '@/features/adventure-prep/components/AdventurePrepScreen';
import '@/features/compas/compas.css';

/**
 * Compas — le préparateur de voyage (il remplace `/prepare`, qui redirige ici),
 * branché sur les données réelles de l'aventure active du hub.
 *
 * Trois états, une seule route :
 *   - aventure active   -> le Compas ;
 *   - aucune aventure active mais des voyages -> le choix du voyage à préparer ;
 *   - aucun voyage, ou `?nouvelle=1` (intention explicite de créer) ->
 *     le flux de création d'aventure.
 *
 * `?etape=ou|nous|resa|verdict|kit` ouvre directement une étape (ex. `kit` pour
 * les anciens liens « configurateur »). Le rendu dépend de la session :
 * jamais prérendu.
 */
export const dynamic = 'force-dynamic';

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

  // Intention explicite : elle gagne même si une aventure est déjà active, et
  // évite une lecture de base inutile.
  if (NEW_FLOW_VALUES.has(nouvelle ?? '')) return <AdventurePrepScreen />;

  const data = await getCompasData();
  if (!data) {
    // Aucune aventure active : choisir parmi ses voyages s'il y en a, sinon créer.
    const trips = await listCompasTrips();
    if (trips.length === 0) return <AdventurePrepScreen />;
    return (
      <AppShell hasBottomNav videoBackground={false}>
        <CompasTripPicker trips={trips} />
      </AppShell>
    );
  }

  const initialStep = STEP_IDS.has(etape ?? '') ? (etape as CompasStepId) : undefined;

  return (
    // Fond peint par `.cp-bg` (paysage éclairci de la maquette) : la toile
    // globale assombrie n'est pas rendue sur cette route.
    <AppShell hasBottomNav videoBackground={false}>
      <CompasScreen data={data} initialStep={initialStep} />
    </AppShell>
  );
}
