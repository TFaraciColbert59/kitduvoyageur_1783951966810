import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Inscription — Le Kit du Voyageur',
  description: 'Créez votre compte Le Kit du Voyageur.',
  robots: { index: false, follow: true },
};

export default function InscriptionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
