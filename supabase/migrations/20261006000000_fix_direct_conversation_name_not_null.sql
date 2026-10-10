-- ============================================================================
-- FIX — get_or_create_direct_conversation viole NOT NULL sur conversations.name
-- ============================================================================
-- Contexte : la prod conserve la colonne legacy `conversations.name TEXT NOT NULL`
-- (migration 20260728150000), alors que la fonction canonique
-- (20260831000000) insérait uniquement (type, created_by, direct_pair_key).
-- Résultat : `null value in column "name" violates not-null constraint`.
--
-- Stratégie strictement additive et idempotente :
--   1. Backfill des lignes existantes sans name (sécurité).
--   2. DROP NOT NULL sur `name` (le front utilise `title`, `name` reste
--      pour compat legacy mais ne doit plus bloquer les inserts).
--   3. Redéfinition de la RPC pour renseigner `name` + `title`
--      (nom du destinataire si disponible, sinon fallback sûr).
-- ============================================================================

-- 1. Backfill défensif (ne touche que les NULL / chaînes vides).
UPDATE public.conversations
SET name = COALESCE(NULLIF(title, ''), 'Discussion LKDV')
WHERE name IS NULL OR name = '';

-- 2. Lever la contrainte NOT NULL legacy.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
      AND column_name = 'name'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.conversations ALTER COLUMN name DROP NOT NULL;
  END IF;
END $$;

-- 3. RPC corrigée : renseigne name + title, compatible ancien et nouveau schéma.
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
    v_target_name TEXT;
    v_display_name TEXT;
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

    -- Nom d'affichage : profil destinataire si lisible, sinon fallback non-NULL.
    BEGIN
        SELECT NULLIF(TRIM(full_name), '') INTO v_target_name
        FROM public.user_profiles
        WHERE id = p_target_user_id
        LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        v_target_name := NULL;
    END;

    v_display_name := COALESCE(v_target_name, 'Discussion directe');

    INSERT INTO public.conversations (type, name, title, created_by, direct_pair_key)
    VALUES ('direct', v_display_name, v_display_name, v_caller_id, v_pair_key)
    RETURNING id INTO v_conv_id;

    INSERT INTO public.conversation_members (conversation_id, user_id, role)
    VALUES
        (v_conv_id, v_caller_id, 'owner'),
        (v_conv_id, p_target_user_id, 'member');

    RETURN v_conv_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_direct_conversation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_or_create_direct_conversation(UUID) IS
'Crée ou récupère un DM 1:1 atomique (advisory lock + pair key). Renseigne name+title pour compat legacy.';
