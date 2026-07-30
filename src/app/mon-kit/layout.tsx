import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Mon kit',
  description:
    "Visualisez et optimisez votre kit de voyage : poids total, équipement sélectionné, recommandations personnalisées et préparation au départ.",
  alternates: {
    canonical: `${siteUrl}/mon-kit`,
  },
  openGraph: {
    title: 'Mon kit',
    description:
      "Visualisez et optimisez votre kit de voyage : poids total, équipement sélectionné et recommandations personnalisées.",
  },
  robots: { index: false, follow: false },
};

export default function MonKitLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
