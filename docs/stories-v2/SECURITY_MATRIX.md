# Stories V2 — Matrice de sécurité

## Identités de test (SQL local)

`v2_a` créateur, `v2_b` abonné, `v2_c` tiers, `v2_d` ami proche — `stories_v2_access.test.sql` (16 assertions).

## Surfaces × profils

| Visibilité | Auteur | Abonné | Proche | Club actif | Tiers | Bloqué | Masqué | Anonyme |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| public | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| followers | ✅ | ✅ | — | — | ❌ | ❌ | ❌ | ❌ |
| close_friends | ✅ | ❌ | ✅ | — | ❌ | ❌ | ❌ | ❌ |
| club | ✅ | — | — | ✅ | ❌ | ❌ | ❌ | ❌ |
| only_me | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| expirée | ✅ (archive) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `removed` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

## Médias

- Bucket `stories-private` : `public=false` vérifié en prod (MCP, 2026-10-13).
- Policies storage : upload/lecture/suppression = propriétaire (`{uid}/…`) et `NOT is_anonymous_session()`.
- Accès servi par `/api/stories/:id/media` : session → RLS → signed URL 120 s. Story invisible ⇒ 404 sans corps sensible.
- Legacy `carnet-media` : URLs publiques existantes **restent servies** (limite documentée, migration pilote à décider — RELEASE_ROLLBACK.md).

## Vérifications prod (MCP, 2026-10-13) — matrice 16/16 conforme

Comptes réels : `demo.a.stories@lkdv.dev` (`24e75be2…`), `demo.b.stories@lkdv.dev` (`516cc9a1…`). Transactions annulées (`rollback`) : aucune donnée modifiée.

| # | Assertion | Résultat |
| --- | --- | --- |
| 1 | Publique visible par B | ✅ true |
| 2 | Viewer NULL refusé | ✅ false |
| 3 | Publique visible par un inconnu | ✅ true |
| 4 | Anonyme sans GRANT SELECT | ✅ false |
| 5 | followers : non-abonné refusé | ✅ false |
| 6 | only_me : tiers refusé | ✅ false |
| 7 | only_me : auteur autorisé | ✅ true |
| 8 | close_friends : hors liste refusé | ✅ false |
| 9 | expirée : tiers refusé | ✅ false |
| 10 | expirée : auteur autorisé (archive) | ✅ true |
| 11 | followers : abonné autorisé (après follow) | ✅ true |
| 12 | close_friends : proche autorisé (après ajout) | ✅ true |
| 13 | close_friends : masquage effectif | ✅ false |
| 14 | publique : masquage effectif aussi | ✅ false |
| 15 | RLS impersonnée B : 2 stories publiques lues | ✅ 2 |
| 16 | RLS impersonnée B après blocage : 0 lue | ✅ 0 |

## CI — database-gates (base éphémère, 2026-10-13)

`supabase/tests/database/stories_v2_access.test.sql .... ok` — **Files=94, Tests=1539, Result: PASS** (run 38470928214). Les migrations 20261013280000/281000/282000 s'appliquent proprement sur une base neuve (schéma du dépôt), `stories.test.sql` (F-027, 9 scénarios) reste vert avec la nouvelle RLS.

## Reste à vérifier

- [ ] Route média en runtime (signed URL) — smoke après déploiement (checklist PR).
