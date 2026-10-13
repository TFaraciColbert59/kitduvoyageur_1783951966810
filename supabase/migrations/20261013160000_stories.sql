-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: F-027 — stories réelles : table, audience, expiration, signalement
-- Chantier communauté (audit 2026-10-12) — P1 lien « stories »
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Constat (audit F-027) : la barre de stories n'affichait QUE des exemples
-- locaux et « Votre story » n'avait aucun handler — la publication n'existait
-- ni côté client ni côté base.
--
-- Contrat retenu (lot 7 minimal mais complet) :
--   - publication : photo (bucket public carnet-media) + légende, 24 h ;
--   - audience : publique ou réservée à un club dont l'auteur est membre ;
--   - lecture : non expirée uniquement (public : tout membre ; club : membres) ;
--   - retrait : l'auteur supprime sa story ; les lectures ne la voient plus ;
--   - signalement : table dédiée conservant l'auteur même si la story expire ;
--   - blocage : réutilise user_blocks (déjà en place).
-- La purge physique des lignes/objets expirés relève du chantier purges
-- (gate humain) — les lignes expirées sont invisibles en attendant.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.post_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url text NOT NULL CHECK (char_length(image_url) <= 2048),
  caption text CHECK (char_length(caption) <= 280),
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'club')),
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_stories_club_target CHECK (visibility <> 'club' OR club_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS post_stories_author_idx ON public.post_stories(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS post_stories_expiry_idx ON public.post_stories(expires_at);

ALTER TABLE public.post_stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stories_read_public ON public.post_stories;
CREATE POLICY stories_read_public ON public.post_stories
  FOR SELECT TO authenticated
  USING (visibility = 'public' AND expires_at > now());

DROP POLICY IF EXISTS stories_read_own ON public.post_stories;
CREATE POLICY stories_read_own ON public.post_stories
  FOR SELECT TO authenticated
  USING (author_id = auth.uid());

DROP POLICY IF EXISTS stories_read_club ON public.post_stories;
CREATE POLICY stories_read_club ON public.post_stories
  FOR SELECT TO authenticated
  USING (
    visibility = 'club'
    AND club_id IS NOT NULL
    AND expires_at > now()
    AND is_club_member(club_id, auth.uid())
  );

DROP POLICY IF EXISTS stories_insert_own ON public.post_stories;
CREATE POLICY stories_insert_own ON public.post_stories
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (visibility = 'public' OR (visibility = 'club' AND club_id IS NOT NULL AND is_club_member(club_id, auth.uid())))
  );

DROP POLICY IF EXISTS stories_delete_own ON public.post_stories;
CREATE POLICY stories_delete_own ON public.post_stories
  FOR DELETE TO authenticated
  USING (author_id = auth.uid());

DROP POLICY IF EXISTS stories_essai_sans_ecriture ON public.post_stories;
CREATE POLICY stories_essai_sans_ecriture ON public.post_stories
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT is_anonymous_session());

REVOKE ALL ON public.post_stories FROM anon;
GRANT SELECT, INSERT, DELETE ON public.post_stories TO authenticated;

-- Signalements : la story peut disparaître, la trace reste.
CREATE TABLE IF NOT EXISTS public.story_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid REFERENCES public.post_stories(id) ON DELETE SET NULL,
  story_author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'Signalement story' CHECK (char_length(reason) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS story_reports_reporter_idx ON public.story_reports(reporter_id, created_at DESC);

ALTER TABLE public.story_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS story_reports_insert_own ON public.story_reports;
CREATE POLICY story_reports_insert_own ON public.story_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND NOT is_anonymous_session());

DROP POLICY IF EXISTS story_reports_read_own_or_admin ON public.story_reports;
CREATE POLICY story_reports_read_own_or_admin ON public.story_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.is_admin());

REVOKE ALL ON public.story_reports FROM anon;
GRANT SELECT, INSERT ON public.story_reports TO authenticated;

COMMENT ON TABLE public.post_stories IS
  'F-027 : stories communauté — 24 h, audience publique ou club, retrait par l''auteur, signalement tracé.';
COMMENT ON TABLE public.story_reports IS
  'F-027 : signalements de stories — conservés même si la story expire (story_id devient NULL).';
