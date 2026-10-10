/**
 * LKDV Social — Terra AI Domain Service
 * Milestone 4 (R4) Service Implementation Blueprint
 * File: src/features/messaging/services/domain/terraService.ts
 */

import { createClient } from '@/lib/supabase/client';
import type {
  Message,
  Conversation,
  ConversationMember,
} from '../../types/messaging.types';
import {
  type TerraContext,
  type QuietCatchUpSummary,
  type QuietCatchUpBullet,
  type SummaryCitation,
  type TerraDraftAction,
  type DraftActionType,
  type DraftActionStatus,
  TERRA_BOT_ID,
  validateTerraContextBoundary,
  isTerraEnabledInRoom,
  verifySummaryCitations,
  normalizeToDbActionType,
  approveDraftAction,
  rejectDraftAction,
} from '../../types/terra.types';

export class TerraService {
  /**
   * Generates a "Quiet Catch-Up" summary of unread messages for a specific member.
   * Enforces:
   * 1. Hermetic context isolation (only messages for target conversationId).
   * 2. Unread sequence range: last_read_sequence + 1 up to last_sequence_number.
   * 3. Mandatory verifiable citations on every single summary bullet.
   * 4. Zero hallucinated quotes or fabricated claims.
   */
  public async generateQuietCatchUp(
    conversationId: string,
    currentUserId: string,
    options?: {
      mockMessages?: Message[];
      mockLastReadSequence?: number;
      mockLastSequence?: number;
    }
  ): Promise<QuietCatchUpSummary | null> {
    const supabase = createClient();

    // 1. Fetch conversation metadata and member read progress
    let lastReadSequence = options?.mockLastReadSequence ?? 0;
    let lastSequenceNumber = options?.mockLastSequence ?? 0;
    let isTerraEnabled = true;

    if (!options?.mockMessages) {
      const { data: convData } = await supabase
        .from('conversations')
        .select('id, type, context_type, last_sequence_number')
        .eq('id', conversationId)
        .single();

      if (!convData) return null;
      lastSequenceNumber = convData.last_sequence_number || 0;

      const { data: memberData } = await supabase
        .from('conversation_members')
        .select('last_read_sequence, role')
        .eq('conversation_id', conversationId)
        .eq('user_id', currentUserId)
        .single();

      if (!memberData) return null;
      lastReadSequence = memberData.last_read_sequence || 0;
    }

    // 2. Check unread range
    const fromSequence = lastReadSequence + 1;
    const toSequence = lastSequenceNumber;

    if (fromSequence > toSequence) {
      // Nothing unread
      return null;
    }

    // 3. Fetch unread messages strictly scoped to this conversation
    let scopedMessages: Message[] = [];
    if (options?.mockMessages) {
      scopedMessages = options.mockMessages.filter(
        (m) =>
          m.conversation_id === conversationId &&
          (m.sequence_number ?? 0) >= fromSequence &&
          (m.sequence_number ?? 0) <= toSequence
      );
    } else {
      const { data: rawMessages } = await supabase
        .from('messages')
        .select('*, sender_profile:user_profiles!sender_id(*)')
        .eq('conversation_id', conversationId)
        .gte('sequence_number', fromSequence)
        .lte('sequence_number', toSequence)
        .is('deleted_at', null)
        .order('sequence_number', { ascending: true });

      scopedMessages = (rawMessages as unknown as Message[]) || [];
    }

    // 4. Enforce strict context boundary validation
    const terraContext: TerraContext = {
      conversationId,
      contextType: 'group',
      isTerraEnabled,
      lastReadSequence,
      lastConversationSequence: toSequence,
      scopedMessages,
    };
    validateTerraContextBoundary(terraContext, conversationId);

    if (scopedMessages.length === 0) {
      return null;
    }

    // 5. Build summary with verifiable citations (deterministic extraction engine)
    const summary = this.buildDeterministicSummary(
      conversationId,
      fromSequence,
      toSequence,
      scopedMessages
    );

    // 6. Anti-Hallucination verification pass
    const verification = verifySummaryCitations(summary, scopedMessages);
    if (!verification.valid) {
      // Filter out invalid citations or drop unverified bullets
      summary.bullets = summary.bullets.filter((b) =>
        b.citations.every((c) =>
          !verification.hallucinatedCitations.some(
            (h) => h.sequenceNumber === c.sequenceNumber
          )
        )
      );
    }

    return summary;
  }

