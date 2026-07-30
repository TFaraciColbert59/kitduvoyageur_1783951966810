import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ambassadeurs & Créateurs',
  description:
    'Rejoignez le programme ambassadeurs du Kit du Voyageur. Partagez votre passion pour l\'outdoor et gagnez des commissions en recommandant nos produits.',
  openGraph: {
    title: 'Ambassadeurs & Créateurs',
    description:
      'Rejoignez le programme ambassadeurs du Kit du Voyageur. Partagez votre passion pour l\'outdoor et gagnez des commissions en recommandant nos produits.',
  },
  twitter: {
    title: 'Ambassadeurs & Créateurs',
    description:
      'Rejoignez le programme ambassadeurs du Kit du Voyageur. Partagez votre passion pour l\'outdoor et gagnez des commissions en recommandant nos produits.',
  },
};

export default function AmbassadeursLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
