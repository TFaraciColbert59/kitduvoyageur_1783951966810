import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Profil voyageur',
  description:
    "Découvrez le profil d'un voyageur de la communauté Le Kit du Voyageur : ses aventures, son équipement, ses carnets et ses expéditions.",
  alternates: {
    canonical: `${siteUrl}/profil`,
  },
  openGraph: {
    title: 'Profil voyageur',
    description:
      "Découvrez le profil d'un voyageur de la communauté Le Kit du Voyageur : ses aventures, son équipement et ses carnets.",
  },
  robots: { index: false, follow: false },
};

export default function ProfilLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
