import type { Metadata } from 'next';
import { WatchesHost } from '@/components/compte/watches/WatchesHost';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Montres & Live Sync · Mon compte',
  description:
    'Apple Watch, Wear OS et Galaxy Watch : diagnostic natif, file de sorties hors ligne, paquets de cartes et champs Live Sync.',
  robots: { index: false, follow: false },
};

/**
 * Écran dédié montres du Compte (D03). Les données sont chargées côté client
 * depuis `/api/watches`, qui reste la seule source des états de synchronisation.
 */
export default function MontresPage() {
  return (
    <div className="min-h-screen w-full bg-[color:var(--bg-body)]">
      <WatchesHost />
    </div>
  );
}
