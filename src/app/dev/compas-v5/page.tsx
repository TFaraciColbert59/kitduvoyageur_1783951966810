import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AppShell from '@/components/shell/AppShell';
import { CompasLightTheme } from '@/features/compas/components/CompasLightTheme';
import { labCompasData } from '@/features/compas/dev/labData';
import { canOpenCompasLab } from '@/features/compas/dev/labPolicy';
import { CompasV5Screen } from '@/features/compas/v5/CompasV5Screen';
import '@/features/compas/compas.css';

/**
 * Laboratoire du Compas v5 : l'écran COMPLET sur les données d'essai du laboratoire, sans compte ni base.
 * Sert aux captures de mise en page. Introuvable hors `next dev` (même garde que `/dev/compas`).
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export const metadata: Metadata = {
  title: 'Laboratoire du Compas v5',
  robots: { index: false, follow: false },
};

export default function CompasV5LabPage() {
  if (!canOpenCompasLab(process.env.NODE_ENV)) notFound();
  return (
    <AppShell hasBottomNav videoBackground={false}>
      <CompasLightTheme />
      <CompasV5Screen data={labCompasData()} />
    </AppShell>
  );
}
