import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Randonnée Active & Cockpit GPS',
  description: 'Navigation GPS en temps réel, télémétrie et suivi d’itinéraire sur les sentiers.',
  alternates: {
    canonical: `${siteUrl}/randonnee-active`,
  },
  robots: { index: false, follow: false },
};

export default function RandonneeActiveLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
