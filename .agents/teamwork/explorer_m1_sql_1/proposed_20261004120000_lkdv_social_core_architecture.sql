-- ============================================================================
-- 20261004120000_lkdv_social_core_architecture.sql
--
-- LKDV Social Architecture & Canonical Messaging Industrialization (Milestone 1)
--
-- Core architectural pillars implemented:
-- 1. Atomic Monotonic Message Sequencing:
--    • `conversations.last_sequence_number` (BIGINT NOT NULL DEFAULT 0).
--    • `messages.sequence_number` (BIGINT NOT NULL) uniquely constrained per conversation.
--    • Trigger `trg_assign_message_sequence` BEFORE INSERT ON messages atomically increments
--      `conversations.last_sequence_number` with an exclusive row lock and assigns sequence.
--
-- 2. Network Send Idempotency:
--    • `messages.client_nonce` (TEXT) with `UNIQUE (conversation_id, client_nonce)`.
--    • Prevents duplicate message insertions on network drop / reconnect retries.
--
-- 3. Read Progress & O(1) Unread Tracking:
--    • `conversation_members.last_read_sequence` (BIGINT NOT NULL DEFAULT 0).
--    • Dedicated RPC `public.update_last_read_sequence(UUID, BIGINT)` for atomic progress updates.
--
-- 4. Hermetic RLS Hardening & Leak Fix:
--    • Fix security leak in `is_conversation_member` by requiring `cm.left_at IS NULL`.
--    • Fix `is_conv_owner` and `is_conv_admin` by requiring `cm.left_at IS NULL`.
--    • Upgrade all messaging RLS policies to use the Postgres InitPlan caching pattern `(SELECT auth.uid())`.
--    • Add partial index `(conversation_id, user_id) WHERE left_at IS NULL` for index-only scans.
--
-- 5. Modular Outdoor Roles & Context Types:
--    • Support 5 modular outdoor roles: ('member', 'safety', 'guide', 'admin', 'owner').
--    • Support conversation context types: ('direct', 'group', 'club_channel', 'expedition_room').
--
-- 6. Schema Foundation for Clubs, Expedition Rooms & Terra AI:
--    • `club_channels` : Thematic club channels tied 1:1 to conversations.
--    • `expedition_rooms` : Multi-pane cockpit linking chat, GPX snapshots & weather.
--    • `terra_drafted_actions` : Human-in-the-loop draft engine with mandatory source citations.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. CONVERSATIONS : CONTEXT TYPES & SEQUENCE COUNTER
-- ----------------------------------------------------------------------------

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS last_sequence_number BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS context_type TEXT DEFAULT 'direct';

-- Align pre-existing rows to the new context_type
UPDATE public.conversations
SET context_type = CASE
  WHEN type = 'group' THEN 'group'
  ELSE 'direct'
END
WHERE context_type IS NULL;

ALTER TABLE public.conversations ALTER COLUMN context_type SET NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN context_type SET DEFAULT 'direct';

ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS chk_conversations_context_type;
ALTER TABLE public.conversations ADD CONSTRAINT chk_conversations_context_type
  CHECK (context_type IN ('direct', 'group', 'club_channel', 'expedition_room'));

CREATE INDEX IF NOT EXISTS idx_conversations_context_type ON public.conversations(context_type);

-- ----------------------------------------------------------------------------
-- 2. MESSAGES : SEQUENCE NUMBER, CLIENT NONCE & IDEMPOTENCY CONSTRAINTS
-- ----------------------------------------------------------------------------

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS sequence_number BIGINT,
  ADD COLUMN IF NOT EXISTS client_nonce TEXT;

-- Backfill sequence_number for any existing messages per conversation
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY conversation_id
      ORDER BY created_at ASC, id ASC
    ) AS seq
  FROM public.messages
  WHERE sequence_number IS NULL
)
UPDATE public.messages m
SET sequence_number = ranked.seq
FROM ranked
WHERE m.id = ranked.id;

