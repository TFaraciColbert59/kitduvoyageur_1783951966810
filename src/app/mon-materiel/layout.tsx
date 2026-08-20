import type { Metadata } from 'next';
import { CockpitFrame } from '@/features/mon-materiel/components/CockpitFrame';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Mon Matériel & Inventaire',
  description: 'Inventaire complet de votre équipement outdoor et calcul de poids pour vos expéditions.',
  alternates: {
    canonical: `${siteUrl}/mon-materiel`,
  },
  robots: { index: false, follow: false },
};

/**
 * Layout Server Component : pose le cadre global du cockpit
 * (fond animé + migration storage v3) via le client component `CockpitFrame`.
 */
export default function MonMaterielLayout({ children }: { children: React.ReactNode }) {
  return (
    <CockpitFrame>{children}</CockpitFrame>
  );
}