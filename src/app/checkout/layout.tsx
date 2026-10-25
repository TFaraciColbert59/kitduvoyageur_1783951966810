import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Finaliser ma commande',
  description:
    'Finalisez votre commande sur Le Kit du Voyageur : adresse de livraison, mode de paiement sécurisé et récapitulatif de votre panier.',
  alternates: {
    canonical: `${siteUrl}/checkout`,
  },
  openGraph: {
    title: 'Finaliser ma commande',
    description:
      'Finalisez votre commande sur Le Kit du Voyageur : adresse de livraison, mode de paiement sécurisé et récapitulatif de votre panier.',
  },
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
