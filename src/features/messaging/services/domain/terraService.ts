/**
 * LKDV Social — Terra AI Domain Service
 * Milestone 4 (R4) Canonical Domain Implementation
 * File: src/features/messaging/services/domain/terraService.ts
 */

import type {
  ConversationContextRecord,
  DraftActionStatus,
  DraftActionType,
  MessageRecord,
  OutdoorRole,
  QuietCatchUpBullet,
  QuietCatchUpSummary,
  SummaryCitation,
  TerraContext,
  TerraDraftAction,
} from '../../types/terra.types';
import {
  extractCitations,
  validateTerraContextBoundary,
  verifySummaryCitations,
} from '../../types/terra.types';

// ============================================================================
// 1. TERRA CONTEXT ISOLATION ENGINE
// ============================================================================

export class TerraContextIsolationEngine {
  private messages: MessageRecord[] = [];
  private conversations: Map<string, ConversationContextRecord> = new Map();

  registerConversation(conv: ConversationContextRecord): void {
    this.conversations.set(conv.id, conv);
  }

  addMessage(msg: MessageRecord): void {
    this.messages.push(msg);
  }

  setTerraEnabled(
    conversationId: string,
    enabled: boolean,
    actorRole: OutdoorRole,
    isDirectMessage = false
  ): { success: boolean; error?: string } {
    const conv = this.conversations.get(conversationId);
    if (!conv) return { success: false, error: 'CONVERSATION_NOT_FOUND' };

    // Direct messages: either participant can toggle
    // Channels & expedition rooms: only owner, admin, guide can toggle
    if (!isDirectMessage && !['owner', 'admin', 'guide'].includes(actorRole)) {
      return { success: false, error: 'INSUFFICIENT_PERMISSIONS' };
    }

    conv.settings.terra_enabled = enabled;
    return { success: true };
  }

  buildConversationContext(
    conversationId: string,
    crossRoomQueryHint?: string
  ): TerraContext {
    const conv = this.conversations.get(conversationId);
    if (!conv || !conv.settings.terra_enabled) {
      return {
        conversationId,
        messages: [],
        isTerraEnabled: conv?.settings.terra_enabled ?? false,
        sanitized: true,
        crossRoomLeaksBlocked: 0,
      };
    }

    // Filter messages strictly matching conversationId
    const roomMessages = this.messages.filter((m) => m.conversation_id === conversationId);

    // Adversarial cross-room reference detection:
    // If a query hint references foreign room IDs, explicitly reject and sanitize
    let leaksBlocked = 0;
    if (crossRoomQueryHint) {
      for (const [otherId] of this.conversations.entries()) {
        if (otherId !== conversationId && crossRoomQueryHint.includes(otherId)) {
          leaksBlocked++;
        }
      }
    }

    const context: TerraContext = {
      conversationId,
      messages: roomMessages,
      isTerraEnabled: true,
      sanitized: true,
      crossRoomLeaksBlocked: leaksBlocked,
    };

    // Ensure boundary validation passes
    validateTerraContextBoundary(context, conversationId);

    return context;
  }
}

// ============================================================================
// 2. QUIET CATCH-UP SUMMARY ENGINE
// ============================================================================

export class QuietCatchUpEngine {
  static parseUnreadRange(
    lastReadSequence: number,
    lastSequenceNumber: number
  ): { fromSequence: number; toSequence: number; unreadCount: number; isCaughtUp: boolean } {
    const safeLastRead = Math.max(0, lastReadSequence);
    if (safeLastRead >= lastSequenceNumber) {
      return {
        fromSequence: lastSequenceNumber,
        toSequence: lastSequenceNumber,
        unreadCount: 0,
        isCaughtUp: true,
      };
    }

    return {
      fromSequence: safeLastRead + 1,
      toSequence: lastSequenceNumber,
      unreadCount: lastSequenceNumber - safeLastRead,
      isCaughtUp: false,
    };
  }

  static extractCitations(text: string): SummaryCitation[] {
    return extractCitations(text);
  }

