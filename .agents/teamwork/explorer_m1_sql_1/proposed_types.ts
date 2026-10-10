/**
 * LKDV Social Core Architecture & Canonical Messaging Types
 * Target file: src/lib/supabase/types.ts (append / integrate)
 */

// ── Messaging Domain & Social Realtime (Milestone 1, 3, 4) ────────────────────

export type ConversationContextType =
  | 'direct'
  | 'group'
  | 'club_channel'
  | 'expedition_room';

export type ConversationType = 'direct' | 'group';

export type ConversationMemberRole =
  | 'member'
  | 'safety'
  | 'guide'
  | 'admin'
  | 'owner';

export type DatabaseMessageType =
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

export interface DatabaseConversation {
  id: string;
  type: ConversationType;
  context_type: ConversationContextType;
  title: string | null;
  avatar_url: string | null;
  created_by: string | null;
  direct_pair_key: string | null;
  last_sequence_number: number;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  role: ConversationMemberRole;
  is_muted: boolean;
  is_archived: boolean;
  last_read_at: string;
  last_read_sequence: number;
  unread_count: number;
  joined_at: string;
  left_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatabaseMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sequence_number: number;
  client_nonce: string | null;
  content: string;
  message_type: DatabaseMessageType;
  reply_to_id: string | null;
  metadata: Record<string, unknown> | null;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_label: string | null;
  gps_expires_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatabaseMessageAttachment {
  id: string;
  message_id: string;
  file_url: string;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

export interface DatabaseMessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  reaction_type: 'emoji' | 'text';
  reaction_value: string;
  created_at: string;
}

export interface DatabaseMessageMention {
  id: string;
  message_id: string;
  mentioned_user_id: string;
  mention_position: number | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface DatabaseClubChannel {
  id: string;
  club_id: string;
  conversation_id: string;
  name: string;
  description: string | null;
  min_role_to_read: ConversationMemberRole;
  min_role_to_write: ConversationMemberRole;
  created_at: string;
  updated_at: string;
}

export type ExpeditionRoomStatus = 'planning' | 'active' | 'completed' | 'archived';

export interface DatabaseExpeditionRoom {
  id: string;
  conversation_id: string;
  trip_id: string | null;
  title: string;
  status: ExpeditionRoomStatus;
  gpx_track_url: string | null;
  gpx_snapshot: Record<string, unknown> | null;
  weather_location: {
    lat: number;
    lng: number;
    name: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export type TerraActionType =
  | 'create_expedition'
  | 'create_poll'
  | 'update_checklist'
  | 'safety_alert';

export type TerraActionStatus = 'draft' | 'approved' | 'rejected';

export interface DatabaseTerraDraftedAction {
  id: string;
  conversation_id: string;
  action_type: TerraActionType;
  proposed_payload: Record<string, unknown>;
  source_message_sequences: number[];
  status: TerraActionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateLastReadSequenceArgs {
  p_conversation_id: string;
  p_sequence_number: number;
}
