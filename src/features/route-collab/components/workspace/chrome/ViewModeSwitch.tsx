'use client';

import { Chip } from '@/features/compas/v5/ui/primitives';
import { useRouteViewMode } from '../expertMode';
import { V5Scope } from '../ui/V5Scope';

/**
 * Interrupteur Simple / Expert (4.1), visible dans l'en-tête du tiroir. Simple par défaut : une décision à la
 * fois ; Expert ajoute les chiffres, les méthodes et les sources, sans changer de page. Réglage mémorisé.
 */
export function ViewModeSwitch() {
  const { expert, setMode } = useRouteViewMode();
  return (
    <V5Scope>
      <div className="rcw-vm" role="group" aria-label="Niveau de détail" data-testid="view-mode-switch" data-mode={expert ? 'expert' : 'simple'}>
        <Chip className="rcw-vm-chip" pressed={!expert} onClick={() => setMode('simple')} data-testid="view-mode-simple">
          Simple
        </Chip>
        <Chip className="rcw-vm-chip" pressed={expert} onClick={() => setMode('expert')} data-testid="view-mode-expert">
          Expert
        </Chip>
      </div>
    </V5Scope>
  );
}
