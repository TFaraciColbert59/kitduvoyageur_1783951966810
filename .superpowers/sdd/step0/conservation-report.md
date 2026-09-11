# Rapport A11 — Domaine conservation (matviews corrigées à la source + réactivation pgTAP)

Date : 2026-09-11 — branche `audit/adventure-intelligence` (worktree `ai-finalization`)

## 1. Statut

| Livrable | État |
|---|---|
| `supabase/migrations/20260911410000_a11_conservation_matviews_fix.sql` | créé, appliqué, rejouable depuis la baseline |
| `supabase/tests/database/conservation.test.sql` | réactivée (retour de quarantaine), **8/8 vert** |
| `supabase/tests/database/quarantined/README.md` | mis à jour (entrée conservation retirée, réactivation documentée) |
| Gate `scripts/db/install-from-baseline.ps1 -Mode install` | SUCCÈS — 36 migrations post-baseline strictes, 0 échec |
| Preuve refresh + index | `refresh_kit_conservation()` OK, `kit_trust_scores_kit_id_key` présent, 0 doublon |

## 2. Diagnostic (sémantique attendue vs DDL réel)

Suite lue intégralement (forks externes vs auto-forks, items, sessions, verdicts).
La matview `kit_trust_scores` (baseline + `20260903040000`) contenait un bug de
corrélation : le LATERAL endurance se terminait par `GROUP BY s.kit_id) es ON true`
**sans `WHERE s.kit_id = k.id`**. Le LATERAL non corrélé renvoyait un groupe par
kit ayant des sessions, joint à **tous** les kits → produit cartésien :

- doublons de `kit_id` (12 lignes pour 6 kits sur les fixtures) → `REFRESH
  MATERIALIZED VIEW` en échec via `could not create unique index
  "kit_trust_scores_kit_id_key"` ;
- colonnes endurance (sessions/km/saisons) recopiées du mauvais kit
  (la souche affichait `sessions_count = 2` et `1`).

Second écart : la clé de fixture `'rchaud'` n'existe pas — `materiel_kit_items.item_key`
est une colonne générée `lower(name)` avec `[^a-z0-9]+ → '-'`, soit `'r-chaud'`
(sémantique certifiée par `lineage.test.sql` 8a). L'assertion 1 renvoyait donc NULL.

## 3. Sémantique retenue (conforme à la suite)

- **Forks externes** uniquement : `child.user_id IS DISTINCT FROM parent.user_id`
  (auto-forks exclus des paires comme de la propagation).
- **Conservation** : un item (identifié par son `item_key`) est *kept* par un fork
  externe si l'enfant possède au moins un item de même `item_key`
  (`EXISTS`), sinon *dropped*. `total_pairs` = forks externes comptés une fois.
- **Propagation** (axe 1) : descendants réels `ancestors @> ARRAY[k.id]`,
  un `user_id` compté une fois, seuls les forks avec session comptés,
  décroissance `1/pow(age_h + 2, 1.5)`.
- **Endurance** (axe 2) : sessions/verdicts du kit courant **uniquement**
  (`WHERE s.kit_id = k.id`).
- **Plancher de crédibilité** : `has_min_sessions = sessions_count >= 5`.
- **Une seule ligne par kit** garantie par construction : agrégation explicite
  `GROUP BY k.id, k.lineage_root_id, k.origin` + laterals corrélés.

## 4. DDL avant / après (extraits)

`kit_trust_scores` — LATERAL endurance :

```sql
-- AVANT (produit cartésien : doublons kit_id)
LEFT JOIN LATERAL (
  SELECT ... FROM public.hike_sessions s
    LEFT JOIN public.hiking_routes r ON r.id = s.route_id
    LEFT JOIN public.kit_field_reports fr ON ...
  GROUP BY s.kit_id
) es ON true

-- APRÈS (corrélé + agrégation finale explicite)
LEFT JOIN LATERAL (
  SELECT ... FROM public.hike_sessions s
    LEFT JOIN public.hiking_routes r ON r.id = s.route_id
    LEFT JOIN public.kit_field_reports fr ON ...
  WHERE s.kit_id = k.id
) es ON true
GROUP BY k.id, k.lineage_root_id, k.origin;   -- + max()/bool_or() sur ls/es
```

`kit_item_survival` / `kit_item_survival_by_kit` :

