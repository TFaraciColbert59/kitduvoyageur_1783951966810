# RELEASE_PLAN.md — plan de mise en production (à autoriser, 2026-10-09)

Règle : rien ci-dessous n'a été exécuté en production. Chaque action a un propriétaire et une
précondition. Distinguer « prêt en local » de « autorisé à déployer ».

## 0. Artefact prêt pour revue

- Branche `security/fixes-wave1` (9 commits, base `14d80de8`) : diff reviewable, tests avant/après,
  suite complète sans régression (6939 tests verts, 8 échecs préexistants documentés).
- Worktrees jetables `%TEMP%\opencode\lkdv-baseline` (preuves rouges) et `lkdv-fixes` (correctifs).

## 1. Bloquants avant tout déploiement (par ordre)

| # | Action | Précondition / décision | Risque si non fait |
| --- | --- | --- | --- |
| B1 | F-008 : dry-run `SELECT id,email FROM auth.users WHERE email = ANY(...)` puis appliquer `20261009120000_invalidate_seed_credentials.sql` + **révoquer les sessions** des comptes fermés | **FAIT en production via API admin** (18 comptes fermés + bannis vérifiés) ; la migration corrigée reste en ceinture-bretelles ; **matérialisation prod des correctifs F-012 via la NOUVELLE migration `20261010130000`** (ledger version-only) — vérifier `PROD_DB_URL` si disponible | comptes de démo connectables |
| B2 | Déployer F-003 (notifications Bearer) **et** configurer le déclencheur réel (cron externe ou webhook DB) avec `Authorization: Bearer ${CRON_SECRET}` | code prêt + **preuve dynamique locale OK** (401/401/pass, evidence) ; reste l'action plateforme : créer le cron (Vercel cron ou pg_cron+pg_net avec secret en Vault) | jobs cassés OU jobs ouverts |
| B3 | Capacitor : monter `@capacitor/android` et `@capacitor/ios` vers la version corrigée (avis critical « remote content at app origin via HTTP proxy ») + `npx cap sync` + tests device | **FAIT** : 8.5.3 installé + cap sync + build 0 (device tests restants côté release mobile) | critique dans le binaire distribué |
| B4 | Patches dépendances : `next` 15.5.27, `sharp`, `source-map-js`, `@modelcontextprotocol/sdk` ; évaluer `brace-expansion` (transitif) | **FAIT** : audit prod 0 critical (reste 6 high build-time tailwind + 3 moderate → H-035) | avis high exploitables (DoS/build) |
| B5 | Décision produit F-006 : bucket `group-media` privé + URLs signées (ou policy par appartenance) | **phase 1 FAIT** (policies d'appartenance) ; phase 2 (privé + signed URLs + migration des URLs historiques) = D7 (fiche prête) | pièces jointes de groupes publiques par URL |
| B6 | Décision F-010 résiduel : allowlist de destinations og-preview ou acceptation + auth/rate-limit | en attente décision D5 | SSRF via DNS/nip.io |
| B7 | F-001 : décider la politique cookies (`SameSite=None` vs Capacitor) + vérifier les mutations sans origin-check | **code FAIT** : garde CSRF middleware /api (403 hors origine, webhooks intacts, 13 tests) ; SameSite=None conservé pour Capacitor (décision D4/D5 sheets) | CSRF si SameSite=None conservé sans garde |
| B8 | Activer les portes CI DB/E2E (`LKDV_DB_TESTS_ENABLED`, `LKDV_E2E_ENABLED`) et remplacer les tests « RLS » miroirs TS par des tests Data API réels | **code FAIT** : Gate DB.3 + runner 14/14 (commit 9e4f1730) ; activation = variables GitHub (humain) | fausse confiance RLS |
| B9 | Réparer ou requalifier les 8 tests rouges préexistants (registre IA, contraste, n7, date, narration) | **FAIT** : causes racines corrigées, suite complète **6946 verts / 0 échec** | Gate 3 CI rouge |
| B10 | CSP : plan de durcissement (nonce, retrait `unsafe-eval`) puis passage bloquant | **plan FAIT** : CSP_HARDENING_PLAN.md (3 étapes + matrice compat + rollback) ; exécution = décision produit | XSS non bloquée |

## 2. Ordre de déploiement recommandé

1. Migration DB F-008 (B1) — additive, sans dépendance au code.
2. Code F-003 + configuration du déclencheur (B2) — même fenêtre.
3. Patches dépendances (B3/B4) — lot séparé, régression build + device.
4. Durcissements produit (B5/B6/B7) — selon décisions.

## 3. Après déploiement

- Vérifier : notifications rejetées sans secret (401), comptes seedés non connectables, previews
  légitimes OK, aucun 5xx nouveau (logs).
- Activer la surveillance : erreurs, saturation rate-limit, jobs cron (stalled/partial).
- Consigner RPO/RTO réels et planifier le test de restauration trimestriel.
