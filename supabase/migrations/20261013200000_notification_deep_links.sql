-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: A-183 — lien profond des notifications de message
-- Chantier communauté (audit 2026-10-12) — P1 notifications
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Le client gère déjà `?conversation=<uuid>` (ouverture directe dans l'inbox).
-- La notification serveur pointait vers `/messagerie` sans cible : elle
-- mène désormais à la discussion concernée.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_conversation_on_message_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_preview text;
  v_recipient record;
BEGIN
  UPDATE public.conversations
     SET last_message_at = NEW.created_at,
         updated_at = NEW.updated_at
   WHERE id = NEW.conversation_id;

  FOR v_recipient IN
    SELECT cm.user_id,
           COALESCE(cm.is_muted, false) AS is_muted,
           cm.mute_until
      FROM public.conversation_members cm
     WHERE cm.conversation_id = NEW.conversation_id
       AND cm.user_id <> NEW.sender_id
  LOOP
    UPDATE public.conversation_members
       SET unread_count = COALESCE(unread_count, 0) + 1
     WHERE conversation_id = NEW.conversation_id
       AND user_id = v_recipient.user_id;

    IF NOT v_recipient.is_muted
       OR (v_recipient.mute_until IS NOT NULL AND v_recipient.mute_until <= now()) THEN
      v_preview := CASE
        WHEN NEW.message_type = 'audio' THEN '🎤 Note vocale'
        WHEN NEW.message_type = 'image' THEN '📷 Photo'
        WHEN NEW.message_type = 'gpx' THEN '🗺️ Trace GPX'
        WHEN NEW.message_type = 'file' THEN '📎 Pièce jointe'
        ELSE LEFT(COALESCE(NEW.content, ''), 80)
      END;

      INSERT INTO public.notifications (user_id, type, title, message, actor_id, related_type, related_id, link)
      VALUES (
        v_recipient.user_id,
        'new_message',
        'Nouveau message LKDV',
        v_preview,
        NEW.sender_id,
        'conversation',
        NEW.conversation_id,
        '/messagerie?conversation=' || NEW.conversation_id::text
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_conversation_on_message_insert() IS
  'F-021 + A-183 : compteurs/non-lus/notifications serveur ; le lien mène directement à la discussion.';
