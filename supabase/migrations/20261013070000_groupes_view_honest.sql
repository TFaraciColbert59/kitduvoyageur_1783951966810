-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: F-009 — la vue legacy `groupes` ne présente plus de valeurs inventées
-- Chantier communauté (audit 2026-10-12) — P1 vérité des données
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Constat (audit F-009, statuts C + D) : la vue `groupes` (adaptateur legacy
-- au-dessus de `crews`) exposait des constantes présentées comme des données
-- réelles : destination 'Alps', progression 60 %, budget 18 000 c, distance
-- 27,4 km, dénivelé 1 620 m, deux nuits, dates = aujourd'hui.
--
-- Le modèle canonique des groupes d'expédition est `travel_groups`
-- (+ tables `group_*`), lu en premier par getGroupeComplet. `crews` reste la
-- tribu permanente ; la vue n'est qu'un adaptateur de compatibilité.
--
-- Correctif : les colonnes non soutenues par `crews` sont désormais NULL
-- (aucune métrique inventée). Les colonnes réelles (nom, description,
-- visibilité, capacité, dates de création) sont conservées à l'identique.
-- Vue en security_invoker (inchangé).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.groupes
WITH (security_invoker = true)
AS
SELECT
  id,
  NULL::uuid        AS carnet_id,
  created_by,
  name              AS nom,
  description       AS sous_titre,
  NULL::text        AS destination,
  NULL::text        AS massif,
  description,
  NULL::date        AS date_debut,
  NULL::date        AS date_fin,
  NULL::text        AS lieu_rdv,
  NULL::text        AS statut,
  NULL::text        AS etape_courante,
  NULL::integer     AS progression_pct,
  NULL::text        AS difficulte,
  NULL::integer     AS budget_prevu_cents,
  visibility        AS confidentialite,
  NULL::numeric     AS distance_km,
  NULL::integer     AS denivele_m,
  NULL::integer     AS nb_nuits,
  max_members       AS places_max,
  created_at,
  updated_at
FROM public.crews c;

COMMENT ON VIEW public.groupes IS
  'F-009 : adaptateur legacy crews → contrat historique groupes. Les métriques non stockées (destination, progression, budget, distance, dénivelé, nuits, dates) sont NULL — jamais inventées. Le modèle canonique des groupes d''expédition est travel_groups.';
