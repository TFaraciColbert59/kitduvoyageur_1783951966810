-- ============================================================================
-- KIT DU VOYAGEUR — MIGRATION CANONIQUE FINALE DU SYSTÈME DE MESSAGERIE
-- Migration: 20260831000000_messaging_system_canonical.sql
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. PURGE TOTALE DES ANCIENNES POLICIES LAXISTES
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename IN ('conversations', 'conversation_members', 'conversation_participants', 'messages', 'message_attachments', 'message_reactions', 'message_mentions')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 2. VERROUILLAGE STRICT DES GRANTS SQL (REVOKE PUBLIC/ANON)
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.conversations FROM PUBLIC, anon;
REVOKE ALL ON public.conversation_members FROM PUBLIC, anon;
REVOKE ALL ON public.messages FROM PUBLIC, anon;
REVOKE ALL ON public.message_attachments FROM PUBLIC, anon;
REVOKE ALL ON public.message_reactions FROM PUBLIC, anon;
REVOKE ALL ON public.message_mentions FROM PUBLIC, anon;

GRANT SELECT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.conversation_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.message_attachments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT SELECT, UPDATE ON public.message_mentions TO authenticated;

GRANT ALL ON public.conversations TO service_role;
GRANT ALL ON public.conversation_members TO service_role;
GRANT ALL ON public.messages TO service_role;
GRANT ALL ON public.message_attachments TO service_role;
GRANT ALL ON public.message_reactions TO service_role;
GRANT ALL ON public.message_mentions TO service_role;

-- ----------------------------------------------------------------------------
-- 3. ADAPTATION STRUCTURELLE ET ASSAINISSEMENT NOT NULL
-- ----------------------------------------------------------------------------

-- Conversations
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.conversations 
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'direct',
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS avatar_url TEXT,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS direct_pair_key TEXT,
    ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.conversations SET type = 'direct' WHERE type IS NULL;
ALTER TABLE public.conversations ALTER COLUMN type SET NOT NULL;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_type_check;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_type_check CHECK (type IN ('direct', 'group'));

-- Membres
CREATE TABLE IF NOT EXISTS public.conversation_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin', 'owner')),
    is_muted BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    last_read_at TIMESTAMPTZ DEFAULT now(),
    unread_count INTEGER DEFAULT 0 CHECK (unread_count >= 0),
    joined_at TIMESTAMPTZ DEFAULT now(),
    left_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(conversation_id, user_id)
);

DELETE FROM public.conversation_members WHERE conversation_id IS NULL OR user_id IS NULL;
ALTER TABLE public.conversation_members ALTER COLUMN conversation_id SET NOT NULL;
ALTER TABLE public.conversation_members ALTER COLUMN user_id SET NOT NULL;

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text',
    ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS gps_lat DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS gps_lng DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS gps_label TEXT,
    ADD COLUMN IF NOT EXISTS gps_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

DELETE FROM public.messages WHERE conversation_id IS NULL OR sender_id IS NULL;
ALTER TABLE public.messages ALTER COLUMN conversation_id SET NOT NULL;
ALTER TABLE public.messages ALTER COLUMN sender_id SET NOT NULL;

-- Tables annexes
CREATE TABLE IF NOT EXISTS public.message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT,
    file_type TEXT,
    file_size INTEGER CHECK (file_size > 0),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    reaction_type TEXT DEFAULT 'emoji' CHECK (reaction_type IN ('emoji', 'text')),
    reaction_value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(message_id, user_id, reaction_value)
);

CREATE TABLE IF NOT EXISTS public.message_mentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    mentioned_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    mention_position INTEGER CHECK (mention_position >= 0),
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(message_id, mentioned_user_id)
);

