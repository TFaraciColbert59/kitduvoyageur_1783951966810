'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KitStudioView } from '@/features/kit-studio/components/KitStudioView';
import type { StudioDrawer } from '@/features/hub/state/drawerMachine';

/**
 * Kit Studio — refonte du hub camp (tiroirs 56/38 dvh, six tiroirs, sac 3D).
 * Même vue que celle montée dans le hub (`?studio=1`) : une seule implémentation.
 * Données réelles via /api/kit-studio/configuration ; aucun jeu de démonstration.
 */
export default function KitStudioPage() {
  const router = useRouter();
  const [drawer, setDrawer] = useState<StudioDrawer | undefined>(undefined);
  const [subDrawerId, setSubDrawerId] = useState<string | undefined>(undefined);

  return (
    <KitStudioView
      activeDrawer={drawer}
      subDrawerId={subDrawerId}
      onSelectDrawer={(next) => {
        setDrawer(next);
        setSubDrawerId(undefined);
      }}
      onExitStudio={() => router.push('/hub')}
    />
  );
}