  /**
   * Deterministic summary builder providing guaranteed verifiable citations
   */
  public buildDeterministicSummary(
    conversationId: string,
    fromSequence: number,
    toSequence: number,
    messages: Message[]
  ): QuietCatchUpSummary {
    const bullets: QuietCatchUpBullet[] = [];
    const keyDecisions: QuietCatchUpSummary['keyDecisions'] = [];
    const actionItems: QuietCatchUpSummary['actionItems'] = [];

    for (const msg of messages) {
      const seq = msg.sequence_number ?? 0;
      const author =
        msg.sender_profile?.full_name ||
        msg.sender_profile?.username ||
        'Voyageur';
      const text = msg.content || '';

      const citation: SummaryCitation = {
        sequenceNumber: seq,
        authorName: author,
        authorId: msg.sender_id,
        messageId: msg.id,
        snippet: text.slice(0, 80),
      };

      // Heuristic detection of decisions and outdoor action items
      const lower = text.toLowerCase();
      if (
        lower.includes('validé') ||
        lower.includes('confirmé') ||
        lower.includes('décidé') ||
        lower.includes('on part sur')
      ) {
        keyDecisions.push({
          decision: `${text} [seq #${seq}, @${author}]`,
          citations: [citation],
        });
        bullets.push({
          id: `bullet-${seq}`,
          text: `${author} a confirmé une décision : "${text}" [seq #${seq}, @${author}]`,
          topic: 'logistics',
          citations: [citation],
        });
      } else if (
        lower.includes('qui prend') ||
        lower.includes('je prends') ||
        lower.includes('matériel') ||
        lower.includes('tente') ||
        lower.includes('réchaud')
      ) {
        actionItems.push({
          task: text,
          assignedToName: author,
          citations: [citation],
        });
        bullets.push({
          id: `bullet-${seq}`,
          text: `Organisation matériel : ${text} [seq #${seq}, @${author}]`,
          topic: 'gear',
          citations: [citation],
        });
      } else if (
        lower.includes('météo') ||
        lower.includes('pluie') ||
        lower.includes('orage') ||
        lower.includes('vent') ||
        lower.includes('neige')
      ) {
        bullets.push({
          id: `bullet-${seq}`,
          text: `Point météo par ${author} : "${text}" [seq #${seq}, @${author}]`,
          topic: 'weather',
          citations: [citation],
        });
      } else if (
        lower.includes('attention') ||
        lower.includes('danger') ||
        lower.includes('alerte') ||
        lower.includes('éboulis')
      ) {
        bullets.push({
          id: `bullet-${seq}`,
          text: `Alerte terrain signalée par ${author} : "${text}" [seq #${seq}, @${author}]`,
          topic: 'safety',
          citations: [citation],
        });
      } else {
        // Standard conversational summary bullet
        bullets.push({
          id: `bullet-${seq}`,
          text: `${author} : ${text} [seq #${seq}, @${author}]`,
          topic: 'general',
          citations: [citation],
        });
      }
    }

    return {
      conversationId,
      generatedAt: new Date().toISOString(),
      unreadRange: {
        fromSequence,
        toSequence,
        totalMessages: messages.length,
      },
      bullets: bullets.slice(0, 10), // Limit to top 10 most informative bullets
      keyDecisions,
      actionItems,
    };
  }

  /**
   * Creates a draft action proposal.
   * Terra NEVER executes unilateral mutations.
   * Guarantees status: 'draft', requiresConfirmation: true.
   */
  public async createDraftAction<T = Record<string, unknown>>(
    conversationId: string,
    actionType: DraftActionType,
    proposedPayload: T,
    sourceMessageSequences: number[],
    explanation?: string
  ): Promise<TerraDraftAction<T>> {
    const supabase = createClient();
    const dbActionType = normalizeToDbActionType(actionType);

    const now = new Date().toISOString();
    const actionId = crypto.randomUUID();

    const draftAction: TerraDraftAction<T> = {
      id: actionId,
      conversationId,
      actionType,
      status: 'draft',
      requiresConfirmation: true,
      proposedPayload,
      sourceMessageSequences,
      explanation,
      proposedBy: 'terra',
      reviewedBy: null,
      reviewedByName: null,
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    // Persist in Postgres terra_drafted_actions table
    await supabase.from('terra_drafted_actions').insert({
      id: draftAction.id,
      conversation_id: draftAction.conversationId,
      action_type: dbActionType,
      proposed_payload: proposedPayload as unknown as Record<string, unknown>,
      source_message_sequences: sourceMessageSequences,
      status: 'draft',
      created_at: now,
      updated_at: now,
    });

    return draftAction;
  }

  /**
   * Reviews a draft action: Human approval or rejection.
   */
  public async reviewDraftAction<T = Record<string, unknown>>(
    action: TerraDraftAction<T>,
    decision: 'approve' | 'reject',
    reviewerId: string,
    reviewerName?: string
  ): Promise<TerraDraftAction<T>> {
    const supabase = createClient();
    const updatedAction =
      decision === 'approve'
        ? approveDraftAction(action, reviewerId, reviewerName)
        : rejectDraftAction(action, reviewerId, reviewerName);

    await supabase
      .from('terra_drafted_actions')
      .update({
        status: updatedAction.status,
        reviewed_by: reviewerId,
        reviewed_at: updatedAction.reviewedAt,
        updated_at: updatedAction.updatedAt,
      })
      .eq('id', action.id);

    return updatedAction;
  }
}

export const terraService = new TerraService();
