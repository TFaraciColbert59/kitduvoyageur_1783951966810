import { redirect } from 'next/navigation';
import { getPreparatorData } from '@/features/preparator/server/getPreparatorData';
import { PreparatorView } from '@/features/preparator/components/PreparatorView';

/**
 * Préparateur de voyage — route unique, toutes activités.
 *
 * Elle remplace les configurateurs : une seule page qui prépare le voyage
 * entier (trace, POI, nuitées, transports, tables, budget, check-list). Sans
 * aventure active, on redirige vers la création — jamais de page vide.
 *
 * Le rendu est auth/cookie-driven (aventure active) : jamais prérendu statique.
 */
export const dynamic = 'force-dynamic';

export default async function PreparatorPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const data = await getPreparatorData();
  if (!data) redirect('/hub/nouveau');

  // Les anciens liens configurateur ouvrent directement l'onglet equipement
  // du preparateur : une seule page, jamais de configurateur a cote.
  const { tab } = await searchParams;
  const initialTab = tab === 'equipement' ? ('equipement' as const) : ('itineraire' as const);

  return <PreparatorView data={data} initialTab={initialTab} />;
}
