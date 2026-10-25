import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Mes Récompenses & Cashback',
  description: 'Gérez vos gains, points d’activité et demandes de retrait Le Kit du Voyageur.',
  alternates: {
    canonical: `${siteUrl}/recompenses`,
  },
  robots: { index: false, follow: false },
};

export default function RecompensesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
