import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: "Rapport d'exp\u00e9dition",
  description:
    "Analyse d\u00e9taill\u00e9e de votre exp\u00e9dition : statistiques de voyage, performances de l'\u00e9quipement, bilan carbone et recommandations personnalis\u00e9es.",
  alternates: {
    canonical: `${siteUrl}/rapport-expedition`,
  },
  openGraph: {
    title: "Rapport d'exp\u00e9dition",
    description:
      "Analyse d\u00e9taill\u00e9e de votre exp\u00e9dition : statistiques de voyage, performances de l'\u00e9quipement et recommandations.",
  },
  robots: { index: false, follow: false },
};

export default function RapportExpeditionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
