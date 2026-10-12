-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: F-019 + F-020 — boîte de réception bornée + mute temporaire réel
-- Chantier communauté (audit 2026-10-12) — P1 messagerie
-- ═══════════════════════════════════════════════════════════════════════════
--
-- F-019 : getConversations lisait TOUS les messages des conversations pour
-- choisir le dernier en mémoire (trafic non borné). Une projection autorisée
-- par conversation remplace la lecture complète.
--
-- F-020 : `updateMemberPreferences` recevait `mute_until` mais ne le
-- persistait pas (colonne inexistante) — le mute temporaire était donc un
-- mensonge. Colonne ajoutée, honorée par le trigger de notification.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── F-020 : colonne de suspension temporaire ───────────────────────────────
ALTER TABLE public.conversation_members
  ADD COLUMN IF NOT EXISTS mute_until timestamptz;

COMMENT ON COLUMN public.conversation_members.mute_until IS
  'F-020 : fin de suspension des notifications (NULL = pas de fin). is_muted = suspension globale.';

-- Trigger de notification mis à jour : le mute temporaire expiré reprend.
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
        '/messagerie'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- ── F-019 : projection bornée du dernier message par conversation ──────────
CREATE OR REPLACE FUNCTION public.get_last_messages(p_conversation_ids uuid[])
RETURNS TABLE (
  conversation_id uuid,
  id uuid,
  content text,
  message_type text,
  created_at timestamptz,
  sender_id uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT ON (m.conversation_id)
         m.conversation_id,
         m.id,
         m.content,
         m.message_type,
         m.created_at,
         m.sender_id
    FROM public.messages m
   WHERE m.conversation_id = ANY(p_conversation_ids)
   ORDER BY m.conversation_id, m.created_at DESC, m.id DESC;
$$;

REVOKE ALL ON FUNCTION public.get_last_messages(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_last_messages(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.get_last_messages(uuid[]) IS
  'F-019 : dernier message de chaque conversation demandée (RLS de l''appelant appliquée — un non-membre ne voit rien).';
