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

/**
 * Deux facons d'ouvrir le preparateur d'aventure, une seule route.
 *
 * `?nouvelle=1` -- production. C'est le lien des deux CTA "Preparer une
 *   activite" : la pastille du hub et l'action du tiroir d'aventures. Il
 *   exprime une intention explicite -- ouvrir le nouveau flux -- et il gagne
 *   donc meme quand une aventure est deja active. Sans ce parametre, la route
 *   garde son comportement historique (le preparateur detaille de l'aventure en
 *   cours) : aucun lien existant ne change de destination.
 *
 * `?apercu=aventure` -- developpement uniquement. Meme effet, mais refuse en
 *   production : c'est une porte de test, pas une URL a publier. Le
 *   developpement garde ainsi un raccourci qui ne peut pas fuir.
 */
const isPreviewable = process.env.NODE_ENV !== 'production';

/** Valeurs acceptees pour activer le nouveau flux, par porte. */
const NEW_FLOW_VALUES = new Set(['1', 'oui', 'true', 'aventure']);

export default async function PreparatorPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; apercu?: string; nouvelle?: string }>;
}) {
  const { tab, apercu, nouvelle } = await searchParams;

  // Court-circuit avant toute lecture : l'ecran ignore ces donnees, inutile
  // de payer une requete Supabase pour l'afficher.
  const wantsNewFlow =
    NEW_FLOW_VALUES.has(nouvelle ?? '') || (isPreviewable && apercu === 'aventure');
  if (wantsNewFlow) return <AdventurePrepScreen />;

  const data = await getPreparatorData();
  if (!data) return <AdventurePrepScreen />;

  // Les anciens liens configurateur ouvrent directement l'onglet equipement
  // du preparateur : une seule page, jamais de configurateur a cote.
  const initialTab = tab === 'equipement' ? ('equipement' as const) : ('itineraire' as const);

  return <PreparatorView data={data} initialTab={initialTab} />;
}
