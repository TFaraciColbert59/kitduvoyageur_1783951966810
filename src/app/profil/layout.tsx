import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profil — Le Kit du Voyageur',
  robots: { index: false, follow: false },
};

export default function ProfilLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
