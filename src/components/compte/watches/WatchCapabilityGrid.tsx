'use client';

/**
 * Lot D03-UI — matrice de capacités d'une montre.
 *
 * Aucune capacité n'est affichée comme disponible si le contrat renvoie
 * `native_target_unavailable`, `consent_required` ou `indeterminate`.
 */

import type { WatchCapabilityMatrix } from '@/features/watches';
import { CAPABILITIES, capabilityStateLabel } from './format';
import { StatusPill, type PillTone } from './primitives';

function toneForState(state: WatchCapabilityMatrix[keyof WatchCapabilityMatrix]): PillTone {
  switch (state) {
    case 'available':
      return 'ok';
    case 'degraded':
    case 'consent_required':
    case 'indeterminate':
      return 'warning';
    case 'native_target_unavailable':
    case 'unsupported':
    case 'error':
      return 'error';
    default:
      return 'neutral';
  }
}

export function WatchCapabilityGrid({
  capabilities,
  title = 'Capacités de la montre',
}: {
  capabilities: WatchCapabilityMatrix;
  title?: string;
}) {
  return (
    <div className="lkv-watch__capabilities" data-testid="watch-capability-grid" aria-label={title}>
      {CAPABILITIES.map((capability) => {
        const state = capabilities[capability.key];
        return (
          <div
            key={capability.key}
            className="lkv-watch__capability"
            data-capability={capability.key}
            data-state={state}
          >
            <div className="lkv-watch__capability-copy">
              <strong>{capability.label}</strong>
              <span>{capability.description}</span>
            </div>
            <StatusPill tone={toneForState(state)}>{capabilityStateLabel(state)}</StatusPill>
          </div>
        );
      })}
      {capabilities.heart_rate_sensor === 'indeterminate' ? (
        <p className="lkv-watch__hint lkv-watch__capability-note">
          HealthKit ne permet pas de distinguer un refus de lecture d’une absence de données :
          l’état reste « Indéterminé », jamais un faux « Refusé ».
        </p>
      ) : null}
    </div>
  );
}
