import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mon compte — Le Kit du Voyageur',
  robots: { index: false, follow: false },
};

export default function CompteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
