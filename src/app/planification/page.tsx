import type { Metadata } from 'next';
import PlanningScreen from '@/components/planning/PlanningScreen';

export const metadata: Metadata = {
  title: 'Planification multi-jours · Le Kit du Voyageur',
  description:
    'Découpez un tracé en étapes, ajustez les bornes, ancrez un refuge, vérifiez la météo et partagez un plan multi-jours.',
  alternates: {
    canonical: '/planification',
  },
  openGraph: {
    title: 'Planification multi-jours · Le Kit du Voyageur',
    description:
      'Un espace dédié aux plans multi-jours : étapes indépendantes, fuseaux explicites, météo réelle et partage P01.',
    type: 'website',
    locale: 'fr_FR',
  },
};

export default function PlanificationPage() {
  return <PlanningScreen />;
}
