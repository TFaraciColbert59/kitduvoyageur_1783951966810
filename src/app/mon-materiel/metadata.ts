import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Mon Matériel & Inventaire',
  description: 'Inventaire complet de votre équipement outdoor et calcul de poids pour vos expéditions.',
  alternates: {
    canonical: `${siteUrl}/mon-materiel`,
  },
  robots: { index: false, follow: false },
};