```sql
-- AVANT : JOIN enfant sur item_key, multiplicités possibles
LEFT JOIN public.materiel_kit_items ci
  ON ci.kit_id = edges.child_id AND ci.item_key = pi.item_key

-- APRÈS : paires dédupliquées + EXISTS (un item gardé reste compté 1 fois)
SELECT DISTINCT kit_id, item_key, product_id FROM public.materiel_kit_items
EXISTS (SELECT 1 FROM public.materiel_kit_items ci
        WHERE ci.kit_id = edges.child_id AND ci.item_key = pi.item_key)
```

La migration recrée les 3 matviews (`DROP ... IF EXISTS` / `CREATE MATERIALIZED
VIEW ... WITH DATA`), recrée les 3 index uniques et repose les `GRANT SELECT`
(anon, authenticated, service_role). Idempotente. `refresh_kit_conservation()`
(migration `20260911390000`) n'est pas modifiée : sans doublon structurel, le
plain refresh et la (re)création best-effort de l'index réussissent.

## 5. TDD — RED / GREEN (exécution réelle)

### 5.1 RED (suite réactivée, migration non appliquée)

```
psql:...conservation.test.sql:71: WARNING: A11 — index unique kit_trust_scores
  non créé (doublons kit_id) : could not create unique index "kit_trust_scores_kit_id_key"
psql:...conservation.test.sql:92: ERROR: function is(numeric, integer, unknown) does not exist
# Failed test 1: "1. Item abandonné par 2 forks sur 3 → conservation 33,3 %"
#         have: NULL   want: 33.3
Failed 8/8 subtests — Bad plan (8 prévus, 1 exécuté) — Result: FAIL
```

### 5.2 GREEN (migration appliquée, casts/pièces de fixture alignés)

```
npx supabase test db --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  supabase/tests/database/conservation.test.sql
conservation.test.sql .. ok
Files=1, Tests=8, Result: PASS   (aucun not ok)
```

Suite complète (`npx supabase test db` sur la base réinstallée) :

```
Files=10, Tests=151 — toutes vertes SAUF a10_session_lease.test.sql 1/12
(a10_session_lease échoue aussi à HEAD sans ces changements : pré-existant, hors périmètre)
```

### 5.3 Preuve refresh + index unique (exigence 4)

```
SELECT public.refresh_kit_conservation();        -- réussit
SELECT indexname FROM pg_indexes WHERE indexname = 'kit_trust_scores_kit_id_key';
        indexname
---------------------------
 kit_trust_scores_kit_id_key
SELECT count(*) FROM (...) d;                    -- 0 doublon
```

`NOTICE: relation "kit_trust_scores_kit_id_key" already exists, skipping` provient
du `CREATE UNIQUE INDEX IF NOT EXISTS` de la fonction de résilience : **aucun
WARNING**, l'index existe (créé par la migration). L'ancien warning « index non
créé (doublons) » a disparu.

### 5.4 Gate baseline

```
powershell -File scripts/db/install-from-baseline.ps1 -Mode install
[certify] Migrations post-baseline : 36 fichiers (strictes)
[certify] SUCCÈS — mode install certifié (0 échec).
```

## 6. Changements de fixtures (strict nécessaire, documentés inline)

| # | Changement | Justification |
|---|---|---|
| 1 | `item_key = 'rchaud'` → `'r-chaud'` (test 1) | `item_key` généré par la baseline (`lower` + `[^a-z0-9]+ → '-'`) ; `'rchaud'` n'a jamais existé. Référence certifiée par `lineage.test.sql` 8a. |
| 2 | `100` → `100::numeric` (test 2) | pgTAP 1.3.3 : `is(anyelement, anyelement)` exige des types identiques (`round(...,0)` est `numeric`). |
| 3 | `total_pairs` → `total_pairs::int` (test 3) | `count(*)` est `bigint`, attendu `3` (int). |
| 4 | `fork_users_unique` → `fork_users_unique::int` (test 4) | Idem (bigint vs int). |

Aucune donnée de fixture, aucun scénario, aucune assertion métier modifiés.

## 7. Points d'attention

1. `a10_session_lease.test.sql` échoue 1/12 (« claim(10) … have 2 want 3 »)
   **avant et après** ces changements (vérifié par `git stash` à HEAD) :
   pré-existant, hors périmètre conservation.
2. La gate `install-from-baseline.ps1` vérifie le code de sortie psql mais pas le
   TAP : une assertion pgTAP en échec n'y est pas détectée. Le contrôle de
   référence reste `npx supabase test db` (ciblé ou complet).
3. `kit_item_survival*` exposent `item_key` tel que généré par la table
   (`'r-chaud'`) ; tout consommateur doit utiliser cette clé.
4. `npx supabase test db <dossier>` est récursif et exécuterait
   `quarantined/` ; le dossier ne contient plus que son README.
