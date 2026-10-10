import type { MessageMetadata } from './outdoorObjects.types';

export type ConversationType = 'direct' | 'group';

export type ConversationContextType =
  | 'direct'
  | 'group'
  | 'club_channel'
  | 'expedition_room';

export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'file'
  | 'system'
  | 'audio'
  | 'gpx'
  | 'product'
  | 'trail'
  | 'kit';

/** Payload des messages équipement (message_type = 'product'). Série dans messages.metadata. */
export interface ProductMessageMeta {
  kind: 'product';
  id: string;
  name: string;
  photo_url?: string | null;
  category?: string | null;
  price_cents?: number | null;
  product_slug?: string | null;
}

/** Payload des messages randonnée (message_type = 'trail'). Série dans messages.metadata. */
export interface TrailMessageMeta {
  kind: 'trail';
  id: string;
  name: string;
  distance_km?: number | null;
  elevation_gain_m?: number | null;
  region?: string | null;
}

/** Payload des messages lignée de kit (message_type = 'kit', chantier lignées). */
export interface KitMessageMeta {
  kind: 'kit';
  kit_id: string;
  kit_name: string;
}

export type MemberRole = 'member' | 'safety' | 'guide' | 'admin' | 'owner';

export interface UserProfileSummary {
  id: string;
  full_name: string;
  avatar_url: string;
  username?: string;
  level?: number;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  context_type?: ConversationContextType;
  title?: string | null;
  avatar_url?: string | null;
  created_by?: string | null;
  last_message_at: string;
  last_sequence_number?: number;
  created_at: string;
  updated_at: string;

  // Métadonnées enrichies côté client
  other_member?: UserProfileSummary | null;
  last_message?: MessageSummary | null;
  unread_count: number;
  is_muted?: boolean;
  mute_until?: string | null;
  is_archived?: boolean;
  status?: 'active' | 'pending' | 'rejected';
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  role: MemberRole;
  is_muted: boolean;
  is_archived: boolean;
  last_read_at: string;
  last_read_sequence?: number;
  unread_count: number;
  joined_at: string;
  left_at?: string | null;
  profile?: UserProfileSummary;
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  reaction_type: 'emoji' | 'text';
  reaction_value: string;
  created_at: string;
  profile?: UserProfileSummary;
}

export interface OpenGraphPreviewData {
  title: string;
  description?: string | null;
  image?: string | null;
  siteName?: string | null;
  domain: string;
  url: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: MessageType;
  sequence_number?: number;
  client_nonce?: string | null;
  reply_to_id?: string | null;
  reply_to_message?: {
    id: string;
    sender_name: string;
    content: string;
  } | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;

  // Jointures et états UI
  sender_profile?: UserProfileSummary;
  reactions?: MessageReaction[];
  attachments?: MessageAttachment[];
  status?: 'sending' | 'sent' | 'error' | 'pending';
  /** Payload structuré pour les types enrichis ('product', 'trail', outdoor snapshots…). */
  metadata?: MessageMetadata | Record<string, unknown> | null;
}

export interface MessageSummary {
  id: string;
  content: string;
  sender_name: string;
  created_at: string;
  message_type: MessageType;
  sequence_number?: number;
}

// ── Domain Foundation Interfaces (Milestone 1) ────────────────────────────────

export interface CursorPaginationOptions {
  limit?: number; // Par défaut: 50
  beforeSequence?: number; // Messages plus anciens (scrolling vers le haut)
  afterSequence?: number; // Messages plus récents (scrolling vers le bas / rattrapage)
}

export interface PaginatedMessagesResult {
  messages: Message[];
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
  earliestSequence: number | null;
  latestSequence: number | null;
}

export interface PendingMessage {
  tempId: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: MessageType;
  replyToId?: string;
  metadata?: Record<string, unknown>;
  clientNonce: string;
  createdAt: string;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
  lastError?: string;
}

export type SyncReconciliationPhase = 'flush_pending' | 'pull_delta' | 'resolve_conflicts';

export interface SyncReconciliationResult {
  flushedCount: number;
  failedCount: number;
  syncedMessages: Message[];
  newDeltaMessages: Message[];
}

export interface SequenceUnreadResult {
  conversationId: string;
  lastReadSequence: number;
  lastConversationSequence: number;
  unreadCount: number;
}

export interface NonceRecord {
  clientNonce: string;
  conversationId: string;
  createdAt: number;
  status: 'pending' | 'confirmed' | 'failed';
}

export type {
  MessageMetadata,
  OutdoorObjectSnapshot,
  GPXSnapshot,
  KitSnapshot,
  EquipmentSnapshot,
  ExpeditionSnapshot,
} from './outdoorObjects.types';

