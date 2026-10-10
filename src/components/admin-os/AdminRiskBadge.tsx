/**
 * Badge de risque Tier 0-4 — primitive Admin OS (serveur-compatible, sans dépendance CSS).
 * Les couleurs passent par les classes `.os-risk-*` pontées dans `admin-tokens.css`.
 */

import type { RiskTier } from '@/server/admin/permissions';

export const TIER_LABEL: Record<RiskTier, string> = {
  0: 'Lecture',
  1: 'Routine réversible',
  2: 'Sensible',
  3: 'Impact élevé',
  4: 'Critique',
};

export function AdminRiskBadge({ tier }: { tier: RiskTier }) {
  return (
    <span className={`os-risk os-risk-${tier}`} data-tier={tier}>
      T{tier} · {TIER_LABEL[tier]}
    </span>
  );
}
