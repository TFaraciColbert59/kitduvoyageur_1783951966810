/**
 * Point d'entrée des primitives Admin OS.
 * Réexporte la coquille existante (aucun fork) + nouvelles primitives pures.
 * Les pages doivent importer d'ici, pas depuis `app/admin/_os`.
 */

export { AdminShell, useOsUi } from '@/app/admin/_os/osUi';
export type { BadgeCounts, AccountInfo, PaletteAction } from '@/app/admin/_os/osUi';
export { Hero, PeriodPills } from '@/app/admin/_os/panels';
export { AdminRiskBadge, TIER_LABEL } from './AdminRiskBadge';
export { AdminDiff } from './AdminDiff';
export { AdminTimeline } from './AdminTimeline';
export { AdminMetric } from './AdminMetric';
