import { redirect } from 'next/navigation';

/**
 * Fusion des configurateurs — l'equipement est desormais un ONGLET du
 * preparateur de voyage unique. Cette route n'est plus une page : elle
 * redirige (307) vers /preparer?tab=equipement en conservant tous les
 * parametres utiles (country, groupId, carnetId, trail) lus par l'assistant.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Equipement · Preparateur de voyage · Le Kit du Voyageur',
  description:
    'Assistant equipement integre au preparateur de voyage : composez le sac du voyage actif.',
  robots: { index: false, follow: true },
};

export default async function ConfiguratorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const incoming = await searchParams;
  const params = new URLSearchParams();
  params.set('tab', 'equipement');
  for (const [key, value] of Object.entries(incoming)) {
    if (key === 'tab' || value == null) continue;
    params.set(key, Array.isArray(value) ? value[0] : value);
  }
  redirect(`/preparer?${params.toString()}`);
}
