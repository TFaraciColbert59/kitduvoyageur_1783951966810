import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Destinations Voyage & Aventure',
  description:
    'Explorez tous les pays du monde avec Le Kit du Voyageur : fiches destinations, conseils de sécurité, activités outdoor et équipement recommandé pour chaque pays.',
  openGraph: {
    title: 'Destinations Voyage & Aventure',
    description:
      'Explorez tous les pays du monde avec Le Kit du Voyageur : fiches destinations, conseils de sécurité, activités outdoor et équipement recommandé pour chaque pays.',
  },
  twitter: {
    title: 'Destinations Voyage & Aventure',
    description:
      'Explorez tous les pays du monde avec Le Kit du Voyageur : fiches destinations, conseils de sécurité, activités outdoor et équipement recommandé pour chaque pays.',
  },
};

export default function PaysLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
