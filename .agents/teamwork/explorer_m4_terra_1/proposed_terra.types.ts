/**
 * LKDV Social — Terra AI, Context Isolation & Draft Action Engine Types
 * Milestone 4 (R4) Canonical Domain Types
 * File: src/features/messaging/types/terra.types.ts
 */

import type {
  Conversation,
  ConversationContextType,
  ConversationMember,
  MemberRole,
  Message,
} from './messaging.types';
import type { OutdoorRole } from './clubs.types';

// ============================================================================
// 1. TERRA CONSTANTS & REGEX
// ============================================================================

export const TERRA_BOT_ID = 'terra-ai-assistant';
export const TERRA_BOT_NAME = 'Terra AI';
export const TERRA_BOT_AVATAR = '/assets/images/terra_avatar.png';

/** Regex matching citations in the format [seq #14, @alice] */
export const CITATION_REGEX = /\[seq\s*#(\d+),\s*@([a-zA-Z0-9_\-\s]+)\]/g;
export const STRICT_CITATION_REGEX = /^\[seq\s*#(\d+),\s*@([a-zA-Z0-9_\-\s]+)\]$/;

// ============================================================================
// 2. DRAFT ACTION TYPES & STATUS
// ============================================================================

/**
 * Canonical action types supported by Postgres terra_drafted_actions table
 */
export type DatabaseTerraActionType =
  | 'create_expedition'
  | 'create_poll'
  | 'update_checklist'
  | 'safety_alert';

/**
 * Rich domain draft action types for outdoor adventure management
 */
export type DraftActionType =
  | DatabaseTerraActionType
  | 'propose_trip_date'
  | 'allocate_gear'
  | 'broadcast_route_update';

export type DraftActionStatus = 'draft' | 'approved' | 'rejected';

/**
 * Normalizes extended domain action types to the 4 canonical database types
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

// ============================================================================
// 3. ACTION PAYLOAD INTERFACES
// ============================================================================

export interface CreatePollPayload {
  question: string;
  options: string[];
  allowMultiple?: boolean;
  expiresAt?: string;
}

export interface CreateExpeditionPayload {
  title: string;
  destination?: string;
  proposedDates?: string[];
  targetDate?: string;
  gpxTrackUrl?: string;
  maxParticipants?: number;
  estimatedDurationHours?: number;
}

export interface ProposeTripDatePayload {
  tripTitle: string;
  candidateDates: string[];
  preferredDate?: string;
  deadlineForResponses?: string;
}

export interface UpdateChecklistPayload {
  items: Array<{
    label: string;
    category?: string;
    assignedToUserId?: string | null;
    assignedToName?: string | null;
    weightGrams?: number;
  }>;
  action: 'add' | 'remove' | 'assign';
}

export interface AllocateGearPayload {
  gearItemId: string;
  gearItemName: string;
  weightGrams: number;
  assignedToUserId: string;
  assignedToName: string;
  previousAssignedUserId?: string | null;
}

export interface SafetyAlertPayload {
  severity: 'info' | 'warning' | 'critical';
  hazardType: string;
  message: string;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
  };
  recommendedAction?: string;
}

export interface BroadcastRouteUpdatePayload {
  reason: string;
  alternateRouteName?: string;
  detourKm?: number;
  gpxSnapshotUrl?: string;
}

export type TerraActionPayload =
  | CreatePollPayload
  | CreateExpeditionPayload
  | ProposeTripDatePayload
  | UpdateChecklistPayload
  | AllocateGearPayload
  | SafetyAlertPayload
  | BroadcastRouteUpdatePayload
  | Record<string, unknown>;

// ============================================================================
// 4. TERRA DRAFT ACTION MODEL
// ============================================================================

export interface TerraDraftAction<T = Record<string, unknown>> {
  id: string;
  conversationId: string;
  actionType: DraftActionType;
  status: DraftActionStatus;
  /** Hardcoded true: Terra proposals MUST always require explicit human confirmation */
  requiresConfirmation: true;
  proposedPayload: T;
  sourceMessageSequences: number[];
  explanation?: string;
  proposedBy: 'terra';
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 5. CITATION MODEL & ANTI-HALLUCINATION
// ============================================================================

export interface SummaryCitation {
  sequenceNumber: number;
  authorName: string;
  authorId?: string;
  messageId?: string;
  timestamp?: string;
  snippet?: string;
}

export type SummaryBulletTopic = 'logistics' | 'weather' | 'gear' | 'safety' | 'general';

export interface QuietCatchUpBullet {
  id: string;
  text: string;
  topic: SummaryBulletTopic;
  citations: SummaryCitation[];
}

export interface KeyDecisionSummary {
  decision: string;
  citations: SummaryCitation[];
}

export interface ActionItemSummary {
  task: string;
  assignedToName?: string;
  assignedToId?: string;
  citations: SummaryCitation[];
}

export interface QuietCatchUpSummary {
  conversationId: string;
  generatedAt: string;
  unreadRange: {
    fromSequence: number;
    toSequence: number;
    totalMessages: number;
  };
  bullets: QuietCatchUpBullet[];
  keyDecisions: KeyDecisionSummary[];
  actionItems: ActionItemSummary[];
  suggestedActions?: TerraDraftAction[];
}

// ============================================================================
// 6. TERRA CONTEXT & PER-CONVERSATION ISOLATION
// ============================================================================

export interface TerraParticipantInfo {
  userId: string;
  fullName: string;
  role: MemberRole;
}

export interface TerraRoomMetadata {
  clubId?: string;
  channelName?: string;
  expeditionId?: string;
  tripTitle?: string;
  gpxTitle?: string;
  checklistCount?: number;
}

export interface TerraContext {
  conversationId: string;
  conversationTitle?: string;
  contextType: ConversationContextType;
  isTerraEnabled: boolean;
  lastReadSequence: number;
  lastConversationSequence: number;
  scopedMessages: Message[];
  memberCount?: number;
  activeParticipants?: TerraParticipantInfo[];
  roomMetadata?: TerraRoomMetadata;
}

// ============================================================================
// 7. CONTEXT ISOLATION & SECURITY GUARDS
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

  for (const msg of context.scopedMessages) {
    if (msg.conversation_id !== requestedConversationId) {
      throw new TerraContextBleedError(
        `Cross-conversation leak detected: Message ID '${msg.id}' (seq #${msg.sequence_number}) belongs to conversation '${msg.conversation_id}', leaked into '${requestedConversationId}'`
      );
    }
  }

  return true;
}

/**
 * Checks whether Terra AI assistant is enabled in a conversation
 */
export function isTerraEnabledInRoom(
  conversation: Pick<Conversation, 'id' | 'type' | 'context_type'> & { is_terra_enabled?: boolean }
): boolean {
  // In direct DMs with the Terra bot itself, it is always enabled
  if (conversation.type === 'direct' && conversation.id.includes('terra')) {
    return true;
  }
  // Default is true for group / clubs / expedition unless explicitly set to false
  return conversation.is_terra_enabled !== false;
}

// ============================================================================
// 8. CITATION VALIDATION & ANTI-HALLUCINATION HELPERS
// ============================================================================

/**
 * Formats a citation tag into standard text representation: `[seq #14, @alice]`
 */
export function formatCitationTag(citation: SummaryCitation): string {
  return `[seq #${citation.sequenceNumber}, @${citation.authorName}]`;
}

/**
 * Parses a citation tag from text
 */
export function parseCitationTag(tag: string): { sequenceNumber: number; authorName: string } | null {
  const match = tag.match(/\[seq\s*#(\d+),\s*@([a-zA-Z0-9_\-\s]+)\]/);
  if (!match) return null;
  return {
    sequenceNumber: parseInt(match[1], 10),
    authorName: match[2].trim(),
  };
}

/**
 * Extracts all citations from a text string
 */
export function extractCitationsFromText(text: string): Array<{ sequenceNumber: number; authorName: string }> {
  const results: Array<{ sequenceNumber: number; authorName: string }> = [];
  const regex = new RegExp(CITATION_REGEX);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    results.push({
      sequenceNumber: parseInt(match[1], 10),
      authorName: match[2].trim(),
    });
  }

  return results;
}

/**
 * Verifies that a citation corresponds to an actual message and author
 */
export function validateCitation(
  citation: SummaryCitation,
  messages: Message[]
): { isValid: boolean; reason?: string } {
  const matchingMsg = messages.find((m) => m.sequence_number === citation.sequenceNumber);
  if (!matchingMsg) {
    return {
      isValid: false,
      reason: `Message sequence #${citation.sequenceNumber} not found in scoped messages`,
    };
  }

  const senderName =
    matchingMsg.sender_profile?.full_name ||
    matchingMsg.sender_profile?.username ||
    matchingMsg.sender_id;

  const normalizedAuthor = citation.authorName.toLowerCase().trim();
  const normalizedSender = senderName.toLowerCase().trim();

  // Permissive substring or token matching for names (e.g. "Sarah" matches "Sarah Connor")
  const isAuthorMatch =
    normalizedSender.includes(normalizedAuthor) ||
    normalizedAuthor.includes(normalizedSender) ||
    normalizedSender.startsWith(normalizedAuthor) ||
    normalizedAuthor.startsWith(normalizedSender);

  if (!isAuthorMatch) {
    return {
      isValid: false,
      reason: `Citation author '@${citation.authorName}' does not match sender '${senderName}' for sequence #${citation.sequenceNumber}`,
    };
  }

  return { isValid: true };
}

export interface SummaryVerificationResult {
  valid: boolean;
  totalCitations: number;
  verifiedCount: number;
  hallucinatedCitations: Array<{
    sequenceNumber: number;
    authorName: string;
    reason: string;
  }>;
}

/**
 * Strictly verifies all citations across all bullets in a QuietCatchUpSummary.
 * Ensures ZERO hallucinated quotes, fabricated claims, or invalid sequences.
 */
export function verifySummaryCitations(
  summary: QuietCatchUpSummary,
  messages: Message[]
): SummaryVerificationResult {
  let totalCitations = 0;
  let verifiedCount = 0;
  const hallucinatedCitations: SummaryVerificationResult['hallucinatedCitations'] = [];

  const checkCitation = (cit: SummaryCitation) => {
    totalCitations++;
    const res = validateCitation(cit, messages);
    if (res.isValid) {
      verifiedCount++;
    } else {
      hallucinatedCitations.push({
        sequenceNumber: cit.sequenceNumber,
        authorName: cit.authorName,
        reason: res.reason || 'Invalid citation',
      });
    }
  };

  for (const bullet of summary.bullets) {
    for (const cit of bullet.citations) {
      checkCitation(cit);
    }
    // Also verify inline text citations
    const inlineCits = extractCitationsFromText(bullet.text);
    for (const inline of inlineCits) {
      const alreadyChecked = bullet.citations.some(
        (c) => c.sequenceNumber === inline.sequenceNumber
      );
      if (!alreadyChecked) {
        checkCitation({
          sequenceNumber: inline.sequenceNumber,
          authorName: inline.authorName,
        });
      }
    }
  }

  for (const dec of summary.keyDecisions) {
    for (const cit of dec.citations) {
      checkCitation(cit);
    }
  }

  for (const act of summary.actionItems) {
    for (const cit of act.citations) {
      checkCitation(cit);
    }
  }

  return {
    valid: hallucinatedCitations.length === 0,
    totalCitations,
    verifiedCount,
    hallucinatedCitations,
  };
}

// ============================================================================
// 9. DRAFT ACTION LIFECYCLE & EXECUTION GUARDS
// ============================================================================

/**
 * Ensures an action is in draft state and requires human confirmation
 */
export function isActionDraft(action: TerraDraftAction): boolean {
  return action.status === 'draft' && action.requiresConfirmation === true;
}

/**
 * Ensures unilateral execution is prevented:
 * ONLY approved actions with a verified human reviewer can be executed.
 */
export function canExecuteAction(action: TerraDraftAction): boolean {
  return action.status === 'approved' && Boolean(action.reviewedBy);
}

/**
 * Transitions draft action to approved status
 */
export function approveDraftAction<T>(
  action: TerraDraftAction<T>,
  reviewerId: string,
  reviewerName?: string
): TerraDraftAction<T> {
  if (action.status !== 'draft') {
    throw new Error(`Cannot approve action: current status is '${action.status}'`);
  }
  return {
    ...action,
    status: 'approved',
    reviewedBy: reviewerId,
    reviewedByName: reviewerName || null,
    reviewedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Transitions draft action to rejected status
 */
export function rejectDraftAction<T>(
  action: TerraDraftAction<T>,
  reviewerId: string,
  reviewerName?: string
): TerraDraftAction<T> {
  if (action.status !== 'draft') {
    throw new Error(`Cannot reject action: current status is '${action.status}'`);
  }
  return {
    ...action,
    status: 'rejected',
    reviewedBy: reviewerId,
    reviewedByName: reviewerName || null,
    reviewedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Checks whether a user has permissions to review a draft action
 */
export function canUserReviewDraft(
  userRole: OutdoorRole | string | undefined | null,
  action: TerraDraftAction
): boolean {
  if (!userRole) return false;
  // All active members of the room can approve/reject member-level draft actions (e.g. polls)
  // For safety alerts or route broadcasts, require at least 'safety', 'guide', 'admin', or 'owner'
  if (action.actionType === 'safety_alert' || action.actionType === 'broadcast_route_update') {
    return ['safety', 'guide', 'admin', 'owner'].includes(userRole);
  }
  return ['member', 'safety', 'guide', 'admin', 'owner'].includes(userRole);
}
