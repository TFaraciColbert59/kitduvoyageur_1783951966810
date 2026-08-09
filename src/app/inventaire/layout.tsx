import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Inventaire',
  description:
    "Gérez votre inventaire d'équipement outdoor : suivez votre matériel, son état, son poids et organisez-le par kits de voyage.",
  alternates: {
    canonical: `${siteUrl}/inventaire`,
  },
  openGraph: {
    title: 'Inventaire',
    description:
      "Gérez votre inventaire d'équipement outdoor : suivez votre matériel, son état, son poids et organisez-le par kits de voyage.",
  },
  robots: { index: false, follow: false },
};

export default function InventaireLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
