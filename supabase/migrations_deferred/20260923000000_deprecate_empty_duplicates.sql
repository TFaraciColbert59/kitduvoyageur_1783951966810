-- =====================================================================
-- LKDV — OPÉRATION ZÉRO DÉFAUT
-- Migration Phase 5.2 : Dépréciation des tables vides en doublon conceptuel
-- Date: 17 septembre 2026
-- Constat :
--   - shop_products (67 lignes réelles) vs products (0 ligne), gear_items (0 ligne)
--   - materiel_loans (5 lignes réelles) vs loans (0 ligne)
-- RÈGLE : RENAME TO _deprecated_<nom> (aucune destruction de donnée).
-- =====================================================================

ALTER TABLE IF EXISTS public.products RENAME TO _deprecated_products;
ALTER TABLE IF EXISTS public.gear_items RENAME TO _deprecated_gear_items;
ALTER TABLE IF EXISTS public.loans RENAME TO _deprecated_loans;
