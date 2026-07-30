import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Mes carnets',
  description:
    "Consultez et gérez vos carnets de voyage : récits d'expéditions, souvenirs de vos aventures et partagez vos expériences avec la communauté.",
  alternates: {
    canonical: `${siteUrl}/carnets`,
  },
  openGraph: {
    title: 'Mes carnets',
    description:
      "Consultez et gérez vos carnets de voyage : récits d'expéditions, souvenirs de vos aventures et partagez vos expériences avec la communauté.",
  },
  robots: { index: true, follow: true },
};

export default function CarnetsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
