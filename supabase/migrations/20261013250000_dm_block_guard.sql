-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: A-064 — un blocage (dans un sens) empêche un NOUVEAU DM
-- Chantier communauté (audit 2026-10-12) — P1 respect des blocages
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La RPC de discussion directe créait une paire sans consulter `user_blocks` :
-- une personne bloquée (ou bloquante) pouvait se voir ouvrir une demande.
-- Correctif : refus serveur à la création d'une NOUVELLE paire ; une
-- conversation préexistante n'est pas supprimée (le blocage est prospectif).
-- ═══════════════════════════════════════════════════════════════════════════

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

    -- A-064 : respecter les blocages dans les deux sens avant toute création.
    IF EXISTS (
        SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = v_caller_id AND b.blocked_id = p_target_user_id)
           OR (b.blocker_id = p_target_user_id AND b.blocked_id = v_caller_id)
    ) THEN
        RAISE EXCEPTION 'Impossible de contacter cette personne'
            USING ERRCODE = '42501';
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

COMMENT ON FUNCTION public.get_or_create_direct_conversation(uuid) IS
  'F-002 + F-020 + A-064 : DM idempotent, cible en demande, refus si un blocage existe dans un sens.';
