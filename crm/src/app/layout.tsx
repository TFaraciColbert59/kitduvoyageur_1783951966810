import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LKDV Control',
  description: "Le CRM externe du Kit du Voyageur",
  robots: { index: false, follow: false, nocache: true }
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#F5F7F3' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
