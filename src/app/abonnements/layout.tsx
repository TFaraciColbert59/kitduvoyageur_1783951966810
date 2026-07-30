import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Abonnements Premium',
  description:
    'Choisissez votre abonnement : Explorer gratuit, Aventurier avec configurateur IA illimité, ou Expédition avec box mensuelle. Équipement outdoor livré chaque mois.',
  openGraph: {
    title: 'Abonnements Premium',
    description:
      'Choisissez votre abonnement : Explorer gratuit, Aventurier avec configurateur IA illimité, ou Expédition avec box mensuelle. Équipement outdoor livré chaque mois.',
  },
  twitter: {
    title: 'Abonnements Premium',
    description:
      'Choisissez votre abonnement : Explorer gratuit, Aventurier avec configurateur IA illimité, ou Expédition avec box mensuelle. Équipement outdoor livré chaque mois.',
  },
};

export default function AbonnementsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
