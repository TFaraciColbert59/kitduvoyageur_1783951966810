-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: F-002 — get_or_create_direct_conversation vs conversations.name
-- Chantier communauté (audit 2026-10-12) — P0 création de DM cassée
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Constat (audit F-002, statuts C + D) : la RPC insérait
--   (type, created_by, direct_pair_key) dans public.conversations
-- alors que la colonne `name` est NOT NULL sans défaut ni trigger de
-- remplissage. Toute création de nouvelle discussion directe échouait donc
-- en contrainte NOT NULL.
--
-- Contrat retenu : une conversation directe porte un `name` technique stable
-- ("Conversation directe") — l'affichage utilise `title` puis le profil de
-- l'autre membre côté client (messagingService.getConversations). `title`
-- reste NULL pour un DM (rempli par les lecteurs).
--
-- Le reste de la RPC est conservé à l'identique : vérification de session,
-- refus du self-DM, verrou consultatif sur la paire, idempotence par
-- direct_pair_key, deux adhésions (owner + member).
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

    INSERT INTO public.conversations (type, name, created_by, direct_pair_key)
    VALUES ('direct', 'Conversation directe', v_caller_id, v_pair_key)
    RETURNING id INTO v_conv_id;

    INSERT INTO public.conversation_members (conversation_id, user_id, role)
    VALUES 
        (v_conv_id, v_caller_id, 'owner'),
        (v_conv_id, p_target_user_id, 'member');

    RETURN v_conv_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_or_create_direct_conversation(uuid) IS
  'F-002 : crée ou retourne la conversation directe appelant↔cible (idempotent par direct_pair_key, name renseigné, deux adhésions).';
