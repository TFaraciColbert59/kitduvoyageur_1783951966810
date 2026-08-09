import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Connexion',
  description: 'Connectez-vous à votre compte Le Kit du Voyageur.',
  alternates: {
    canonical: `${siteUrl}/connexion`,
  },
  openGraph: {
    title: 'Connexion',
    description: 'Connectez-vous à votre compte Le Kit du Voyageur.',
  },
  robots: { index: false, follow: true },
};

export default function ConnexionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
