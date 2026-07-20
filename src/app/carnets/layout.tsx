import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mes carnets — Le Kit du Voyageur',
  robots: { index: false, follow: false },
};

export default function CarnetsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