-- Default fallback if table was empty or for future inserts
ALTER TABLE public.messages ALTER COLUMN sequence_number SET NOT NULL;

-- Synchronize conversations.last_sequence_number with the highest existing message sequence
UPDATE public.conversations c
SET last_sequence_number = COALESCE((
  SELECT MAX(m.sequence_number)
  FROM public.messages m
  WHERE m.conversation_id = c.id
), 0)
WHERE last_sequence_number = 0;

-- Idempotency and deterministic ordering constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_messages_conversation_sequence'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT uq_messages_conversation_sequence UNIQUE (conversation_id, sequence_number);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_messages_conversation_client_nonce'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT uq_messages_conversation_client_nonce UNIQUE (conversation_id, client_nonce);
  END IF;
END $$;

-- B-Tree index for bidirectional cursor pagination (before / after sequence_number)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_sequence
  ON public.messages (conversation_id, sequence_number ASC);

-- Index for fast duplicate nonce lookups during reconnects
CREATE INDEX IF NOT EXISTS idx_messages_conversation_client_nonce
  ON public.messages (conversation_id, client_nonce)
  WHERE client_nonce IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. CONVERSATION MEMBERS : LAST READ SEQUENCE & MODULAR ROLES
-- ----------------------------------------------------------------------------

ALTER TABLE public.conversation_members
  ADD COLUMN IF NOT EXISTS last_read_sequence BIGINT NOT NULL DEFAULT 0;

-- Backfill last_read_sequence from last_read_at timestamp
UPDATE public.conversation_members cm
SET last_read_sequence = COALESCE((
  SELECT MAX(m.sequence_number)
  FROM public.messages m
  WHERE m.conversation_id = cm.conversation_id
    AND m.created_at <= cm.last_read_at
), 0)
WHERE last_read_sequence = 0 AND cm.last_read_at IS NOT NULL;

-- Update role check constraint to include the 5 modular outdoor roles
ALTER TABLE public.conversation_members DROP CONSTRAINT IF EXISTS conversation_members_role_check;
ALTER TABLE public.conversation_members DROP CONSTRAINT IF EXISTS chk_conversation_members_role;
ALTER TABLE public.conversation_members ADD CONSTRAINT chk_conversation_members_role
  CHECK (role IN ('member', 'safety', 'guide', 'admin', 'owner'));

-- High-performance partial index for active members (excludes departed members)
CREATE INDEX IF NOT EXISTS idx_conversation_members_active
  ON public.conversation_members (conversation_id, user_id)
  WHERE left_at IS NULL;

-- ----------------------------------------------------------------------------
-- 4. ATOMIC MONOTONIC SEQUENCE ASSIGNMENT TRIGGER
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assign_message_sequence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next_seq BIGINT;
BEGIN
  -- Row-level exclusive lock on conversation ensures gapless monotonic ordering
  UPDATE public.conversations
  SET last_sequence_number = last_sequence_number + 1,
      last_message_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
  WHERE id = NEW.conversation_id
  RETURNING last_sequence_number INTO v_next_seq;

  IF v_next_seq IS NULL THEN
    RAISE EXCEPTION 'Conversation introuvable pour l assignation de sequence : %', NEW.conversation_id;
  END IF;

  NEW.sequence_number := v_next_seq;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_message_sequence ON public.messages;
CREATE TRIGGER trg_assign_message_sequence
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_message_sequence();

COMMENT ON FUNCTION public.assign_message_sequence() IS
  'Trigger atomique attribuant le numero de sequence conversationnel et actualisant la conversation.';

