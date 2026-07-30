import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Carte Interactive \u2014 Sentiers & POI',
  description:
    'Acc\u00e9dez \u00e0 la carte interactive des sentiers de randonn\u00e9e, points d\u2019int\u00e9r\u00eat et spots outdoor. Visualisez les trails et pr\u00e9parez vos prochaines explorations.',
  alternates: {
    canonical: `${siteUrl}/carte-interactive`,
  },

  openGraph: {
    title: 'Carte Interactive \u2014 Sentiers & POI',
    description:
      'Acc\u00e9dez \u00e0 la carte interactive des sentiers de randonn\u00e9e, points d\u2019int\u00e9r\u00eat et spots outdoor. Visualisez les trails et pr\u00e9parez vos prochaines explorations.',
  },
  twitter: {
    title: 'Carte Interactive \u2014 Sentiers & POI',
    description:
      'Acc\u00e9dez \u00e0 la carte interactive des sentiers de randonn\u00e9e, points d\u2019int\u00e9r\u00eat et spots outdoor. Visualisez les trails et pr\u00e9parez vos prochaines explorations.',
  },
};

export default function CarteInteractiveLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
