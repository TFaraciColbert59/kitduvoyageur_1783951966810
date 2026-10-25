-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: F-021 — dernier message, non-lus et notifications côté serveur
-- Chantier communauté (audit 2026-10-12) — P1 cohérence de la messagerie
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Constat (audit F-021, statuts C + D) : après envoi, le client tentait de
-- mettre à jour `conversations.last_message_at` (policy admin seulement :
-- échec silencieux pour un membre ordinaire) et distribuait lui-même des
-- notifications au nom des autres comptes, erreurs ignorées.
--
-- Correctif : un trigger AFTER INSERT sur `messages` fait autorité :
--   1) conversations.last_message_at = horodatage serveur du message ;
--   2) unread_count + 1 pour chaque autre membre (jamais l'expéditeur) ;
--   3) une notification in-app par destinataire non muet (title tronqué),
--      avec acteur et référence liée.
-- Le client ne distribue plus rien au nom des autres.
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
    SELECT cm.user_id, COALESCE(cm.is_muted, false) AS is_muted
      FROM public.conversation_members cm
     WHERE cm.conversation_id = NEW.conversation_id
       AND cm.user_id <> NEW.sender_id
  LOOP
    UPDATE public.conversation_members
       SET unread_count = COALESCE(unread_count, 0) + 1
     WHERE conversation_id = NEW.conversation_id
       AND user_id = v_recipient.user_id;

    IF NOT v_recipient.is_muted THEN
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
        '/messagerie'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_conversation_on_message_insert ON public.messages;
CREATE TRIGGER sync_conversation_on_message_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.sync_conversation_on_message_insert();

COMMENT ON FUNCTION public.sync_conversation_on_message_insert() IS
  'F-021 : maintient last_message_at, unread_count et les notifications in-app à l''insertion d''un message — le client n''écrit plus au nom des autres.';