ALTER TABLE public.travel_groups 
    ADD COLUMN IF NOT EXISTS conversation_id UUID UNIQUE REFERENCES public.conversations(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 4. TRIGGERS D'IMMUABILITÉ ET DE CONTRÔLE DE HIÉRARCHIE DES RÔLES
-- ----------------------------------------------------------------------------

-- Trigger Messages : Immuabilité conversation_id & sender_id
CREATE OR REPLACE FUNCTION public.prevent_message_immutable_fields_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id THEN
        RAISE EXCEPTION 'Impossible de déplacer un message vers une autre conversation';
    END IF;
    IF NEW.sender_id IS DISTINCT FROM OLD.sender_id THEN
        RAISE EXCEPTION 'Impossible de modifier l expéditeur d un message';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_message_immutable_fields ON public.messages;
CREATE TRIGGER trg_prevent_message_immutable_fields
    BEFORE UPDATE ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_message_immutable_fields_update();

-- Trigger Members : Hiérarchie stricte owner/admin/member
CREATE OR REPLACE FUNCTION public.enforce_member_role_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
BEGIN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id THEN
        RAISE EXCEPTION 'Impossible de modifier le membre ou la conversation d une ligne existante';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
        IF (NEW.role = 'owner' OR OLD.role = 'owner') AND NOT public.is_conv_owner(OLD.conversation_id, v_caller_id) THEN
            RAISE EXCEPTION 'Seul le propriétaire de la conversation peut gérer le rôle owner';
        END IF;

        IF NEW.role = 'admin' AND NOT public.is_conv_admin(OLD.conversation_id, v_caller_id) THEN
            RAISE EXCEPTION 'Seul un administrateur peut promouvoir un membre en admin';
        END IF;

        IF NOT public.is_conv_admin(OLD.conversation_id, v_caller_id) THEN
            RAISE EXCEPTION 'Les membres ne peuvent pas modifier les rôles de la conversation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_member_role_hierarchy ON public.conversation_members;
CREATE TRIGGER trg_enforce_member_role_hierarchy
    BEFORE UPDATE ON public.conversation_members
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_member_role_hierarchy();

-- ----------------------------------------------------------------------------
-- 5. FONCTION DM ATOMIQUE AVEC ADVISORY LOCK & PAIR KEY UNIQUE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(
    p_target_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_pair_key TEXT;
    v_conv_id UUID;
    v_lock_key BIGINT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentification requise pour démarrer une conversation';
    END IF;

    IF v_caller_id = p_target_user_id THEN
        RAISE EXCEPTION 'Impossible de créer une conversation directe avec vous-même';
    END IF;

    v_pair_key := LEAST(v_caller_id::text, p_target_user_id::text) || ':' || GREATEST(v_caller_id::text, p_target_user_id::text);
    v_lock_key := hashtext(v_pair_key);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT id INTO v_conv_id
    FROM public.conversations
    WHERE type = 'direct' AND direct_pair_key = v_pair_key
    LIMIT 1;

    IF v_conv_id IS NOT NULL THEN
        RETURN v_conv_id;
    END IF;

    INSERT INTO public.conversations (type, created_by, direct_pair_key)
    VALUES ('direct', v_caller_id, v_pair_key)
    RETURNING id INTO v_conv_id;

    INSERT INTO public.conversation_members (conversation_id, user_id, role)
    VALUES 
        (v_conv_id, v_caller_id, 'owner'),
        (v_conv_id, p_target_user_id, 'member');

    RETURN v_conv_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_or_create_direct_conversation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(UUID) TO authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_direct_pair_key 
ON public.conversations (direct_pair_key) 
WHERE type = 'direct' AND direct_pair_key IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 6. POLICIES RLS DE SÉCURITÉ ABSOLUE
-- ----------------------------------------------------------------------------
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_mentions ENABLE ROW LEVEL SECURITY;

-- Conversations
CREATE POLICY "members_select_conversations" ON public.conversations
    FOR SELECT TO authenticated
    USING (public.is_conversation_member(id, auth.uid()));

CREATE POLICY "admin_update_conversations" ON public.conversations
    FOR UPDATE TO authenticated
    USING (public.is_conv_admin(id, auth.uid()))
    WITH CHECK (public.is_conv_admin(id, auth.uid()));

CREATE POLICY "owners_delete_conversations" ON public.conversations
    FOR DELETE TO authenticated
    USING (created_by = auth.uid() OR public.is_conv_owner(id, auth.uid()));

-- Members
CREATE POLICY "members_select_conversation_members" ON public.conversation_members
    FOR SELECT TO authenticated
    USING (public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "admin_insert_conversation_members" ON public.conversation_members
    FOR INSERT TO authenticated
    WITH CHECK (public.is_conv_admin(conversation_id, auth.uid()));

CREATE POLICY "members_update_own_preferences" ON public.conversation_members
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid() OR public.is_conv_admin(conversation_id, auth.uid()))
    WITH CHECK (user_id = auth.uid() OR public.is_conv_admin(conversation_id, auth.uid()));

CREATE POLICY "members_delete_conversation_members" ON public.conversation_members
    FOR DELETE TO authenticated
    USING (user_id = auth.uid() OR public.is_conv_admin(conversation_id, auth.uid()));

-- Messages
CREATE POLICY "members_select_messages" ON public.messages
    FOR SELECT TO authenticated
    USING (public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "members_insert_messages" ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND public.is_conversation_member(conversation_id, auth.uid())
    );

CREATE POLICY "senders_update_messages" ON public.messages
    FOR UPDATE TO authenticated
    USING (
        sender_id = auth.uid() 
        AND public.is_conversation_member(conversation_id, auth.uid())
    )
    WITH CHECK (
        sender_id = auth.uid()
        AND public.is_conversation_member(conversation_id, auth.uid())
    );

CREATE POLICY "senders_delete_messages" ON public.messages
    FOR DELETE TO authenticated
    USING (
        sender_id = auth.uid() 
        AND public.is_conversation_member(conversation_id, auth.uid())
    );

-- Attachments, Reactions & Mentions
CREATE POLICY "members_select_attachments" ON public.message_attachments
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.messages m
            WHERE m.id = message_attachments.message_id
              AND public.is_conversation_member(m.conversation_id, auth.uid())
        )
    );

