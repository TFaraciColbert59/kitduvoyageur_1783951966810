import type { SkillType } from './types';

/** Separate units; these types define no conversion or permission by level. */
export type ProgressionV2Unit = 'xp' | 'loyalty_credit' | 'contribution_share' | 'store_credit_cent';
export type ProgressionV2Family = 'terrain' | 'preparation' | 'partage' | 'entraide';
export type ProgressionV2DecisionState = 'pending' | 'awarded' | 'refused' | 'dead';
export type ProgressionV2ProjectionState = 'pending' | 'processed' | 'dead';

export const PROGRESSION_V2_ACTION_IDS = [
  'hike_session_processed', 'activity_completed', 'trip_completed', 'trail_prepared',
  'compass_prepared', 'checklist_completed', 'kit_field_report', 'learning_module_passed',
  'equipment_maintenance', 'kit_improved', 'place_review', 'carnet_published',
  'proven_kit_shared', 'place_photo_accepted', 'guide_contribution_accepted',
  'translation_accepted', 'track_contribution_accepted', 'equipment_review',
  'nature_observation_accepted', 'place_report_accepted', 'answer_accepted',
  'mentoring_completed', 'club_outing_held', 'collective_task_completed',
  'loan_borrower_returned', 'loan_lender_returned', 'environment_action_completed',
  'equipment_repair_documented', 'accessibility_report_accepted',
] as const;
export type ProgressionV2ActionId = typeof PROGRESSION_V2_ACTION_IDS[number];

export interface ProgressionV2Rule {
  readonly id: ProgressionV2ActionId;
  readonly version: string;
  readonly effective_from: string | null;
  readonly effective_until: string | null;
  readonly enabled: boolean;
  readonly family: ProgressionV2Family;
  readonly xp: { readonly min: number; readonly max: number; readonly unit: 'xp' };
  readonly skill_weights_percent: Readonly<Record<SkillType, number>>;
  readonly count_caps: { readonly day: number; readonly week: number; readonly season: number };
  readonly cap_group: string;
  readonly claim_groups: readonly string[];
  readonly proof_requirements: string;
  readonly activation_conditions: readonly string[];
  readonly idempotency: {
    readonly scope: 'user_id + canonical_business_source';
    readonly includes_rule_version: false;
    readonly legacy_key: string | null;
  };
}

export interface ProgressionV2RuleSelection {
  readonly version: string;
  readonly business_effective_at: string;
  readonly rule: ProgressionV2Rule;
}

/** Strict UTC, with real calendar validation rather than Date.parse rollover. */
export function parseProgressionBusinessDate(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const normalized = value.includes('.') ? value : value.replace('Z', '.000Z');
  return new Date(timestamp).toISOString() === normalized ? timestamp : null;
}
