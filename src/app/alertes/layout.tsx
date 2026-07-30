import type { Metadata } from 'next';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Alertes & Notifications',
  description: 'G\u00e9rez vos alertes et notifications personnalis\u00e9es : rappels de voyage, changements de prix, offres exclusives et conditions m\u00e9t\u00e9o pour vos destinations.',
  alternates: {
    canonical: `${siteUrl}/alertes`,
  },

  openGraph: {
    title: 'Alertes & Notifications',
    description: 'G\u00e9rez vos alertes et notifications personnalis\u00e9es : rappels de voyage, changements de prix, offres exclusives et conditions m\u00e9t\u00e9o pour vos destinations.',
  },
};

export default function AlertesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
