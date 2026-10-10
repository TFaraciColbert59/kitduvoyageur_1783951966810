/**
 * LKDV Social — Terra AI, Context Isolation & Draft Action Engine Types
 * Milestone 4 (R4) Canonical Domain Types
 * File: src/features/messaging/types/terra.types.ts
 */

import type { OutdoorRole } from './clubs.types';

// ============================================================================
// 1. TERRA CONSTANTS & REGEX
// ============================================================================

export const TERRA_BOT_ID = 'terra-ai-assistant';
export const TERRA_BOT_NAME = 'Terra AI';
export const TERRA_BOT_AVATAR = '/assets/images/terra_avatar.png';

/** Regex matching citations in the format [seq #14, @alice] */
export const CITATION_REGEX = /\[seq\s*#(\d+),\s*@(\w+)\]/g;
export const STRICT_CITATION_REGEX = /^\[seq\s*#(\d+),\s*@(\w+)\]$/;

// ============================================================================
// 2. CONVERSATION CONTEXT & RECORD MODELS
// ============================================================================

export interface MessageRecord {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_handle: string;
  sequence_number: number;
  content: string;
  message_type: 'text' | 'image' | 'audio' | 'gpx' | 'kit' | 'product' | 'system';
  created_at: string;
}

export interface ConversationSettings {
  terra_enabled: boolean;
}

export interface ConversationContextRecord {
  id: string;
  type: 'direct' | 'group' | 'club_channel' | 'expedition_room';
  last_sequence_number: number;
  settings: ConversationSettings;
}

export interface TerraContext {
  conversationId: string;
  messages: MessageRecord[];
  isTerraEnabled: boolean;
  sanitized: boolean;
  crossRoomLeaksBlocked: number;
}

// ============================================================================
// 3. SUMMARY CITATION & QUIET CATCH-UP
// ============================================================================

export interface SummaryCitation {
  sequenceNumber: number;
  authorHandle: string;
  rawCitation: string;
  authorName?: string;
}

export interface QuietCatchUpBullet {
  text: string;
  citations: SummaryCitation[];
  id?: string;
  topic?: string;
}

export interface QuietCatchUpSummary {
  conversationId: string;
  fromSequence: number;
  toSequence: number;
  unreadCount: number;
  bullets: QuietCatchUpBullet[];
  generatedAt: string;
  isValid: boolean;
  rejectionReason?: string;
  unreadRange?: {
    fromSequence: number;
    toSequence: number;
    totalMessages: number;
  };
  keyDecisions?: Array<{ decision: string; citations: SummaryCitation[] }>;
  actionItems?: Array<{ task: string; citations: SummaryCitation[] }>;
  suggestedActions?: TerraDraftAction[];
}

// ============================================================================
// 4. DRAFT ACTION MODELS & LIFECYCLE
// ============================================================================

export type DatabaseTerraActionType =
  | 'create_expedition'
  | 'create_poll'
  | 'update_checklist'
  | 'safety_alert';

export type DraftActionType =
  | DatabaseTerraActionType
  | 'propose_trip_date'
  | 'allocate_gear'
  | 'broadcast_route_update';

export type DraftActionStatus = 'draft' | 'approved' | 'rejected';

export interface TerraDraftAction<T = Record<string, unknown>> {
  id: string;
  conversation_id: string;
  conversationId?: string;
  action_type: DraftActionType;
  actionType?: DraftActionType;
  proposed_payload: T;
  proposedPayload?: T;
  source_message_sequences: number[];
  sourceMessageSequences?: number[];
  status: DraftActionStatus;
  requiresConfirmation: true;
  reviewed_by: string | null;
  reviewedBy?: string | null;
  reviewed_at: string | null;
  reviewedAt?: string | null;
  created_at: string;
  createdAt?: string;
  updated_at?: string;
}

// ============================================================================
// 5. CONTEXT ISOLATION & SECURITY GUARDS
// ============================================================================

export class TerraContextBleedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TerraContextBleedError';
  }
}

/**
 * Validates hermetic isolation between Terra contexts.
 * Guarantees that context for conversation A never includes messages from conversation B.
 */
