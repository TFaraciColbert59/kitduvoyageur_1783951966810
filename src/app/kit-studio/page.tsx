'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KitStudioView } from '@/features/kit-studio/components/KitStudioView';
import type { StudioDrawer } from '@/features/hub/state/drawerMachine';

/**
 * Kit Studio — version du hub camp (tiroirs, sac 3D, insignes, inventaire).
 * La vue est la même que celle montée dans le hub (`?studio=1`) : une seule implémentation.
 * Les données viennent de /api/kit-studio/configuration ; aucun jeu de démonstration.
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
