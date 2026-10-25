-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: F-028 — présence réelle par battement de cœur (heartbeat)
-- Chantier communauté (audit 2026-10-12) — P1 présence
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Le profil n'affiche plus de faux « En ligne » (F-028). La présence devient
-- RÉELLE : chaque client connecté confirme sa présence au plus une fois par
-- minute ; « en ligne » = last_seen_at < 2 minutes (voir useUserPresence).
--
-- Choix : battement de cœur en base plutôt qu'un canal Realtime Presence
-- privé — la table realtime.messages appartient au provider (aucune policy
-- créable en migration, ni en local ni en CI), tandis que cette table suit
-- exactement le patron RLS du dépôt : lecture authentifiée minimale (id seul
-- + horodatage), écriture de SA propre ligne uniquement, horodatage imposé
-- par trigger (un client ne peut pas mentir sur son heure).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS presence_read_authenticated ON public.user_presence;
CREATE POLICY presence_read_authenticated ON public.user_presence
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS presence_insert_own ON public.user_presence;
CREATE POLICY presence_insert_own ON public.user_presence
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS presence_update_own ON public.user_presence;
CREATE POLICY presence_update_own ON public.user_presence
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS presence_essai_sans_ecriture ON public.user_presence;
CREATE POLICY presence_essai_sans_ecriture ON public.user_presence
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT is_anonymous_session());

REVOKE ALL ON public.user_presence FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.user_presence TO authenticated;

-- Horodatage imposé côté base : ni client mensonger, ni horloge dérivante.
CREATE OR REPLACE FUNCTION public.force_presence_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.last_seen_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS force_presence_timestamp ON public.user_presence;
CREATE TRIGGER force_presence_timestamp
  BEFORE INSERT OR UPDATE ON public.user_presence
  FOR EACH ROW EXECUTE FUNCTION public.force_presence_timestamp();

COMMENT ON TABLE public.user_presence IS
  'F-028 : présence réelle (heartbeat). last_seen_at est imposé par trigger ; « en ligne » = moins de 2 minutes.';
