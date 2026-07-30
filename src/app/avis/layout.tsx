import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Avis & Témoignages',
  description:
    'Consultez les avis vérifiés de la communauté sur les produits, kits, locations et articles d\'occasion. Partagez votre expérience et aidez les autres voyageurs.',
  openGraph: {
    title: 'Avis & Témoignages',
    description:
      'Consultez les avis vérifiés de la communauté sur les produits, kits, locations et articles d\'occasion. Partagez votre expérience et aidez les autres voyageurs.',
  },
  twitter: {
    title: 'Avis & Témoignages',
    description:
      'Consultez les avis vérifiés de la communauté sur les produits, kits, locations et articles d\'occasion. Partagez votre expérience et aidez les autres voyageurs.',
  },
};

export default function AvisLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
