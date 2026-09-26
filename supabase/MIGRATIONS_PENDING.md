# Dette de migrations — base `icxyvwfzjbflcbqukpfz`

État figé au 2026-09-27, chantier « 2 routes ». Ce fichier est la **seule** source de vérité sur l'écart entre le SQL du dépôt et l'historique appliqué en base.

---

## ⚠ Avertissement — `supabase db push` est BLOQUÉ

**Ne pas lancer `supabase db push` sur cette base tant que les 2 versions *remote-only* ci-dessous n'ont pas de contrepartie locale.**

Le CLI compare le répertoire local à la table `supabase_migrations.schema_migrations` de la base. Deux versions existent en base sans fichier local correspondant ; le CLI les traite comme des migrations manquantes et le diff devient non fiable. Concrètement, un `db push` non supervisé risque de **rejouer `20260926010000`**, qui est un quasi-doublon de `20260926010115` déjà appliquée : le helper RLS serait recréé (risque R-3 du `FINAL_REPORT.md`).

**`supabase migration repair --status reverted` ne doit PAS être utilisé.** Cette commande écrit une ligne dans l'historique pour faire believe qu'une version a été annulée. Elle **inscrit un faux historique** qui survivrait à toutes les corrections ultérieures. C'est irréversible sans une nouvelle intervention manuelle sur `schema_migrations`.

Ordre de résolution obligatoire :

1. Récupérer le SQL des 2 versions *remote-only* (`20260920095523`, `20260926010115`) et le commiter dans `supabase/migrations/`.
2. Arbitrer le quasi-doublon `20260926010000` / `20260926010115` (voir §3).
3. Décider du sort des 4 migrations en attente (voir §2), en les appliquant ou en les marquant explicitement hors périmètre.
4. Seulement ensuite, un `db push` supervisé devient possible — et même alors, jamais sans relecture du diff complet.

---

## 1. État des 4 migrations du chantier — APPLIQUÉES ✅

Ces 4 versions sont **présentes à l'identique en local et en base**. Rien à faire.

| Version | Fichier | Statut |
|---|---|---|
| `20260926020000` | `unified_booking_schema` | ✅ appliquée (local == remote) |
| `20260926030000` | `seed_activity_catalog` | ✅ appliquée (local == remote) |
| `20260926040000` | `trip_launch_atomicity` | ✅ appliquée (local == remote) |
| `20260926050000` | `model_promotions_lifecycle` | ✅ appliquée (local == remote) |

Les *down-migrations* correspondantes existent dans `supabase/migrations_down/`.

---

## 2. Les 4 migrations EN ATTENTE ❌

Présentes dans `supabase/migrations/`, **absentes de la base**. Ce ne sont pas des migrations du chantier « 2 routes » : elles appartiennent à des chantiers antérieurs. Le chantier les a trouvées en attente et les a laissées telles quelles, faute de périmètre et de supervision sur la base.

| Version | Fichier | Raison du report | Décision à prendre |
|---|---|---|---|
| `20260917010000` | `phase1_security_fixes` | Chantier antérieur (sécurité / RLS). Appliquer hors supervision aurait modifié des politiques RLS en production sans revue. | Revue de sécurité dédiée, puis application supervisée. C'est de la **dette de sécurité** (risque R-4). |
| `20260925010000` | `messaging_rls_auth_initplan` | Idem — durcissement RLS de la messagerie. Dépend du contexte applicatif messaging, hors périmètre. | Idem. À traiter avec `20260925020000` dans le même lot. |
| `20260925020000` | `core_rls_auth_initplan` | Idem — durcissement RLS cœur. Mêmes politiques que ci-dessus, périmètre distinct. | Idem. |
| `20260926010000` | `rls_role_helper_execute` | **Quasi-doublon** d'une migration déjà appliquée en base. Voir §3. | ⚠ **Ne pas appliquer telle quelle.** Arbitrage obligatoire avant toute action. |

Aucune *down-migration* n'existe pour ces 4 versions : les 3 premières sont donc **à rollback manuel** en cas de problème.

---

## 3. Le quasi-doublon `20260926010000` / `20260926010115` ⚠

Ce point est le plus dangereux de la dette et mérite un traitement explicite.

- `20260926010115` **existe en base** (remote-only, pas de fichier local) et porte le correctif du helper RLS de rôle.
- `20260926010000_rls_role_helper_execute.sql` **existe en local** et vise le même correctif.
- Les deux timestamps sont très proches ; le second a été appliqué en base, le premier reste en attente.

**Conséquence :** appliquer `20260926010000` rejouerait la création du helper RLS alors qu'il est déjà en place. Selon le contenu exact, cela produit soit un `CREATE OR REPLACE` sans effet, soit une erreur sur un objet existant, soit une substitution non testée d'une fonction utilisée par des politiques actives.

**Décision à prendre — deux options, aucune n'est neutre :**

1. **Consolider** : ne conserver que `20260926010115` (la version réellement appliquée), supprimer `20260926010000` du dépôt, et documenter que le correctif a été appliqué via la base. C'est l'option la plus honnête au regard de l'historique.
2. **Reconcilier** : récupérer le SQL de `20260926010115`, le commiter en local, puis faire de `20260926010000` une no-op idempotente explicitement commentée, afin que les deux versions coexistent sans effet de bord.

Tant que ce choix n'est pas fait, `20260926010000` reste **bloquée**, et avec elle tout `db push`.

---

## 4. Les 2 migrations REMOTE-ONLY ❌

Présentes dans l'historique de la base, **sans fichier local**. Ce sont des migrations appliquées directement en base (via le dashboard ou le SQL editor) et jamais rapatriées dans le dépôt. Le dépôt ne peut donc pas rejouer un environnement de façon déterministe.

| Version | Fichier local | Ce qu'on sait | Décision à prendre |
|---|---|---|---|
| `20260920095523` | ❌ aucun |Timestamp du 20/09, entre la série `progression` (jusqu'à `20260920111000`) et `legacy_hardening`. Contenu inconnu. | ⚠ **Récupérer le SQL** depuis la base ou l'historique de l'équipe, puis le commiter. Contenu non documenté = environnement non reproductible. |
| `20260926010115` | ❌ aucun | Correctif du helper RLS de rôle, quasi-doublon de `20260926010000` (voir §3). | ⚠ **Récupérer le SQL** puis arbitrer avec `20260926010000`. |

---

## 5. Récapitulatif

| Catégorie | Nombre | Blocage `db push` |
|---|---|---|
| Appliquées (chantier) | 4 | non |
| En attente (local sans base) | 4 | oui — tant qu'elles ne sont pas arbitrées |
| Remote-only (base sans local) | 2 | **oui — bloquant** |

**Règle à retenir :** une migration n'est verte qu'après application réelle sur une base, et l'historique doit être **reconstituable depuis le dépôt**. Ces deux propriétés ne sont pas réunies aujourd'hui.
