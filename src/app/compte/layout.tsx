import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Mon compte',
  description:
    'Gérez votre profil, vos commandes, vos abonnements, votre inventaire et tous vos voyages depuis votre tableau de bord Le Kit du Voyageur.',
  alternates: {
    canonical: `${siteUrl}/compte`,
  },
  openGraph: {
    title: 'Mon compte',
    description:
      'Gérez votre profil, vos commandes, vos abonnements, votre inventaire et tous vos voyages depuis votre tableau de bord.',
  },
  robots: { index: false, follow: false },
};

export default function CompteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
