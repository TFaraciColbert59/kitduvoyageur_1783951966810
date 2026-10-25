-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: F-012 — persistance des états sociaux du fil
-- Chantier communauté (audit 2026-10-12) — P1 vérité des actions
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Constat (audit F-012) : favoris, masquage et likes de commentaires ne
-- vivaient que dans le state React de la carte du fil — tout disparaissait au
-- rechargement. Aucune table ne portait ces préférences.
--
-- Correctif : deux tables durables, alignées sur le patron post_likes
-- (lecture/public, écriture de sa propre ligne uniquement) :
--   - post_saves        : favoris de publication (lecture PRIVÉE : la
--                         préférence d'une personne ne regarde qu'elle) ;
--   - post_comment_likes : likes de commentaires (compteur public).
-- Le masquage des publications reste une préférence locale d'appareil
-- (localStorage) — pas de table serveur tant que le fil n'a pas de règle de
-- filtrage serveur dédiée (documenté au rapport).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) post_saves : favoris privés ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_saves_user_post_uniq UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS post_saves_post_idx ON public.post_saves(post_id);
CREATE INDEX IF NOT EXISTS post_saves_user_created_idx ON public.post_saves(user_id, created_at DESC);

ALTER TABLE public.post_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS post_saves_read_own ON public.post_saves;
CREATE POLICY post_saves_read_own ON public.post_saves
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS post_saves_insert_own ON public.post_saves;
CREATE POLICY post_saves_insert_own ON public.post_saves
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS post_saves_delete_own ON public.post_saves;
CREATE POLICY post_saves_delete_own ON public.post_saves
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS essai_sans_ecriture_publique ON public.post_saves;
CREATE POLICY essai_sans_ecriture_publique ON public.post_saves
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT is_anonymous_session());

REVOKE ALL ON public.post_saves FROM anon;
GRANT SELECT, INSERT, DELETE ON public.post_saves TO authenticated;

-- ── 2) post_comment_likes : likes de commentaires (compteur public) ────────
CREATE TABLE IF NOT EXISTS public.post_comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_comment_likes_user_comment_uniq UNIQUE (user_id, comment_id)
);

CREATE INDEX IF NOT EXISTS post_comment_likes_comment_idx ON public.post_comment_likes(comment_id);

ALTER TABLE public.post_comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS post_comment_likes_read ON public.post_comment_likes;
CREATE POLICY post_comment_likes_read ON public.post_comment_likes
  FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS post_comment_likes_insert_own ON public.post_comment_likes;
CREATE POLICY post_comment_likes_insert_own ON public.post_comment_likes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS post_comment_likes_delete_own ON public.post_comment_likes;
CREATE POLICY post_comment_likes_delete_own ON public.post_comment_likes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS essai_sans_ecriture_publique ON public.post_comment_likes;
CREATE POLICY essai_sans_ecriture_publique ON public.post_comment_likes
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT is_anonymous_session());

REVOKE ALL ON public.post_comment_likes FROM anon;
GRANT SELECT ON public.post_comment_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.post_comment_likes TO authenticated;

COMMENT ON TABLE public.post_saves IS
  'F-012 : favoris de publication, privés (lecture par la personne seule).';
COMMENT ON TABLE public.post_comment_likes IS
  'F-012 : likes de commentaires du fil — compteur public, écriture de sa propre ligne seule.';
