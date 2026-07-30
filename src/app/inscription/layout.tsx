import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Inscription',
  description: 'Créez votre compte Le Kit du Voyageur.',
  alternates: {
    canonical: `${siteUrl}/inscription`,
  },
  openGraph: {
    title: 'Inscription',
    description: 'Créez votre compte Le Kit du Voyageur.',
  },
  robots: { index: false, follow: true },
};

export default function InscriptionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
