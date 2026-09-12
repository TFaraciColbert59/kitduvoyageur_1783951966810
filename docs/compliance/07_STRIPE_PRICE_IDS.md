# Stripe — Price IDs attendus, entitlements et fail-safe

> **À VALIDER PAR UN HUMAIN HABILITÉ — BROUILLON / configuration.** Aucune clé
> réelle n'est présente. Aucun prix n'est créé ni inventé par le code.

**Date du brouillon :** 2026-09-12

## 1. Liste exacte des variables attendues (6)

| Variable d'environnement | Plan / passe | Valeur réelle |
|---|---|---|
| `STRIPE_SECRET_KEY` | Clé API secrète serveur | `INSUFFICIENT_DATA` (non fournie) |
| `STRIPE_WEBHOOK_SECRET` | Secret de signature webhook | `INSUFFICIENT_DATA` (non fourni) |
| `STRIPE_PRICE_EXPLORER` | Plan `explorer` | `INSUFFICIENT_DATA` |
| `STRIPE_PRICE_EXPEDITION` | Plan `expedition` | `INSUFFICIENT_DATA` |
| `STRIPE_PRICE_GROUP` | Plan `group` | `INSUFFICIENT_DATA` |
| `STRIPE_PRICE_PASS_WEEKEND` | Passe `weekend` | `INSUFFICIENT_DATA` |
| `STRIPE_PRICE_PASS_TRIP` | Passe `trip` | `INSUFFICIENT_DATA` |
| `STRIPE_PRICE_PASS_EXPEDITION` | Passe `expedition` | `INSUFFICIENT_DATA` |

Source de vérité des noms : `src/lib/entitlements/server.ts:37`
(`STRIPE_PRICE_ENV_KEYS`). Aucune valeur de prix n'est codée en dur.

## 2. Comportement fail-safe (testé, sans clé)

- Sans `STRIPE_SECRET_KEY` valide (vide ou placeholder `your-`) **et** sans au
  moins un price ID : `stripeBillingConfiguration().configured === false`.
- `GET /api/billing/entitlements` ne renvoie **que des booléens**
  (`secretKey`, `priceIds`) — jamais une clé, jamais un prix.
- Un plan inconnu ou une métadonnée inconnue retombe sur `free` /
  aucune passe ; aucun entitlement n'est crédité par défaut.
- Les entitlements sont **écrits uniquement côté serveur** (webhook Stripe ou
  `service_role`) ; `user_entitlements` n'offre aux clients qu'un `SELECT` de
  leur propre ligne (vérifié pgTAP Phase 8, tests TEST-PHASE8-RLS-27).
- Le checkout `/api/checkout` refuse explicitement l'appel sans
  `STRIPE_SECRET_KEY` (503) : aucun paiement simulé.

Tests de référence : `tests/security/phase8-stripe-events.spec.ts`
(TEST-PHASE8-STRIPE-PRICE-01..05),
`tests/security/phase8-entitlements-forge.spec.ts`,
`supabase/tests/database/phase8_rls_access.test.sql`.

## 3. Procédure de configuration (humain, hors dépôt)

1. Créer les 3 prix récurrents (plans) et 3 prix one-shot (passes) dans Stripe.
2. Renseigner les 6 variables `STRIPE_PRICE_*` + `STRIPE_SECRET_KEY` (clé
   restreinte serveur) + `STRIPE_WEBHOOK_SECRET` dans Vercel (par environnement).
3. Configurer l'endpoint webhook vers `/api/stripe/webhook` et souscrire aux
   événements : `checkout.session.completed`, `invoice.paid`,
   `invoice.payment_succeeded`, `invoice.payment_failed`, `charge.refunded`,
   `customer.subscription.deleted`.
4. Vérifier en mode test Stripe : paiement, renouvellement, échec, remboursement,
   annulation (les tests unitaires ne remplacent pas un essai bout-en-bout).
5. Ne jamais committer de clé ; l'invariant CI interdit `sk_live_`/`whsec_`.

**Statut : `INSUFFICIENT_DATA` — aucune clé ni prix réels disponibles. Aucun test
Stripe réel n'a été exécuté.**
