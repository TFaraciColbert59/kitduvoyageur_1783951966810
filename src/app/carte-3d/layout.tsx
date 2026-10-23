import type { Metadata, Viewport } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Carte 3D Vivante | Le Kit du Voyageur',
  description:
    'Explorez le relief mondial en 3D immersive, imagerie satellite haute-fidélité, drapeaux de sentiers, profil altimétrique et timeline interactive.',
  openGraph: {
    title: 'Carte Vivante 3D — Le Kit du Voyageur',
    description:
      'Explorez la montagne comme si vous y étiez : relief 3D, drapage satellite, timeline synchronisée et fiches refuges & sommets.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#111814',
};

export default function Carte3DLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 w-full h-[100dvh] overflow-hidden bg-[#111814]">
      {children}
    </div>
  );
}
