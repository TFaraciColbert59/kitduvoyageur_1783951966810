import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Rapport kit',
  description:
    "Analyse compl\u00e8te de votre kit de voyage : poids par cat\u00e9gorie, optimisation du mat\u00e9riel, \u00e9quipement recommand\u00e9 et suggestions d'all\u00e8gement.",
  alternates: {
    canonical: `${siteUrl}/rapport-kit`,
  },
  openGraph: {
    title: 'Rapport kit',
    description:
      "Analyse compl\u00e8te de votre kit de voyage : poids par cat\u00e9gorie, optimisation du mat\u00e9riel et suggestions d'all\u00e8gement.",
  },
  robots: { index: false, follow: false },
};

export default function RapportKitLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
