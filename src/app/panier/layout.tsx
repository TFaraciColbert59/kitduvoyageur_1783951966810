import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Panier — Le Kit du Voyageur',
  robots: { index: false, follow: false },
};

export default function PanierLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
