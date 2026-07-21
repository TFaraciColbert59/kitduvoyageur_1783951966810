import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mes aventures — Le Kit du Voyageur',
  robots: { index: false, follow: false },
};

export default function MesAventuresLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
