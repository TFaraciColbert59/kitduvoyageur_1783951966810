/**
 * Proposed updates for src/features/messaging/types/messaging.types.ts
 */

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
  last_read_sequence: number;
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

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sequence_number?: number;
  client_nonce?: string | null;
  content: string;
  message_type: MessageType;
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
  status?: 'sending' | 'sent' | 'error';
  metadata?: Record<string, unknown> | null;
}

export interface MessageSummary {
  id: string;
  content: string;
  sender_name: string;
  created_at: string;
  message_type: MessageType;
  sequence_number?: number;
}
