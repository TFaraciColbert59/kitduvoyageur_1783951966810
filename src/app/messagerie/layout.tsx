import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Messagerie — Le Kit du Voyageur',
  robots: { index: false, follow: false },
};

export default function MessagerieLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
