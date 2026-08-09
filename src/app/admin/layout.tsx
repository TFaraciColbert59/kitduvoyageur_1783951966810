import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Administration',
  description:
    "Interface d'administration du site Le Kit du Voyageur : gestion des produits, commandes, utilisateurs et contenu.",
  alternates: {
    canonical: `${siteUrl}/admin`,
  },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
