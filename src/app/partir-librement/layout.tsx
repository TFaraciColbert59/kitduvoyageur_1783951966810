import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Partir librement',
  description: 'Démarre le suivi d’activité sans itinéraire préparé.',
  alternates: { canonical: `${siteUrl}/partir-librement` },
  robots: { index: false, follow: false },
};

export default function PartirLibrementLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
