import { redirect } from 'next/navigation';

/**
 * Fusion des configurateurs — l'equipement est desormais l'etape « Kit » du
 * Compas, le preparateur de voyage unique. Cette route n'est plus une page :
 * elle redirige (307) vers /compas?etape=kit.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Equipement · Compas · Le Kit du Voyageur',
  description: 'Assistant equipement integre au Compas : composez le sac du voyage actif.',
  robots: { index: false, follow: true },
};

export default function ConfiguratorPage() {
  redirect('/compas?etape=kit');
}
