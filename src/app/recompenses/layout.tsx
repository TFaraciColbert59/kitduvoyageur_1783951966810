import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Récompenses',
  description: 'Vos points Le Kit du Voyageur : solde, objectif choisi, récompenses disponibles et historique.',
  alternates: {
    canonical: `${siteUrl}/recompenses`,
  },
  robots: { index: false, follow: false },
};

export default function RecompensesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
