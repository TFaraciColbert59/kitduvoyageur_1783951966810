import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Carte Interactive — Sentiers & POI',
  description:
    'Accédez à la carte interactive des sentiers de randonnée, points d\'intérêt et spots outdoor. Visualisez les trails et préparez vos prochaines explorations.',
  openGraph: {
    title: 'Carte Interactive — Sentiers & POI',
    description:
      'Accédez à la carte interactive des sentiers de randonnée, points d\'intérêt et spots outdoor. Visualisez les trails et préparez vos prochaines explorations.',
  },
  twitter: {
    title: 'Carte Interactive — Sentiers & POI',
    description:
      'Accédez à la carte interactive des sentiers de randonnée, points d\'intérêt et spots outdoor. Visualisez les trails et préparez vos prochaines explorations.',
  },
};

export default function CarteInteractiveLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
