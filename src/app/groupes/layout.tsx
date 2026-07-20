import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Groupes — Le Kit du Voyageur',
  robots: { index: false, follow: false },
};

export default function GroupesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
