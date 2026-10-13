-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: F-020 — demandes de message : état serveur réel
-- Chantier communauté (audit 2026-10-12) — P1 demandes/acceptation
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Constat (audit F-020) : le modèle démo porte pending/active, la table réelle
-- ne portait AUCUN état ; acceptMessageRequest ne faisait que désarchiver.
-- Le client (onglet « Demandes », barre pending de ConversationView) était
-- prêt mais rien côté base.
--
-- Correctif :
--   - colonne `status` ('active' défaut, 'pending') sur conversation_members ;
--   - la RPC de DM place la cible en 'pending' (l'initiateur reste actif) ;
--   - un membre en attente LIT l'aperçu mais ne peut PAS écrire :
--     la policy INSERT des messages exige une adhésion active ;
--   - l'acceptation (update own status='active') ouvre l'écriture ;
--     le refus reste le retrait de l'adhésion (comportement existant).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.conversation_members
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

DO $$
BEGIN
  ALTER TABLE public.conversation_members
    ADD CONSTRAINT conversation_members_status_check CHECK (status IN ('active', 'pending'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.conversation_members.status IS
  'F-020 : active = peut écrire ; pending = demande en attente (lecture de l''aperçu, écriture refusée jusqu''à acceptation).';

-- Helper : adhésion ACTIVE uniquement (les policies d'écriture l'exigent).
CREATE OR REPLACE FUNCTION public.is_active_conversation_member(p_conversation_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members m
    WHERE m.conversation_id = p_conversation_id
      AND m.user_id = p_user_id
      AND m.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_conversation_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_conversation_member(uuid, uuid) TO authenticated;

-- RPC de DM : la cible reçoit une demande (pending), l'initiateur est actif.
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(
  p_target_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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

    INSERT INTO public.conversations (type, name, created_by, direct_pair_key)
    VALUES ('direct', 'Conversation directe', v_caller_id, v_pair_key)
    RETURNING id INTO v_conv_id;

    INSERT INTO public.conversation_members (conversation_id, user_id, role, status)
    VALUES 
        (v_conv_id, v_caller_id, 'owner', 'active'),
        (v_conv_id, p_target_user_id, 'member', 'pending');

    RETURN v_conv_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) TO authenticated;

-- Écriture réservée aux adhésions actives (un pending peut lire l'aperçu).
DROP POLICY IF EXISTS members_insert_messages ON public.messages;
CREATE POLICY members_insert_messages ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND public.is_active_conversation_member(conversation_id, (SELECT auth.uid()))
  );