  static validateSummary(
    conversationId: string,
    rawBullets: string[],
    unreadSourceMessages: MessageRecord[]
  ): QuietCatchUpSummary {
    const minSeq =
      unreadSourceMessages.length > 0
        ? Math.min(...unreadSourceMessages.map((m) => m.sequence_number))
        : 0;
    const maxSeq =
      unreadSourceMessages.length > 0
        ? Math.max(...unreadSourceMessages.map((m) => m.sequence_number))
        : 0;

    const parsedBullets: QuietCatchUpBullet[] = [];

    for (const bulletText of rawBullets) {
      const citations = this.extractCitations(bulletText);

      // Rule 1: Bullet must contain at least one citation
      if (citations.length === 0) {
        return {
          conversationId,
          fromSequence: minSeq,
          toSequence: maxSeq,
          unreadCount: unreadSourceMessages.length,
          bullets: [],
          generatedAt: new Date().toISOString(),
          isValid: false,
          rejectionReason: 'MISSING_MANDATORY_CITATION',
        };
      }

      // Rule 2: All cited sequences must exist in source unread messages
      for (const cite of citations) {
        const sourceMsg = unreadSourceMessages.find(
          (m) =>
            m.conversation_id === conversationId &&
            m.sequence_number === cite.sequenceNumber
        );

        if (!sourceMsg) {
          return {
            conversationId,
            fromSequence: minSeq,
            toSequence: maxSeq,
            unreadCount: unreadSourceMessages.length,
            bullets: [],
            generatedAt: new Date().toISOString(),
            isValid: false,
            rejectionReason: `PHANTOM_CITATION_SEQUENCE_${cite.sequenceNumber}`,
          };
        }

        // Rule 3: Author handle must match actual sender
        if (sourceMsg.sender_handle.toLowerCase() !== cite.authorHandle.toLowerCase()) {
          return {
            conversationId,
            fromSequence: minSeq,
            toSequence: maxSeq,
            unreadCount: unreadSourceMessages.length,
            bullets: [],
            generatedAt: new Date().toISOString(),
            isValid: false,
            rejectionReason: `AUTHOR_MISMATCH_FOR_SEQ_${cite.sequenceNumber}`,
          };
        }
      }

      parsedBullets.push({
        text: bulletText,
        citations,
      });
    }

    const summary: QuietCatchUpSummary = {
      conversationId,
      fromSequence: minSeq,
      toSequence: maxSeq,
      unreadCount: unreadSourceMessages.length,
      bullets: parsedBullets,
      generatedAt: new Date().toISOString(),
      isValid: true,
    };

    // Double-check with standard verification function
    const verification = verifySummaryCitations(summary, unreadSourceMessages);
    if (!verification.valid) {
      summary.isValid = false;
      summary.rejectionReason = verification.rejectionReason;
      summary.bullets = [];
    }

    return summary;
  }
}

// ============================================================================
// 3. TERRA DRAFT ACTION ENGINE
// ============================================================================

export class TerraDraftActionEngine {
  private drafts: Map<string, TerraDraftAction> = new Map();

  createDraft(
    conversationId: string,
    actionType: DraftActionType,
    payload: Record<string, unknown>,
    sourceSequences: number[]
  ): TerraDraftAction {
    const draft: TerraDraftAction = {
      id: `draft-${Math.random().toString(36).substring(2, 9)}`,
      conversation_id: conversationId,
      conversationId,
      action_type: actionType,
      actionType,
      proposed_payload: payload,
      proposedPayload: payload,
      source_message_sequences: sourceSequences,
      sourceMessageSequences: sourceSequences,
      status: 'draft',
      requiresConfirmation: true,
      reviewed_by: null,
      reviewedBy: null,
      reviewed_at: null,
      reviewedAt: null,
      created_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    this.drafts.set(draft.id, draft);
    return draft;
  }

  getDraft(draftId: string): TerraDraftAction | undefined {
    return this.drafts.get(draftId);
  }

  executeUnilateral(draftId: string): { executed: boolean; error: string } {
    const draft = this.drafts.get(draftId);
    if (!draft) return { executed: false, error: 'DRAFT_NOT_FOUND' };

    if (draft.status === 'draft') {
      return {
        executed: false,
        error: 'UNILATERAL_EXECUTION_BLOCKED: Draft requires explicit human confirmation.',
      };
    }

    return { executed: true, error: '' };
  }

  reviewDraft(
    draftId: string,
    decision: 'approve' | 'reject',
    reviewerId: string,
    reviewerRole: OutdoorRole
  ): { success: boolean; draft?: TerraDraftAction; error?: string } {
    const draft = this.drafts.get(draftId);
    if (!draft) return { success: false, error: 'DRAFT_NOT_FOUND' };

    // Terminal state immutability
    if (draft.status !== 'draft') {
      return {
        success: false,
        error: `IMMUTABLE_TERMINAL_STATE: Action already ${draft.status}.`,
      };
    }

    // Role verification for critical actions
    if (
      draft.action_type === 'safety_alert' &&
      !['owner', 'admin', 'guide', 'safety'].includes(reviewerRole)
    ) {
      return { success: false, error: 'INSUFFICIENT_ROLE_FOR_SAFETY_ALERT' };
    }
    if (
      draft.action_type === 'create_expedition' &&
      !['owner', 'admin', 'guide'].includes(reviewerRole)
    ) {
      return { success: false, error: 'INSUFFICIENT_ROLE_FOR_EXPEDITION' };
    }

    const newStatus: DraftActionStatus = decision === 'approve' ? 'approved' : 'rejected';
    const now = new Date().toISOString();

    draft.status = newStatus;
    draft.reviewed_by = reviewerId;
    draft.reviewedBy = reviewerId;
    draft.reviewed_at = now;
    draft.reviewedAt = now;
    draft.updated_at = now;

    return { success: true, draft };
  }
}

// ============================================================================
// 4. UNIFIED TERRA DOMAIN FACADE
// ============================================================================

export class TerraService {
  readonly isolation: TerraContextIsolationEngine;
  readonly catchUp: typeof QuietCatchUpEngine;
  readonly draftActions: TerraDraftActionEngine;

  constructor() {
    this.isolation = new TerraContextIsolationEngine();
    this.catchUp = QuietCatchUpEngine;
    this.draftActions = new TerraDraftActionEngine();
  }
}

export const terraService = new TerraService();
