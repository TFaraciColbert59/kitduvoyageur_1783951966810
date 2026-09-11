# Rapport A11 — Domaine `kit_attributions` (réimplémentation additive + réactivation pgTAP)

Date : 2026-09-11 — branche `audit/adventure-intelligence` (worktree `ai-finalization`)

## 1. Statut

| Livrable | État |
|---|---|
| `supabase/migrations/20260911400000_a11_kit_attributions.sql` | créé, appliqué, rejouable depuis la baseline |
| `supabase/tests/database/attributions.test.sql` | réactivé (retour de quarantaine), **7/7 vert** |
| `supabase/tests/database/security_lignees.test.sql` | réactivé (retour de quarantaine), **10/10 vert** |
| `supabase/tests/database/quarantined/README.md` | mis à jour (entrées attributions/security retirées, réactivation documentée ; conservation reste quarantinée) |
| Gate `scripts/db/install-from-baseline.ps1 -Mode upgrade` | SUCCÈS — 35 migrations post-baseline strictes, 0 échec, F1 ok |

## 2. Conception

### 2.1 Objets

- `royalty_config` : barème en base (`global_bps=300`, weights `70/20/10`, `max_generations=3`, `floor_cents=1`), valeurs ratifiées reprises du gel Lot 6.
- `kit_attributions` : une ligne par `order_item` (`UNIQUE (order_item_id)` = idempotence webhook), statut `pending|confirmed|reversed|paid`, FK `materiel_kits`/`order_items` en `ON DELETE CASCADE`, `shop_products` en `ON DELETE SET NULL`.
- `kit_royalty_shares` : une part par `(attribution, bénéficiaire)`, `generation_gap` borné 0..2, `share_cents > 0`, `beneficiary_id → auth.users ON DELETE CASCADE`.
- `store_credit_ledger` : ledger append-only, `user_id → auth.users ON DELETE CASCADE`, `amount_cents <> 0`, `entry_type credit|debit`.
- `reward_accounts.store_credit_cents bigint NOT NULL DEFAULT 0` (extension additive).
- Index : `(kit_id)`, `(status, created_at)`, `(beneficiary_id, status)`, ledger `(user_id, created_at DESC)`.

### 2.2 RPC (SECURITY DEFINER, `search_path = public, pg_temp`, service_role uniquement)

| Fonction | Rôle |
|---|---|
| `insert_kit_attribution(...)` | condition terrain (session ≥ 1 km sur la lignée), produit présent dans le kit, création + parts, idempotente, auto-achat exclu |
| `finalize_kit_attributions()` | pending → confirmed après 14 j, parts confirmées, crédit boutique une seule fois (`paid`), `LIMIT 500 FOR UPDATE SKIP LOCKED` |
| `reverse_kit_attribution_by_session(text)` | refund Stripe : débit par bénéficiaire si déjà payé, ledger + compte borné à 0, tout → reversed |

### 2.3 Matrice RLS / privilèges

| Table | RLS | Policy SELECT | SELECT anon | SELECT authenticated | Écriture |
|---|---|---|---|---|---|
| `royalty_config` | oui | aucune (serveur seul) | non | non | service_role |
| `kit_attributions` | oui | bénéficiaire de la part (embed `my-royalties`) | 0 ligne | ses attributions | service_role / RPC |
| `kit_royalty_shares` | oui | `auth.uid() = beneficiary_id` | 0 ligne | ses parts | service_role / RPC |
| `store_credit_ledger` | oui | `auth.uid() = user_id` | 0 ligne | son ledger | service_role / RPC |
| `reward_accounts` | oui (baseline) | policy existante | — | inchangé | RPC definer |

Grants et révocations explicites sur toutes les tables et fonctions ; `REVOKE EXECUTE ... FROM public, anon, authenticated` sur les 3 RPC.

## 3. TDD — RED / GREEN (exécution réelle)

### 3.1 RED (base baseline + 34 migrations post-baseline, migration absente)

```
attributions.test.sql:63  ERROR: function public.insert_kit_attribution(uuid, uuid, uuid, integer, integer, jsonb, uuid) does not exist
                          Failed 7/7 subtests — Bad plan (7 prévus, 0 exécuté) — Result: FAIL

security_lignees.test.sql:35 ERROR: relation "public.kit_attributions" does not exist
                          Failed 10/10 subtests — Bad plan (10 prévus, 0 exécuté) — Result: FAIL
```

