import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AppShell from '@/components/shell/AppShell';
import { canOpenCompasLab } from '@/features/compas/dev/labPolicy';
import { LiveMapLab } from './LiveMapLab';

/**
 * Banc visuel de la carte vivante du Compas v5 : `LiveMap` sur des données d'EXEMPLE, sans compte ni base.
 * Introuvable hors `next dev` (même garde que `/dev/compas`, testée dans `labPolicy.test.ts`).
 */
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Banc de la carte Compas v5',
  robots: { index: false, follow: false },
};

export default function CompasV5CartePage() {
  if (!canOpenCompasLab(process.env.NODE_ENV)) notFound();
  return (
    <AppShell hasBottomNav videoBackground={false}>
      <LiveMapLab />
    </AppShell>
  );
}
