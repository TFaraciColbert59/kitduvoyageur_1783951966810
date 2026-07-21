import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rapport d\'expédition — Le Kit du Voyageur',
  robots: { index: false, follow: false },
};

export default function RapportExpeditionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
