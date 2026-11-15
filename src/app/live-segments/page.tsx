import type { Metadata } from 'next';
import AppShell from '@/components/shell/AppShell';
import { LiveSegmentsScreen } from '@/components/live-segments';

export const metadata: Metadata = {
  title: 'Live Segments · Le Kit du Voyageur',
  description:
    'Approche, départ et arrivée d’un segment en temps réel, avec comparaison fantôme et synchronisation vers votre montre ou votre compteur.',
  openGraph: {
    title: 'Live Segments · Le Kit du Voyageur',
    description:
      'Courez un segment en direct, comparez votre écart au fantôme et recevez les alertes d’approche, de départ et d’arrivée.',
    type: 'website',
    locale: 'fr_FR',
  },
};

export const dynamic = 'force-dynamic';

export default function LiveSegmentsPage() {
  return (
    <AppShell>
      <LiveSegmentsScreen />
    </AppShell>
  );
}