export function validateTerraContextBoundary(
  context: TerraContext,
  requestedConversationId: string
): boolean {
  if (context.conversationId !== requestedConversationId) {
    throw new TerraContextBleedError(
      `Context isolation violation: context conversationId '${context.conversationId}' does not match requested '${requestedConversationId}'`
    );
  }

  for (const msg of context.messages) {
    if (msg.conversation_id !== requestedConversationId) {
      throw new TerraContextBleedError(
        `Cross-conversation leak detected: Message ID '${msg.id}' (seq #${msg.sequence_number}) belongs to '${msg.conversation_id}', leaked into '${requestedConversationId}'`
      );
    }
  }

  return true;
}

// ============================================================================
// 6. CITATION EXTRACTION & VERIFICATION
// ============================================================================

/**
 * Extracts citations matching [seq #N, @author] from a given text.
 */
export function extractCitations(text: string): SummaryCitation[] {
  const citations: SummaryCitation[] = [];
  const regex = new RegExp(CITATION_REGEX);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    citations.push({
      rawCitation: match[0],
      sequenceNumber: parseInt(match[1], 10),
      authorHandle: match[2],
    });
  }

  return citations;
}

/**
 * Strictly verifies citations in a summary against scoped unread messages.
 */
export function verifySummaryCitations(
  summary: QuietCatchUpSummary,
  messages: MessageRecord[]
): {
  valid: boolean;
  totalCitations: number;
  verifiedCount: number;
  rejectionReason?: string;
} {
  let total = 0;
  let verified = 0;

  for (const bullet of summary.bullets) {
    if (!bullet.citations || bullet.citations.length === 0) {
      return {
        valid: false,
        totalCitations: total,
        verifiedCount: verified,
        rejectionReason: 'MISSING_MANDATORY_CITATION',
      };
    }

    for (const cite of bullet.citations) {
      total++;
      const sourceMsg = messages.find(
        (m) =>
          m.conversation_id === summary.conversationId &&
          m.sequence_number === cite.sequenceNumber
      );

      if (!sourceMsg) {
        return {
          valid: false,
          totalCitations: total,
          verifiedCount: verified,
          rejectionReason: `PHANTOM_CITATION_SEQUENCE_${cite.sequenceNumber}`,
        };
      }

      if (sourceMsg.sender_handle.toLowerCase() !== cite.authorHandle.toLowerCase()) {
        return {
          valid: false,
          totalCitations: total,
          verifiedCount: verified,
          rejectionReason: `AUTHOR_MISMATCH_FOR_SEQ_${cite.sequenceNumber}`,
        };
      }

      verified++;
    }
  }

  return {
    valid: true,
    totalCitations: total,
    verifiedCount: verified,
  };
}

// ============================================================================
// 7. DRAFT ACTION LIFECYCLE GUARDS
// ============================================================================

/**
 * Checks whether an action can be executed.
 * Blocks unilateral execution: requires approved status and human reviewer.
 */
export function canExecuteAction(action: TerraDraftAction): boolean {
  return (
    action.status === 'approved' &&
    Boolean(action.reviewed_by || action.reviewedBy)
  );
}

/**
 * Checks whether an action is in draft status requiring confirmation.
 */
export function isActionDraft(action: TerraDraftAction): boolean {
  return action.status === 'draft' && action.requiresConfirmation === true;
}

/**
 * Normalizes extended domain action types to the 4 canonical database types.
 */
export function normalizeToDbActionType(type: DraftActionType): DatabaseTerraActionType {
  switch (type) {
    case 'propose_trip_date':
      return 'create_expedition';
    case 'allocate_gear':
      return 'update_checklist';
    case 'broadcast_route_update':
      return 'safety_alert';
    default:
      return type;
  }
}

/**
 * Checks whether a user role is permitted to review a draft action.
 */
export function canUserReviewDraft(
  userRole: OutdoorRole | string | undefined | null,
  action: TerraDraftAction
): boolean {
  if (!userRole) return false;
  if (action.action_type === 'safety_alert' || action.actionType === 'safety_alert') {
    return ['safety', 'guide', 'admin', 'owner'].includes(userRole);
  }
  if (action.action_type === 'create_expedition' || action.actionType === 'create_expedition') {
    return ['guide', 'admin', 'owner'].includes(userRole);
  }
  return ['member', 'safety', 'guide', 'admin', 'owner'].includes(userRole);
}

export type { OutdoorRole };
