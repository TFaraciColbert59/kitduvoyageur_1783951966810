-- ============================================================================
-- RÉCONCILIATION STRIPE — ANALYSE DES ORPHELINS (LECTURE SEULE)
-- ============================================================================
-- Chemin RECOMMANDÉ : scripts/db/reconcile_stripe.mjs (un nœud, ligne de commande).
-- Ce fichier recoupe à la main dans la console Supabase (copie d'abord).
--
-- ⚠️  NE MODIFIE AUCUNE DONNÉE. Les seules écritures autorisées passent par
--      supabase/reconciliation/honor_order.sql (décision « honorer », service_role).
--
-- Prérequis : exporter les sessions checkout payées (mode LIVE) depuis Stripe.
--   • Stripe CLI : `stripe checkout sessions list --limit 100 --status complete`
--   • ou dashboard > Paiements > « Réussi » → exporter en CSV.
--
-- Source de vérité : docs/reports/RECONCILIATION_STRIPE.md (requêtes croisées).

-- ---------------------------------------------------------------------------
-- 0) Table de travail (vide de toute donnée applicative, jetable)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tmp_stripe_sessions (
  session_id     text PRIMARY KEY,
  customer_email text,
  amount_total   numeric,   -- montant en €, valeurs déjà divisées par 100
  created        timestamptz,
  refunded       boolean DEFAULT false
);

-- Import du CSV (l'une des deux options ; le SQL editor Supabase ne sait pas \COPY) :
--   a) Table Editor → tmp_stripe_sessions → Import CSV
--   b) psql : \COPY tmp_stripe_sessions FROM 'stripe_sessions.csv' WITH (FORMAT CSV, HEADER, DELIMITER ';')
-- Colonnes attendues : session_id ; customer_email ; amount_total ; created ; refunded
-- (un CSV non formaté peut être inséré à la main : voir bas de fichier)

-- ---------------------------------------------------------------------------
-- 1) Couverture actuelle en base
-- ---------------------------------------------------------------------------
-- Format actuel (depuis le Lot 3) : strates par stripe_session_id (index unique).
SELECT o.stripe_session_id, o.order_number, o.created_at, o.status
FROM public.orders o
WHERE o.stripe_session_id IS NOT NULL
ORDER BY o.created_at DESC;

-- Format legacy (avant réparation) : session tracée dans notes.
SELECT id, order_number, notes, created_at, status
FROM public.orders
WHERE (stripe_session_id IS NULL OR stripe_session_id = '')
  AND notes LIKE 'Stripe session: %'
ORDER BY created_at DESC;

-- ---------------------------------------------------------------------------
-- 2) LES ORPHELINS : payées + non refundées + aucune commande correspondante
-- ---------------------------------------------------------------------------
SELECT ts.created::date                              AS date_paiement,
       ts.session_id,
       ts.customer_email,
       ts.amount_total                               AS montant_eu,
       ts.refunded,
       CASE WHEN ts.amount_total <= 0 THEN 'ENQUÊTE'
            ELSE 'honorer / rembourser' END          AS piste_pre_tri
FROM tmp_stripe_sessions ts
LEFT JOIN public.orders o
       ON o.stripe_session_id = ts.session_id
      OR o.notes = 'Stripe session: ' || ts.session_id
WHERE ts.refunded = false
  AND o.id IS NULL
ORDER BY ts.created DESC, ts.amount_total DESC;
--   → coller chaque ligne dans le tableau de docs/reports/RECONCILIATION_STRIPE.md
--     et trancher : honorer (colis parti) / rembourser (rien livré) / enquête.

-- ---------------------------------------------------------------------------
-- (aide) Insert manuel d'une ligne si l'import CSV bloque :
-- ---------------------------------------------------------------------------
-- INSERT INTO tmp_stripe_sessions (session_id, customer_email, amount_total, created, refunded)
-- VALUES ('cs_XXXX', 'client@exemple.fr', 89.90, '2026-08-12T14:30:00Z', false);