CREATE POLICY "senders_insert_attachments" ON public.message_attachments
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.messages m
            WHERE m.id = message_attachments.message_id
              AND m.sender_id = auth.uid()
              AND public.is_conversation_member(m.conversation_id, auth.uid())
        )
    );

CREATE POLICY "members_select_reactions" ON public.message_reactions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.messages m
            WHERE m.id = message_reactions.message_id
              AND public.is_conversation_member(m.conversation_id, auth.uid())
        )
    );

CREATE POLICY "users_insert_reactions" ON public.message_reactions
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.messages m
            WHERE m.id = message_reactions.message_id
              AND public.is_conversation_member(m.conversation_id, auth.uid())
        )
    );

CREATE POLICY "users_delete_reactions" ON public.message_reactions
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 7. SUPABASE STORAGE PRIVÉ SÉCURISÉ
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'message-attachments',
    'message-attachments',
    false,
    26214400,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'application/pdf', 'text/plain']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 26214400;

CREATE POLICY "storage_select_message_attachments" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'message-attachments'
        AND public.is_conversation_member((storage.foldername(name))[1]::uuid, auth.uid())
    );

CREATE POLICY "storage_insert_message_attachments" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'message-attachments'
        AND (storage.foldername(name))[2]::uuid = auth.uid()
        AND public.is_conversation_member((storage.foldername(name))[1]::uuid, auth.uid())
    );

CREATE POLICY "storage_delete_message_attachments" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'message-attachments'
        AND (storage.foldername(name))[2]::uuid = auth.uid()
    );

-- ----------------------------------------------------------------------------
-- 8. INDEXES DE PERFORMANCE OPTIMISÉS
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON public.conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_type ON public.conversations(type);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON public.conversation_members(user_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conv ON public.conversation_members(conversation_id, user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_msg ON public.message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_msg ON public.message_reactions(message_id);

COMMIT;
