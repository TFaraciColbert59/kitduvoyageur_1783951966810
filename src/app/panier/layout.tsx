import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Panier',
  description:
    "Consultez votre panier Le Kit du Voyageur : récapitulatif des articles, quantités, poids total et montant avant validation de la commande.",
  alternates: {
    canonical: `${siteUrl}/panier`,
  },
  openGraph: {
    title: 'Panier',
    description:
      "Consultez votre panier Le Kit du Voyageur : récapitulatif des articles, quantités et montant avant validation.",
  },
  robots: { index: false, follow: false },
};

export default function PanierLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
