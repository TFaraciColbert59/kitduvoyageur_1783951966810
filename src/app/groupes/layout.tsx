import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Groupes de voyage',
  description:
    "Créez ou rejoignez des groupes de voyage collaboratifs : organisez des expéditions, partagez les tâches, gérez le budget et partez ensemble à l'aventure.",
  alternates: {
    canonical: `${siteUrl}/groupes`,
  },
  openGraph: {
    title: 'Groupes de voyage',
    description:
      "Créez ou rejoignez des groupes de voyage collaboratifs : organisez des expéditions, partagez les tâches, gérez le budget et partez ensemble à l'aventure.",
  },
  robots: { index: false, follow: false },
};

export default function GroupesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
