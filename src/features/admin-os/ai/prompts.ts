/**
 * Gouvernance des prompts : transitions autorisées + garde production.
 * Miroir applicatif de `set_prompt_status()` (la fonction SQL tranche).
 */

export type PromptStatus = 'draft' | 'review' | 'production' | 'archived';

const STATUSES: PromptStatus[] = ['draft', 'review', 'production', 'archived'];

export interface PromotionLink {
  command_key: string;
  status: string;
  resource_id: string;
}

/** Retourne null si autorisé, sinon le code d'erreur. */
export function canTransitionPrompt(
  from: string,
  to: string,
  link: PromotionLink | null,
  expectedKey?: string
): string | null {
  if (!(STATUSES as string[]).includes(from) || !(STATUSES as string[]).includes(to)) {
    return 'invalid_status';
  }
  if (to === 'production') {
    if (!link || link.command_key !== 'ai.prompt.promote') return 'promotion_unlinked';
    if (expectedKey && link.resource_id !== expectedKey) return 'promotion_unlinked';
    if (link.status !== 'approved') return 'promotion_not_approved';
  }
  return null;
}
