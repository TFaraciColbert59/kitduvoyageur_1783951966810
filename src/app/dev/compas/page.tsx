import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AppShell from '@/components/shell/AppShell';
import { CompasLightTheme } from '@/features/compas/components/CompasLightTheme';
import { CompasScreen } from '@/features/compas/components/CompasScreen';
import { labCompasData } from '@/features/compas/dev/labData';
import { canOpenCompasLab } from '@/features/compas/dev/labPolicy';
import '@/features/compas/compas.css';

/**
 * Laboratoire du Compas : l'écran COMPLET sur des données d'essai (`dev/labData.ts`), sans compte ni
 * base. Sert aux captures de mise en page (mobile, tablette, bureau). Introuvable hors `next dev` (garde testée : `labPolicy.test.ts`).
 */
export const dynamic = 'force-dynamic';
/** Héberge `CompasScreen`, donc les actions de préparation : même durée que `/compas` (en développement seulement). */
export const maxDuration = 300;
export const metadata: Metadata = {
  title: 'Laboratoire du Compas',
  robots: { index: false, follow: false },
};

export default function CompasLabPage() {
  if (!canOpenCompasLab(process.env.NODE_ENV)) notFound();
  return (
    <AppShell hasBottomNav videoBackground={false}>
      <CompasLightTheme />
      <CompasScreen data={labCompasData()} />
    </AppShell>
  );
}
