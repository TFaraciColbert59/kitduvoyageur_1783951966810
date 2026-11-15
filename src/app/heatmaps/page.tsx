import type { Metadata } from 'next';
import AppShell from '@/components/shell/AppShell';
import HeatmapsScreen from '@/components/heatmaps/HeatmapsScreen';

export const metadata: Metadata = {
  title: 'Heatmaps — Le Kit du Voyageur',
  description:
    'Heatmaps communautaires et personnelles : densité de passage par sport, fenêtre de sept jours, passages nocturnes, et contrôle granulaire de vos contributions.',
  robots: { index: false, follow: true },
};

/**
 * Écran C02. Le rendu est volontairement indépendant d'ExplorerV2.tsx : les
 * composants de `src/components/heatmaps/` peuvent être montés dans un drawer
 * plus tard sans modifier les fichiers verrouillés.
 */
export default function HeatmapsPage() {
  return (
    <AppShell>
      <HeatmapsScreen />
    </AppShell>
  );
}
