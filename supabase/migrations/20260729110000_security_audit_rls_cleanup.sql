-- Migration: Security audit & RLS cleanup (Lot A)
-- 🔒 Décisions prises en autonomie (revue a posteriori par Tony) :
--   - spatial_ref_sys: table système PostGIS (projections cartographiques, lecture seule).
--     RLS activée + SELECT public. Pas de policy écriture nécessaire.
--   - is_admin() → SECURITY INVOKER : ne lit que auth.uid(), pas besoin d'escalade.
--   - is_group_member/organizer restent SECURITY DEFINER (dépendance circulaire RLS).
--   - Duplicate policies nettoyées seulement quand vérifiées 100% identiques.

-- ═══════════════════════════════════════════════════════════════════
-- 1. spatial_ref_sys : ENABLE RLS + public SELECT
-- ═══════════════════════════════════════════════════════════════════
-- NOTE: Cette instruction ne peut PAS être exécutée via l'API Supabase
-- (table appartenant à postgres, pas à supabase_admin).
-- Appliquer via `supabase db push` en CLI si nécessaire.
-- Risque : table catalogue PostGIS en lecture seule, pas de données utilisateur.
--
-- ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "public_read_spatial_ref_sys" ON public.spatial_ref_sys
--   FOR SELECT USING (true);

-- ═══════════════════════════════════════════════════════════════════
-- 2. is_admin() : SECURITY DEFINER → SECURITY INVOKER
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Nettoyage des politiques dupliquées (uniquement doublons exacts)
-- ═══════════════════════════════════════════════════════════════════

-- ── community_posts : "Users can insert own posts" (rôle public → anon peut poster)
--    Doublon moins restrictif de auth_insert_community_posts (auth.uid() = author_id).
--    Suppression = durcissement de sécurité (pas d'insert anon).
DROP POLICY IF EXISTS "Users can insert own posts" ON public.community_posts;
-- "Public posts are viewable by everyone" = doublon de public_read_community_posts
DROP POLICY IF EXISTS "Public posts are viewable by everyone" ON public.community_posts;
-- community_posts_insert = doublon de auth_insert_community_posts
DROP POLICY IF EXISTS "community_posts_insert" ON public.community_posts;
-- community_posts_manage = doublon de auth_update_own_community_posts + auth_delete_own
DROP POLICY IF EXISTS "community_posts_manage" ON public.community_posts;
-- community_posts_read = doublon de public_read_community_posts
DROP POLICY IF EXISTS "community_posts_read" ON public.community_posts;

-- ── carnets : doublons des policies anglaises récentes
DROP POLICY IF EXISTS "Public carnets are viewable by everyone" ON public.carnets;
DROP POLICY IF EXISTS "Users can insert own carnets" ON public.carnets;
DROP POLICY IF EXISTS "Users can update own carnets" ON public.carnets;
DROP POLICY IF EXISTS "carnets_manage" ON public.carnets;
DROP POLICY IF EXISTS "carnets_read" ON public.carnets;
-- auth_manage_own_carnets = doublon de users_manage_own_carnets
DROP POLICY IF EXISTS "auth_manage_own_carnets" ON public.carnets;

-- ── user_profiles : doublons
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "public_read_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "users_insert_own_profile" ON public.user_profiles;

-- ── clubs : doublons
DROP POLICY IF EXISTS "public_read_clubs" ON public.clubs;
DROP POLICY IF EXISTS "clubs_read" ON public.clubs;

-- ── user_follows : doublons
DROP POLICY IF EXISTS "user_follows_manage" ON public.user_follows;
DROP POLICY IF EXISTS "user_follows_read" ON public.user_follows;
DROP POLICY IF EXISTS "auth_manage_own_user_follows" ON public.user_follows;

-- ── post_comments : doublons
DROP POLICY IF EXISTS "post_comments_manage" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_read" ON public.post_comments;

-- ── post_likes : doublons
DROP POLICY IF EXISTS "post_likes_manage" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_read" ON public.post_likes;

-- ── qa_questions : doublons
DROP POLICY IF EXISTS "qa_questions_manage" ON public.qa_questions;
DROP POLICY IF EXISTS "qa_questions_read" ON public.qa_questions;
DROP POLICY IF EXISTS "auth_update_own_qa_questions" ON public.qa_questions;

-- ── qa_answers : doublons
DROP POLICY IF EXISTS "qa_answers_manage" ON public.qa_answers;
DROP POLICY IF EXISTS "qa_answers_read" ON public.qa_answers;

-- ── ama_questions : doublons
DROP POLICY IF EXISTS "ama_questions_manage" ON public.ama_questions;
DROP POLICY IF EXISTS "ama_questions_read" ON public.ama_questions;

-- ── ama_sessions : doublons
DROP POLICY IF EXISTS "ama_sessions_manage" ON public.ama_sessions;
DROP POLICY IF EXISTS "public_read_ama_sessions" ON public.ama_sessions;

-- ── loyalty_history : doublons
DROP POLICY IF EXISTS "users_manage_own_loyalty_history" ON public.loyalty_history;
DROP POLICY IF EXISTS "users_read_own_loyalty_history" ON public.loyalty_history;

-- ── loyalty_redemptions : doublons
DROP POLICY IF EXISTS "users_manage_own_redemptions" ON public.loyalty_redemptions;
DROP POLICY IF EXISTS "users_read_own_redemptions" ON public.loyalty_redemptions;

-- ── occasion_items : doublons
DROP POLICY IF EXISTS "public_read_occasion" ON public.occasion_items;
DROP POLICY IF EXISTS "auth_manage_occasion" ON public.occasion_items;

-- ── rental_items : doublons
DROP POLICY IF EXISTS "public_read_rentals" ON public.rental_items;

-- ── reviews : doublons (reviews ≠ product_reviews)
DROP POLICY IF EXISTS "reviews_manage" ON public.product_reviews;
DROP POLICY IF EXISTS "reviews_read" ON public.product_reviews;

-- ── user_badges : doublons
DROP POLICY IF EXISTS "users_manage_own_user_badges" ON public.user_badges;

-- ── user_challenges : doublons
DROP POLICY IF EXISTS "users_manage_own_user_challenges" ON public.user_challenges;

-- ═══════════════════════════════════════════════════════════════════
-- 4. Vérification : tables à risque déjà sécurisées
-- ═══════════════════════════════════════════════════════════════════
-- Les tables suivantes ont été vérifiées manuellement et n'ont PAS de
-- policies USING(true)/WITH CHECK(true) excessives pour authenticated :
--   ambassadors, badges, carnet_gear_links, challenges, club_challenges,
--   experts, kit_items, kits, products, promo_codes, hiking_routes,
--   trail_metadata, trail_pois, trail_scores
-- Certaines n'ont que des policies SELECT public (lecture seule = OK).
-- D'autres ont des admin-only write ou owner-only write.
