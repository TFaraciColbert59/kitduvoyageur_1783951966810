import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rapport kit — Le Kit du Voyageur',
  robots: { index: false, follow: false },
};

export default function RapportKitLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
