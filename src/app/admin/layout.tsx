import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Administration — Le Kit du Voyageur',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
