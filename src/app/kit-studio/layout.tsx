import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { KitStudioLightTheme } from '@/features/kit-studio/ui/KitStudioLightTheme';

/** Écran de travail personnel : jamais indexé, thème clair forcé comme le Compas. */
export const metadata: Metadata = {
  title: 'Kit Studio',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: 'white',
  viewportFit: 'cover',
};

export default function KitStudioLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <KitStudioLightTheme />
      {children}
    </>
  );
}
