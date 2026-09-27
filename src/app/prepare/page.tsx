import type { Metadata } from 'next';
import { getPreparatorData } from '@/features/preparator/server/getPreparatorData';
import { PreparatorView } from '@/features/preparator/components/PreparatorView';
import AdventurePrepScreen from '@/features/adventure-prep/components/AdventurePrepScreen';

/**
 * Préparateur de voyage — route unique, toutes activités.
 *
 * Elle remplace les configurateurs : une seule page qui prépare le voyage
 * entier (trace, POI, nuitées, transports, tables, budget, check-list).
 *
 * Deux états, une seule route :
 *   - aventure active   -> le preparateur detaille de l'aventure existante ;
 *   - aucune aventure   -> le preparateur d'aventure, en materiau Liquid Glass
 *                          iOS 27 (activite, parcours, itineraire, depart).
 *
 * Le second etat remplace une redirection aveugle vers la creation : on guide
 * la personne dans le flux au lieu de la renvoyer vers un formulaire sans
 * contexte.
 *
 * Le rendu est auth/cookie-driven (aventure active) : jamais prérendu statique.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Préparer — Kit du Voyageur',
  description:
    'Prépare ton activité : parcours, étapes, équipement et eau. Sans score, sans donnée inventée.',
};

export default async function PreparatorPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const data = await getPreparatorData();
  if (!data) return <AdventurePrepScreen />;

  // Les anciens liens configurateur ouvrent directement l'onglet equipement
  // du preparateur : une seule page, jamais de configurateur a cote.
  const { tab } = await searchParams;
  const initialTab = tab === 'equipement' ? ('equipement' as const) : ('itineraire' as const);

  return <PreparatorView data={data} initialTab={initialTab} />;
}
