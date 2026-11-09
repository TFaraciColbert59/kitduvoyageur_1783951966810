'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/ui/button';
import { LOCAL_CATALOG, type CatalogCommand } from './catalog';
import { CommandDrawer, type CommandTarget } from './command-drawer';

export type ActionRef = { command: string; label: string; tone?: 'default' | 'danger' | 'positive' };

/**
 * Boutons d'action d'un objet (commande, membre, cas) : chaque bouton ouvre le
 * formulaire générique de sa commande. Aucune action du registre n'est injoignable.
 */
export function ActionButtons({
  actions,
  target,
  max = 3
}: {
  actions: ActionRef[];
  target: CommandTarget;
  max?: number;
}) {
  const router = useRouter();
  const [drawer, setDrawer] = useState<CatalogCommand | null>(null);
  const [all, setAll] = useState(false);

  const resolve = (action: ActionRef): CatalogCommand => {
    const known = LOCAL_CATALOG.find((candidate) => candidate.command === action.command);
    if (known) return known;
    return {
      id: action.command,
      command: action.command,
      label: action.label,
      pole: 'TECH',
      roleMin: 'membre',
      needsValidation: false,
      reasonRequired: true,
      undoable: false,
      agent: 'never',
      realtime: 'P2',
      domain: ''
    };
  };

  const visible = all ? actions : actions.slice(0, max);

  return (
    <>
      {visible.map((action) => (
        <Button
          key={action.command}
          tone={action.tone === 'danger' ? 'bad' : 'soft'}
          onClick={() => setDrawer(resolve(action))}
        >
          {action.label}
        </Button>
      ))}
      {actions.length > max && !all ? (
        <Button tone="soft" aria-label="Plus d’actions" onClick={() => setAll(true)}>
          …
        </Button>
      ) : null}

      <CommandDrawer
        open={drawer !== null}
        command={drawer}
        ctx={null}
        target={target}
        onClose={() => setDrawer(null)}
        onDone={() => router.refresh()}
      />
    </>
  );
}
