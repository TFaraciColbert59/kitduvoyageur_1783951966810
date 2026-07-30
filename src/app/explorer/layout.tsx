import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Explorer — Sentiers & Randonnées',
  description:
    'Découvrez les plus beaux sentiers de randonnée et trails. Carte interactive, filtres par difficulté et durée, et fiches détaillées pour préparer vos aventures outdoor.',
  openGraph: {
    title: 'Explorer — Sentiers & Randonnées',
    description:
      'Découvrez les plus beaux sentiers de randonnée et trails. Carte interactive, filtres par difficulté et durée, et fiches détaillées pour préparer vos aventures outdoor.',
  },
  twitter: {
    title: 'Explorer — Sentiers & Randonnées',
    description:
      'Découvrez les plus beaux sentiers de randonnée et trails. Carte interactive, filtres par difficulté et durée, et fiches détaillées pour préparer vos aventures outdoor.',
  },
};

export default function ExplorerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
