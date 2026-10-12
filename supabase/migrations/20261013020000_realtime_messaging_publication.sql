-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: F-003 — publication Realtime des tables de messagerie
-- Chantier communauté (audit 2026-10-12) — P0 réception temps réel
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Constat (audit F-003, statuts C + D) : les hooks useMessages / useConversations
-- s'abonnent à postgres_changes sur `messages`, `message_reactions`,
-- `conversations` et `conversation_members`, mais la publication
-- `supabase_realtime` ne contenait aucune table : aucun événement n'était
-- diffusé, la messagerie ne se mettait jamais à jour sans rechargement.
--
-- Correctif : ajouter les quatre tables à la publication.
--
-- REPLICA IDENTITY FULL :
--   - `messages` : filtre `conversation_id=eq.…` sur INSERT/UPDATE/DELETE
--     (F-018) — l'identité par défaut (PK) ne porte pas conversation_id dans
--     l'ancien enregistrement, les événements seraient filtrés à tort ;
--   - `conversation_members` : filtre `user_id=eq.…` avec event '*' (F-020 :
--     un refus supprime l'adhésion) — sans FULL, le DELETE n'est pas routé.
--   - `conversations` et `message_reactions` : écoutées sans filtre colonne,
--     l'identité par défaut suffit.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['messages', 'message_reactions', 'conversation_members', 'conversations'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_members REPLICA IDENTITY FULL;
