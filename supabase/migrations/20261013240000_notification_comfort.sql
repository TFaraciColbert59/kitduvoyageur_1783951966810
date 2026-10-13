-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: A-186/A-187/A-188 — confort et vie privée des notifications
-- Chantier communauté (audit 2026-10-12) — P1 notifications
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A-186 : heures calmes (par utilisateur, fuseau explicite) + report des envois
--         (email/push) hors fenêtre — le contenu reste consultable dans l'app.
-- A-187 : aperçu sur écran verrouillé désactivé PAR DÉFAUT (le push ne
--         contient alors aucun texte privé).
-- A-188 : regroupement des notifications répétitives (commentaires, likes,
--         réactions, abonnements) — dix interactions ne font plus dix
--         interruptions : un compteur (×N) sur la même notification non lue.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── A-186 / A-187 : préférences ────────────────────────────────────────────
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS quiet_hours_start smallint,
  ADD COLUMN IF NOT EXISTS quiet_hours_end smallint,
  ADD COLUMN IF NOT EXISTS time_zone text NOT NULL DEFAULT 'Europe/Paris',
  ADD COLUMN IF NOT EXISTS push_preview_enabled boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  ALTER TABLE public.notification_preferences
    ADD CONSTRAINT notification_preferences_quiet_hours_range
    CHECK (
      (quiet_hours_start IS NULL OR quiet_hours_start BETWEEN 0 AND 23)
      AND (quiet_hours_end IS NULL OR quiet_hours_end BETWEEN 0 AND 23)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.notification_preferences.push_preview_enabled IS
  'A-187 : false (défaut) = le push ne révèle aucun texte privé sur écran verrouillé.';
COMMENT ON COLUMN public.notification_preferences.quiet_hours_start IS
  'A-186 : début de plage calme (heure locale du fuseau time_zone) ; NULL = pas de plage.';

-- ── A-186 : report des envois hors heures calmes ───────────────────────────
ALTER TABLE public.notification_deliveries
  ADD COLUMN IF NOT EXISTS scheduled_after timestamptz;

CREATE INDEX IF NOT EXISTS notification_deliveries_pending_idx
  ON public.notification_deliveries(status, scheduled_after)
  WHERE status = 'pending';

-- ── A-188 : regroupement des notifications répétitives ─────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS group_count integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.group_repetitive_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recent_id uuid;
  v_new_count integer;
BEGIN
  IF NEW.type NOT IN ('comment', 'like', 'reaction', 'follow') THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_recent_id
    FROM public.notifications
   WHERE user_id = NEW.user_id
     AND type = NEW.type
     AND COALESCE(related_id::text, '') = COALESCE(NEW.related_id::text, '')
     AND read = false
     AND created_at > now() - interval '30 minutes'
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_recent_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.notifications
     SET group_count = group_count + 1,
         message = regexp_replace(message, ' \(×[0-9]+\)$', '') || ' (×' || (group_count + 1) || ')',
         updated_at = now()
   WHERE id = v_recent_id
   RETURNING group_count INTO v_new_count;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS notifications_group_repetitive ON public.notifications;
CREATE TRIGGER notifications_group_repetitive
  BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.group_repetitive_notifications();

-- Hygiène des droits (règle A-214, `anon_grants_hardening` test 1) : une fonction de trigger
-- n'est jamais exécutable directement ; elle gardait l'EXECUTE par défaut de PUBLIC (donc
-- d'anon). Un trigger s'exécute sous le rôle propriétaire : rien ne change à son déclenchement.
-- Ajouté le 13 oct. avant toute application en production (version absente du registre).
REVOKE ALL ON FUNCTION public.group_repetitive_notifications() FROM PUBLIC, anon, authenticated;
