import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Événements & Rencontres',
  description:
    'Découvrez les sorties organisées par la communauté : randonnées, bushcraft, vanlife et alpinisme. Inscrivez-vous aux événements près de chez vous.',
  openGraph: {
    title: 'Événements & Rencontres',
    description:
      'Découvrez les sorties organisées par la communauté : randonnées, bushcraft, vanlife et alpinisme. Inscrivez-vous aux événements près de chez vous.',
  },
  twitter: {
    title: 'Événements & Rencontres',
    description:
      'Découvrez les sorties organisées par la communauté : randonnées, bushcraft, vanlife et alpinisme. Inscrivez-vous aux événements près de chez vous.',
  },
};

export default function EvenementsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
