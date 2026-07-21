import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Groupe — Le Kit du Voyageur',
  robots: { index: false, follow: false },
};

export default function GroupeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
