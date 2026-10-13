-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: F-029 — consolidation des doublons de policies et d'indexes
-- Chantier communauté (audit 2026-10-12) — P1 hygiène des permissions
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Constat (audit F-029, statut D) : policies permissives dupliquées (même
-- commande, même prédicat — OR redondant) et indexes strictement identiques
-- sur les tables du périmètre communauté.
--
-- Règle appliquée : suppression des doublons STRICTEMENT équivalents.
-- Aucune permission effective ne change (OR de deux prédicats identiques).
-- Les indexes d'unicité et les indexes fonctionnels distincts sont préservés.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Policies SELECT dupliquées (USING true, rôles public) ─────────────────
DROP POLICY IF EXISTS "Public read community_posts" ON public.community_posts;
DROP POLICY IF EXISTS "Public read post_comments" ON public.post_comments;
DROP POLICY IF EXISTS "Public read post_likes" ON public.post_likes;
DROP POLICY IF EXISTS "Public read club_events" ON public.club_events;

-- ── Policies INSERT dupliquées (autorité auteur) ───────────────────────────
-- Les variantes « Auth insert … » (rôles public) sont strictement
-- équivalentes aux variantes authenticated conservées (auth.uid()=author_id).
DROP POLICY IF EXISTS "Auth insert community_posts" ON public.community_posts;
DROP POLICY IF EXISTS "Auth insert post_comments" ON public.post_comments;
DROP POLICY IF EXISTS "Auth insert club_topics" ON public.club_topics;

-- ── Indexes strictement identiques (même définition) ───────────────────────
DROP INDEX IF EXISTS public.idx_community_posts_author;      -- ≡ idx_community_posts_author_id
DROP INDEX IF EXISTS public.idx_community_posts_created_at;  -- ≡ idx_community_posts_created
DROP INDEX IF EXISTS public.idx_post_comments_post_id;       -- ≡ idx_post_comments_post
