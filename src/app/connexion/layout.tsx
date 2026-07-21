import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Connexion — Le Kit du Voyageur',
  description: 'Connectez-vous à votre compte Le Kit du Voyageur.',
  robots: { index: false, follow: true },
};

export default function ConnexionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
