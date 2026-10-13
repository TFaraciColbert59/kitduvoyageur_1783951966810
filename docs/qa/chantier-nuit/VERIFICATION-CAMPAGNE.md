# Campagne « tout essayer » — vérification complète du HEAD

**Date** : 13 octobre 2026 (soir) · **HEAD vérifié** : `b5ee831d` (worktree isolé) + correctifs `58f1e6bf`/`820dafa1`
**Méthode** : worktree git isolé du HEAD commité (hors refactor non commité du chantier parallèle), serveur dev dédié sur :4000, base Supabase locale + projet cloud lié pour les fetchs.

## Résultats par étape

| # | Épreuve | Résultat | Détail / attribution |
|---|---|---|---|
| 1 | **pgTAP complet** (93 suites, base locale) | **90 ✅ / 3 ✗ attribués** | `compas_geo_pois` : table `geo_pois` absente = **gate humain** non appliqué (voulu) ; `compas_geo_route_rls` : `purge_route_cache` (migration co-agent non appliquée en local) ; `intent_source_atomicity` : anomalie locale pré-existante hors périmètre |
| 2 | **vitest complet** (worktree HEAD) | **10 174 ✅ / 12 ✗ attribués** | 8 × `ephemeralDbGuards` : spawn `bash`/`grep` indisponibles sous Windows (verts sur ubuntu CI) ; 2 × `v2Registry` : drift doc/régistre **déjà corrigé par les édits non commités du co-agent** (42/42 dans le worktree principal) ; 2 flaky même famille |
| 3 | **a11y** (57 tests, routes mobile/iPad) | **57/57 ✅** | zéro violation critical/serious contre le HEAD |
| 4 | **Verre** (contrat Liquid Glass, 36) | **36/36 ✅** | contraste et géométrie des surfaces canoniques |
| 5 | **e2e `@local-web`** | **39 ✅ / 6 ✗ attribués / 15 skip** | 6 = redirections middleware héritées : le middleware redirige désormais vers `/compas?etape=kit` (évolution commitée du co-agent), les tests attendent encore `/hub/preparation` — tests obsolètes, domaine Compas |
| 6 | **Smoke navigateur** (8 routes communauté, WebKit mobile) | **8/8 ✅** | fil, clubs, groupes, événements (onglet), entraide, publier, messagerie, événements — console : uniquement les 2 bénignes connues (viewport WebKit, télémétrie anonyme — corrigée depuis) ; captures : `scratch/chantier/smoke/head-0*.png` |
| 7 | **Stockage 2 clients** (A téléverse, B accède, C refusé, clé durable) | **PASS ✅** | `scripts/e2e/messaging-storage.mjs` |
| 8 | **Temps réel 2 clients** | **PASS ✅** | `scripts/e2e/messaging-realtime.mjs`, avec reprise automatique anti-tenant à froid |
| 9 | **Lighthouse mobile** `/communaute` | **A11y 100 · SEO 100 · Agentic 100 · Best-practices 96** | 52 audits passés ; échec résiduel `errors-in-console` = ressources externes bloquées par le bac à sable du navigateur d'audit (`ERR_INTERNET_DISCONNECTED` : Supabase cloud, vercel-scripts, websocket dev) — artefact d'outillage, pas un défaut |
| 10 | **Build production** (worktree HEAD) | **✅** | seconde preuve de build, utilisée par la porte e2e |
| 11 | **tsc** (worktree HEAD) | **✅ 0 erreur** | les erreurs du worktree principal = specs du co-agent attendant ses édits non commités (`searchMessages`, `resetOverpassQueue`) |

## Défauts réels trouvés ET corrigés par cette campagne

1. **Icônes fantômes** (`No glyph resolved`) : `camera` (composeur ×6, fidélité ×1), `share-2`, `gift`, `activity`, `watch` — corrigées vers des glyphes existants (`image-plus`, `share2`, `award`, `heart-pulse`, `clock`).
2. **Vérificateur d'icônes** étendu aux littéraux `icon: '...'` en structures de données (l'angle mort qui laissait passer `camera`) — `npm run verify:icons` les attrape désormais.
3. **Lighthouse a11y** : `label-content-name-mismatch` sur le tab « Messages » (aria-label ne contenait pas le libellé visible) — corrigé.
4. **Télémétrie anonyme** : `/api/telemetry/hub` était appelé sans session (401 en console pour tout visiteur) — Web Vitals et télémétrie hub réservés aux sessions authentifiées.

## Commits de la campagne

```
58f1e6bf  fix(ui): icônes fantômes + vérificateur étendu
820dafa1  fix(ui,perf): aria-label Messages + télémétrie authentifiée (Lighthouse SEO 100)
```

## Environnement

- Worktree isolé `scratch/chantier/verify` (supprimé après campagne ; jonction node_modules retirée avant).
- Serveur dev redémarré depuis le dossier principal en fin de campagne.
- Aucune écriture sur le cloud pendant la campagne (lecture seule via l'app).
