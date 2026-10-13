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

## Vérifications prod (MCP, 2026-10-13)

- [x] Colonne `storage_path` présente, fonction `can_view_story` présente.
- [x] Policies `post_stories` : `stories_read_visible` + insert/delete/restrictive (les 3 lectures F-027 remplacées).
- [x] Bucket privé créé + 3 policies storage.
- [x] Tables `story_close_friends` + `story_hidden_users` créées, RLS activée.
- [ ] Matrice exécutée en prod (utilisateurs démo) — prochaine étape.
- [ ] Test local pgTAP `stories_v2_access.test.sql` — à lancer par l'opérateur (`node scratch/chantier/run-sql-test.mjs …`).
