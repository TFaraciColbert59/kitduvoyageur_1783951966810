import type { Metadata } from 'next';

// Redirection permanente vers /recompenses (voir page.tsx) : rien à indexer.
export const metadata: Metadata = {
  title: 'Récompenses',
  robots: { index: false, follow: true },
};

export default function FideliteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
