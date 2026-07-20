import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Inventaire — Le Kit du Voyageur',
  robots: { index: false, follow: false },
};

export default function InventaireLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
