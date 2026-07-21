import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mon kit — Le Kit du Voyageur',
  robots: { index: false, follow: false },
};

export default function MonKitLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
