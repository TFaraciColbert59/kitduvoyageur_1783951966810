import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Messagerie',
  description:
    'Consultez et gérez vos messages privés : échangez avec les membres de la communauté, vos groupes de voyage et vos compagnons d\'expédition.',
  alternates: {
    canonical: `${siteUrl}/messagerie`,
  },
  openGraph: {
    title: 'Messagerie',
    description:
      'Consultez et gérez vos messages privés : échangez avec les membres de la communauté et vos groupes de voyage.',
  },
  robots: { index: false, follow: false },
};

export default function MessagerieLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
