import type { Metadata } from 'next';
import AppShell from '@/components/shell/AppShell';
import FreeDepartureView from '@/features/free-departure/components/FreeDepartureView';
import '@/features/adventure-prep/adventure-prep.css';

/**
 * « Partir librement » — demarrage sans itineraire (A3 / A11).
 *
 * Route separee de `/prepare` : la preparation en trois etapes et le depart
 * immediat sont deux decisions opposees, pas deux etapes du meme parcours.
 * Meme materiau que le preparateur (`adventure-prep.css`) et meme calcul de
 * hauteur : `hasBottomNav={false}` occupe tout l'ecran, la barre d'onglets
 * n'a pas sa place avant une sortie.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Partir librement — Kit du Voyageur',
  description:
    'Démarre le suivi sans itinéraire préparé. La localisation est expliquée avant d’être demandée.',
};

export default function PartirLibrementPage() {
  return (
    <AppShell hasBottomNav={false} videoBackground={false} className="app-shell--preparer">
      <FreeDepartureView />
    </AppShell>
  );
}
