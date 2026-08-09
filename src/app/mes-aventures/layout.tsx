import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Mes aventures',
  description:
    'Retrouvez toutes vos aventures et expéditions : voyages passés, à venir, statistiques et souvenirs de vos explorations outdoor.',
  alternates: {
    canonical: `${siteUrl}/mes-aventures`,
  },
  openGraph: {
    title: 'Mes aventures',
    description:
      'Retrouvez toutes vos aventures et expéditions : voyages passés, à venir, statistiques et souvenirs de vos explorations outdoor.',
  },
  robots: { index: false, follow: false },
};

export default function MesAventuresLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