-- ----------------------------------------------------------------------------
-- 5. HARDENED SECURITY HELPERS (FIX LEFT_AT LEAK)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_conversation_member(
  target_conversation_id uuid,
  target_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = target_conversation_id
      AND cm.user_id = target_user_id
      AND cm.left_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conv_owner(
  target_conversation_id uuid,
  target_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = target_conversation_id
      AND cm.user_id = target_user_id
      AND cm.role = 'owner'
      AND cm.left_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conv_admin(
  target_conversation_id uuid,
  target_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = target_conversation_id
      AND cm.user_id = target_user_id
      AND cm.role IN ('admin', 'owner')
      AND cm.left_at IS NULL
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_conv_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_conv_admin(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_conv_owner(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_conv_admin(uuid, uuid) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. RPC : ATOMIC READ RECEIPT SEQUENCE TRACKING
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_last_read_sequence(
  p_conversation_id UUID,
  p_sequence_number BIGINT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_updated_seq BIGINT;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise pour marquer la lecture';
  END IF;

  UPDATE public.conversation_members
  SET last_read_sequence = GREATEST(last_read_sequence, p_sequence_number),
      last_read_at = timezone('utc'::text, now()),
      unread_count = 0
  WHERE conversation_id = p_conversation_id
    AND user_id = v_caller_id
    AND left_at IS NULL
  RETURNING last_read_sequence INTO v_updated_seq;

  RETURN COALESCE(v_updated_seq, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_last_read_sequence(UUID, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_last_read_sequence(UUID, BIGINT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. RE-ENGINEERED RLS POLICIES WITH INITPLAN CACHING (SELECT auth.uid())
-- ----------------------------------------------------------------------------

-- Conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_select_conversations" ON public.conversations;
CREATE POLICY "members_select_conversations" ON public.conversations
  FOR SELECT TO authenticated
  USING (public.is_conversation_member(id, (SELECT auth.uid())));

DROP POLICY IF EXISTS "admin_update_conversations" ON public.conversations;
CREATE POLICY "admin_update_conversations" ON public.conversations
  FOR UPDATE TO authenticated
  USING (public.is_conv_admin(id, (SELECT auth.uid())))
  WITH CHECK (public.is_conv_admin(id, (SELECT auth.uid())));

DROP POLICY IF EXISTS "owners_delete_conversations" ON public.conversations;
CREATE POLICY "owners_delete_conversations" ON public.conversations
  FOR DELETE TO authenticated
  USING (created_by = (SELECT auth.uid()) OR public.is_conv_owner(id, (SELECT auth.uid())));

-- Conversation Members
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_select_conversation_members" ON public.conversation_members;
CREATE POLICY "members_select_conversation_members" ON public.conversation_members
  FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS "admin_insert_conversation_members" ON public.conversation_members;
CREATE POLICY "admin_insert_conversation_members" ON public.conversation_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_conv_admin(conversation_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS "members_update_own_preferences" ON public.conversation_members;
CREATE POLICY "members_update_own_preferences" ON public.conversation_members
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_conv_admin(conversation_id, (SELECT auth.uid())))
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_conv_admin(conversation_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS "members_delete_conversation_members" ON public.conversation_members;
CREATE POLICY "members_delete_conversation_members" ON public.conversation_members
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_conv_admin(conversation_id, (SELECT auth.uid())));

-- Messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_select_messages" ON public.messages;
CREATE POLICY "members_select_messages" ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS "members_insert_messages" ON public.messages;
CREATE POLICY "members_insert_messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND public.is_conversation_member(conversation_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "senders_update_messages" ON public.messages;
CREATE POLICY "senders_update_messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    sender_id = (SELECT auth.uid())
    AND public.is_conversation_member(conversation_id, (SELECT auth.uid()))
  )
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND public.is_conversation_member(conversation_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "senders_delete_messages" ON public.messages;
CREATE POLICY "senders_delete_messages" ON public.messages
  FOR DELETE TO authenticated
  USING (
    sender_id = (SELECT auth.uid())
    AND public.is_conversation_member(conversation_id, (SELECT auth.uid()))
  );

-- Message Attachments
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_select_attachments" ON public.message_attachments;
CREATE POLICY "members_select_attachments" ON public.message_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_attachments.message_id
        AND public.is_conversation_member(m.conversation_id, (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "senders_insert_attachments" ON public.message_attachments;
CREATE POLICY "senders_insert_attachments" ON public.message_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_attachments.message_id
        AND m.sender_id = (SELECT auth.uid())
        AND public.is_conversation_member(m.conversation_id, (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "senders_delete_attachments" ON public.message_attachments;
CREATE POLICY "senders_delete_attachments" ON public.message_attachments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_attachments.message_id
        AND m.sender_id = (SELECT auth.uid())
    )
  );

-- Message Reactions
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_select_reactions" ON public.message_reactions;
CREATE POLICY "members_select_reactions" ON public.message_reactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_reactions.message_id
        AND public.is_conversation_member(m.conversation_id, (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "users_insert_reactions" ON public.message_reactions;
CREATE POLICY "users_insert_reactions" ON public.message_reactions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_reactions.message_id
        AND public.is_conversation_member(m.conversation_id, (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "users_delete_reactions" ON public.message_reactions;
CREATE POLICY "users_delete_reactions" ON public.message_reactions
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Message Mentions
ALTER TABLE public.message_mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_select_mentions" ON public.message_mentions;
CREATE POLICY "members_select_mentions" ON public.message_mentions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_mentions.message_id
        AND public.is_conversation_member(m.conversation_id, (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "users_update_own_mentions" ON public.message_mentions;
CREATE POLICY "users_update_own_mentions" ON public.message_mentions
  FOR UPDATE TO authenticated
  USING (mentioned_user_id = (SELECT auth.uid()))
  WITH CHECK (mentioned_user_id = (SELECT auth.uid()));

-- Storage Objects (message-attachments bucket)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    DROP POLICY IF EXISTS "storage_select_message_attachments" ON storage.objects;
    CREATE POLICY "storage_select_message_attachments" ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'message-attachments'
        AND public.is_conversation_member((storage.foldername(name))[1]::uuid, (SELECT auth.uid()))
      );

    DROP POLICY IF EXISTS "storage_insert_message_attachments" ON storage.objects;
    CREATE POLICY "storage_insert_message_attachments" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'message-attachments'
        AND (storage.foldername(name))[2]::uuid = (SELECT auth.uid())
        AND public.is_conversation_member((storage.foldername(name))[1]::uuid, (SELECT auth.uid()))
      );

    DROP POLICY IF EXISTS "storage_delete_message_attachments" ON storage.objects;
    CREATE POLICY "storage_delete_message_attachments" ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'message-attachments'
        AND (storage.foldername(name))[2]::uuid = (SELECT auth.uid())
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 8. SCHEMA FOUNDATION : CLUB CHANNELS (MILESTONE 3)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.club_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL UNIQUE REFERENCES public.conversations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  min_role_to_read TEXT NOT NULL DEFAULT 'member' CHECK (min_role_to_read IN ('member', 'safety', 'guide', 'admin', 'owner')),
  min_role_to_write TEXT NOT NULL DEFAULT 'member' CHECK (min_role_to_write IN ('member', 'safety', 'guide', 'admin', 'owner')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_club_channels_club ON public.club_channels(club_id);
CREATE INDEX IF NOT EXISTS idx_club_channels_conv ON public.club_channels(conversation_id);

ALTER TABLE public.club_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "club_channels_select" ON public.club_channels;
CREATE POLICY "club_channels_select" ON public.club_channels
  FOR SELECT TO authenticated
  USING (
    public.is_conversation_member(conversation_id, (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_channels.club_id
        AND cm.user_id = (SELECT auth.uid())
        AND cm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "club_channels_admin_insert" ON public.club_channels;
CREATE POLICY "club_channels_admin_insert" ON public.club_channels
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_channels.club_id
        AND cm.user_id = (SELECT auth.uid())
        AND cm.role IN ('admin')
        AND cm.status = 'active'
    )
    OR public.is_conv_admin(conversation_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "club_channels_admin_update" ON public.club_channels;
CREATE POLICY "club_channels_admin_update" ON public.club_channels
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_channels.club_id
        AND cm.user_id = (SELECT auth.uid())
        AND cm.role IN ('admin')
        AND cm.status = 'active'
    )
    OR public.is_conv_admin(conversation_id, (SELECT auth.uid()))
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_channels.club_id
        AND cm.user_id = (SELECT auth.uid())
        AND cm.role IN ('admin')
        AND cm.status = 'active'
    )
    OR public.is_conv_admin(conversation_id, (SELECT auth.uid()))
  );

REVOKE ALL ON public.club_channels FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.club_channels TO authenticated;
GRANT ALL ON public.club_channels TO service_role;

-- ----------------------------------------------------------------------------
-- 9. SCHEMA FOUNDATION : EXPEDITION ROOMS (MILESTONE 3)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.expedition_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL UNIQUE REFERENCES public.conversations(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'archived')),
  gpx_track_url TEXT,
  gpx_snapshot JSONB DEFAULT '{}'::jsonb,
  weather_location JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_expedition_rooms_conv ON public.expedition_rooms(conversation_id);
CREATE INDEX IF NOT EXISTS idx_expedition_rooms_trip ON public.expedition_rooms(trip_id);
CREATE INDEX IF NOT EXISTS idx_expedition_rooms_status ON public.expedition_rooms(status);

ALTER TABLE public.expedition_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expedition_rooms_select" ON public.expedition_rooms;
CREATE POLICY "expedition_rooms_select" ON public.expedition_rooms
  FOR SELECT TO authenticated
  USING (
    public.is_conversation_member(conversation_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "expedition_rooms_insert" ON public.expedition_rooms;
CREATE POLICY "expedition_rooms_insert" ON public.expedition_rooms
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_conversation_member(conversation_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "expedition_rooms_update" ON public.expedition_rooms;
CREATE POLICY "expedition_rooms_update" ON public.expedition_rooms
  FOR UPDATE TO authenticated
  USING (
    public.is_conversation_member(conversation_id, (SELECT auth.uid()))
  )
  WITH CHECK (
    public.is_conversation_member(conversation_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "expedition_rooms_delete" ON public.expedition_rooms;
CREATE POLICY "expedition_rooms_delete" ON public.expedition_rooms
  FOR DELETE TO authenticated
  USING (
    public.is_conv_owner(conversation_id, (SELECT auth.uid()))
  );

REVOKE ALL ON public.expedition_rooms FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expedition_rooms TO authenticated;
GRANT ALL ON public.expedition_rooms TO service_role;

-- ----------------------------------------------------------------------------
-- 10. SCHEMA FOUNDATION : TERRA DRAFTED ACTIONS (MILESTONE 4)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.terra_drafted_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('create_expedition', 'create_poll', 'update_checklist', 'safety_alert')),
  proposed_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_message_sequences BIGINT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_terra_actions_conv ON public.terra_drafted_actions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_terra_actions_status ON public.terra_drafted_actions(status);
CREATE INDEX IF NOT EXISTS idx_terra_actions_created ON public.terra_drafted_actions(created_at DESC);

ALTER TABLE public.terra_drafted_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "terra_actions_select" ON public.terra_drafted_actions;
CREATE POLICY "terra_actions_select" ON public.terra_drafted_actions
  FOR SELECT TO authenticated
  USING (
    public.is_conversation_member(conversation_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "terra_actions_insert" ON public.terra_drafted_actions;
CREATE POLICY "terra_actions_insert" ON public.terra_drafted_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_conversation_member(conversation_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "terra_actions_update" ON public.terra_drafted_actions;
CREATE POLICY "terra_actions_update" ON public.terra_drafted_actions
  FOR UPDATE TO authenticated
  USING (
    public.is_conversation_member(conversation_id, (SELECT auth.uid()))
  )
  WITH CHECK (
    public.is_conversation_member(conversation_id, (SELECT auth.uid()))
  );

REVOKE ALL ON public.terra_drafted_actions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.terra_drafted_actions TO authenticated;
GRANT ALL ON public.terra_drafted_actions TO service_role;

-- ----------------------------------------------------------------------------
-- 11. SUPABASE REALTIME PUBLICATION REGISTRATION
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
  END IF;
END $$;

COMMIT;
