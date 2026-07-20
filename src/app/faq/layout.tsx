import { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Questions fréquentes — Le Kit du Voyageur',
  description: 'Trouvez les réponses à vos questions sur les commandes, livraisons, retours, le configurateur IA et votre compte.',
  alternates: {
    canonical: `${siteUrl}/faq`,
  },
  openGraph: {
    title: 'Questions fréquentes — Le Kit du Voyageur',
    description: 'Trouvez les réponses à vos questions sur les commandes, livraisons, retours, le configurateur IA et votre compte.',
    url: `${siteUrl}/faq`,
    type: 'website',
  },
};

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