### 3.2 GREEN (base rejouée par la gate, migration appliquée)

```
npx supabase test db --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres <suite>
attributions.test.sql       ... ok — Files=1, Tests=7,  Result: PASS
security_lignees.test.sql   ... ok — Files=1, Tests=10, Result: PASS
```

Aucun `not ok`, aucune erreur SQL. La gate exécutant aussi les suites par psql, les deux fichiers passent sans erreur de parsing.

### 3.3 Adaptations de fixtures (strict nécessaire, documentées dans l'en-tête des suites)

1. **Casts `::int`** sur `count(*)`/`sum()` (assertions 1–7 d'attributions, 8–9 de security) : pgTAP 1.3.3 ne résout pas `anyelement` entre `bigint` et `integer` ; les autres suites actives castent déjà.
2. **Order_item dédié ATTR-003** pour le test d'auto-achat : l'original rejouait l'order_item du test 1 ; l'idempotence court-circuitait l'appel avant la règle « aucune part pour l'acheteur ».
3. **Assertion 5 scopée** à l'attribution ATTR-003 : comptée globalement, elle incluait la part légitime du forkeur créée par le test 1 (achat par un tiers) et était donc insatisfiable.

## 4. Écarts avec la migration gelée et justification

| # | Écart | Pourquoi |
|---|---|---|
| 1 | `REVOKE EXECUTE ... FROM anon, authenticated` en plus de `PUBLIC` | Les default privileges Supabase accordent EXECUTE aux rôles clients à la création : sans ce revoke, le test 10 (`permission denied`) échouerait et anon pourrait appeler la RPC. |
| 2 | `kit_royalty_shares.created_at` | `/api/kits/my-royalties` trie les parts par `created_at` (absent du gel → route cassée). |
| 3 | `CHECK (generation_gap BETWEEN 0 AND 2)` | Aligné sur `max_generations=3` et les poids 70/20/10 du barème. |
| 4 | Policy SELECT bénéficiaire sur `kit_attributions` | L'embed PostgREST `kit_attributions!inner(...)` de `my-royalties` exige une policy ; le gel disait « aucune policy client », incohérent avec son propre consommateur. |
| 5 | `royalty_config` RLS + serveur seul | Le commentaire d'origine (« lue par le serveur, jamais par le client ») contredisait le `GRANT SELECT` au client du gel. |
| 6 | `finalize_kit_attributions` confirme aussi les parts | Le gel ne passait jamais les parts de `pending` à `confirmed` : la boucle de crédit ne versait donc jamais rien. |
| 7 | Débit par bénéficiaire au reversal | Le gel soustrayait le total de l'attribution à chaque compte concerné (double débit si plusieurs bénéficiaires) ; version corrigée par agrégat `GROUP BY beneficiary_id`, toujours bornée à 0. |
| 8 | `COALESCE(lineage_root_id, id)` et `ON CONFLICT DO NOTHING` sur les parts | Robustesse (lignée non encrée, doublons de bénéficiaire dans `p_shares`). |
| 9 | Index `(status, created_at)` et ledger `(user_id, created_at)` | Scans du cron de finalisation et de `my-royalties`. |
| 10 | Aucune modification de `handle_kit_lineage` | Le correctif anti-cycle A11 (`20260911350000`) est un prérequis appliqué avant ; la migration ne réactive rien du gel. |

Valeurs du barème, noms d'objets, sémantique d'idempotence et contrat des RPC restent ceux du gel.

## 5. Points d'attention

1. `conservation.test.sql` reste quarantinée (sémantique de fixtures/matviews, hors périmètre A11).
2. `a10_session_lease.test.sql` échoue 1/12 (« claim(10) … have 2 want 3 ») **avant et après** cette migration — pré-existant, hors périmètre.
3. `scripts/db/install-from-baseline.ps1` vérifie le code de sortie psql mais pas le TAP : une assertion pgTAP en échec n'y est pas détectée. Recommandation : ajouter un contrôle `not ok` (ou `supabase test db` ciblé) dans la gate.
4. `npx supabase test db <dossier>` est récursif et exécute aussi `quarantined/` ; la gate, elle, ne prend que `database/*.test.sql`.
