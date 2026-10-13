-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: A-039 + A-032 + A-033 — publication idempotente, brouillons, bornes
-- Chantier communauté (audit 2026-10-12) — P1 publication
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A-039 : un timeout suivi d'un retry ne doit pas créer deux publications ni
--   deux crédits → clé d'idempotence fournie par le client, unicité
--   (auteur, clé) vérifiée en base.
-- A-032 : brouillon privé PAR UTILISATEUR (texte, titre, type, tags, lieu,
--   audience), lecture/écriture par la personne seule ; supprimé après
--   publication réussie ; jamais visible par un autre compte.
-- A-033 : bornes serveur (contenu non vide, longueur raisonnable) appliquées
--   aux nouvelles écritures sans invalider l'historique (NOT VALID).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── A-039 : clé d'idempotence de publication ───────────────────────────────
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS client_request_id uuid;
ALTER TABLE public.club_topics ADD COLUMN IF NOT EXISTS client_request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS community_posts_request_uniq
  ON public.community_posts (author_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS club_topics_request_uniq
  ON public.club_topics (author_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

-- ── A-033 : bornes serveur sur les nouvelles écritures ─────────────────────
DO $$
BEGIN
  ALTER TABLE public.community_posts
    ADD CONSTRAINT community_posts_content_bounds
    CHECK (char_length(btrim(content)) BETWEEN 1 AND 20000) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.club_topics
    ADD CONSTRAINT club_topics_content_bounds
    CHECK (char_length(btrim(content)) BETWEEN 1 AND 20000) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── A-032 : brouillon de publication privé ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_post_drafts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  content text NOT NULL DEFAULT '',
  post_type text,
  tags text[] NOT NULL DEFAULT '{}',
  location text,
  audience text,
  club_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_post_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drafts_select_own ON public.community_post_drafts;
CREATE POLICY drafts_select_own ON public.community_post_drafts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS drafts_insert_own ON public.community_post_drafts;
CREATE POLICY drafts_insert_own ON public.community_post_drafts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS drafts_update_own ON public.community_post_drafts;
CREATE POLICY drafts_update_own ON public.community_post_drafts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS drafts_delete_own ON public.community_post_drafts;
CREATE POLICY drafts_delete_own ON public.community_post_drafts
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS drafts_essai_sans_ecriture ON public.community_post_drafts;
CREATE POLICY drafts_essai_sans_ecriture ON public.community_post_drafts
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT is_anonymous_session());

REVOKE ALL ON public.community_post_drafts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_post_drafts TO authenticated;

COMMENT ON TABLE public.community_post_drafts IS
  'A-032 : brouillon de publication privé (une ligne par personne), supprimé après publication.';
COMMENT ON COLUMN public.community_posts.client_request_id IS
  'A-039 : clé d''idempotence fournie par le client — un retry ne crée jamais deux publications.';
