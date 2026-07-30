import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Espace Professionnel — B2B',
  description:
    'Tarifs préférentiels, commandes groupées et outils dédiés pour les professionnels de l\'outdoor : guides, agences de voyage aventure et revendeurs B2B.',
  openGraph: {
    title: 'Espace Professionnel — B2B',
    description:
      'Tarifs préférentiels, commandes groupées et outils dédiés pour les professionnels de l\'outdoor : guides, agences de voyage aventure et revendeurs B2B.',
  },
  twitter: {
    title: 'Espace Professionnel — B2B',
    description:
      'Tarifs préférentiels, commandes groupées et outils dédiés pour les professionnels de l\'outdoor : guides, agences de voyage aventure et revendeurs B2B.',
  },
};

export default function ProLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
