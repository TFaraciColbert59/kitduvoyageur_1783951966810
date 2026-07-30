import type { Metadata } from 'next';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Activit\u00e9 r\u00e9cente',
  description: 'Votre activit\u00e9 sur Le Kit du Voyageur : voyages, achats, avis et interactions avec la communaut\u00e9 de voyageurs.',
  alternates: {
    canonical: `${siteUrl}/activite`,
  },

  openGraph: {
    title: 'Activit\u00e9 r\u00e9cente',
    description: 'Votre activit\u00e9 sur Le Kit du Voyageur : voyages, achats, avis et interactions avec la communaut\u00e9 de voyageurs.',
  },
};

export default function ActiviteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
