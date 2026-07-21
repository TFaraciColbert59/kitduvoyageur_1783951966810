import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Commande — Le Kit du Voyageur',
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
