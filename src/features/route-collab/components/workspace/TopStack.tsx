'use client';

import { useState } from 'react';
import { IslandNote } from '@/features/compas/v5/Island';
import { RoutePill } from './chrome/RoutePill';
import { SayPanel } from './chrome/SayPanel';
import { useAutoReplay } from './chrome/useAutoReplay';
import { useRouteIsland } from './chrome/useRouteIsland';
import { V5Scope } from './ui/V5Scope';
import { useRouteWorkspace } from './WorkspaceContext';

/**
 * Au-dessus de la carte, deux choses seulement : la pilule qui ouvre tout (résumé, jours, voyant, état) et
 * l'îlot du Compas v5, qui dit ce qui vient de se passer, UNE annonce à la fois, avec « Annuler » (3.1 à 3.10).
 * Les anciennes notifications empilées (statut, impact, modes) passent toutes par l'îlot.
 */
export function TopStack() {
  const ws = useRouteWorkspace();
  const [sayOpen, setSayOpen] = useState(false);
  const { view, dismiss, hold, release } = useRouteIsland(ws);
  useAutoReplay(ws);
  return (
    <>
      <div className="rcw-top-stack">
        <RoutePill sayOpen={sayOpen} onToggleSay={() => setSayOpen((v) => !v)} />
        {sayOpen ? <SayPanel onClose={() => setSayOpen(false)} /> : null}
      </div>
      <V5Scope>
        <IslandNote
          note={view ? { title: view.title, sub: view.sub ?? undefined, tone: view.tone, actions: view.actions } : null}
          onDismiss={dismiss}
          onHold={hold}
          onRelease={release}
          testId={view?.testId}
        />
      </V5Scope>
    </>
  );
}
