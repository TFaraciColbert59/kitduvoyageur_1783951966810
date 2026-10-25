import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Préparer ma randonnée',
  description: 'Assistant de préparation et check matériel pour votre itinéraire de randonnée.',
  alternates: {
    canonical: `${siteUrl}/preparer-randonnee`,
  },
  robots: { index: false, follow: false },
};

export default function PreparerRandonneeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
