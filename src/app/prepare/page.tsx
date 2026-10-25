import { permanentRedirect } from 'next/navigation';

/**
 * `/prepare` est remplacée par `/compas` : cette route ne sert plus que de
 * passerelle pour les anciens liens, les favoris et les moteurs de recherche.
 *
 *   ?nouvelle=1 (ou ?apercu, en développement) -> /compas?nouvelle=1
 *   ?tab=equipement                            -> /compas?etape=kit
 *   tout le reste                              -> /compas
 *
 * `actions.ts`, voisin de ce fichier, reste ici : le flux de création
 * d'aventure l'importe.
 */
export const dynamic = 'force-dynamic';

const NEW_FLOW_VALUES = new Set(['1', 'oui', 'true', 'aventure']);
const isPreviewable = process.env.NODE_ENV !== 'production';

export default async function PrepareRedirect({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; apercu?: string; nouvelle?: string }>;
}) {
  const { tab, apercu, nouvelle } = await searchParams;
  if (NEW_FLOW_VALUES.has(nouvelle ?? '') || (isPreviewable && Boolean(apercu)))
    permanentRedirect('/compas?nouvelle=1');
  if (tab === 'equipement') permanentRedirect('/compas?etape=kit');
  permanentRedirect('/compas');
}
