# RAPPORT COMPLET — Chantier « Lancement mondial du Kit du Voyageur »

**Rédigé le :** 2026-09-12
**Périmètre :** tout le travail réalisé depuis le début de la conversation (certification initale + chantier de lancement mondial)
**Dépôt :** `TFaraciColbert59/kitduvoyageur_1783951966810`
**Branches :** `main` = `audit/adventure-intelligence` = `2952f3b9` (au moment de la rédaction)
**Tag de certification :** `g0-certified-20260911` → commit `02afe6ee`
**Base de production :** projet Supabase `icxyvwzfjbflcbqukpfz` (eu-west-3) — **195/195 migrations appliquées, 0 en attente**
**Statut global :** développement et base de données de production **opérationnels** ; ouverture publique mondiale = **NO-GO tant que les verrous humains listés §12 ne sont pas levés**.

---

## 1. Contexte et point de départ

### 1.1 Ce qui existait avant le chantier (rappel du début de conversation)
- **Adventure Intelligence** livrée en code : plans/versions/prédictions, profils de performance, Terrain Live, offline, groupes/treks, entitlements, consentements, feature flags, rollout (travaux A1→A15).
- **Étape 0 certifiée** : harnais `scripts/db/install-from-baseline.ps1` (install + upgrade stricts, ledger, pgTAP, F1/EXPLAIN bloquants) ; suites pgTAP vertes sans quarantaine.
- **a13 S1→S9** : ETA réelle (map-matching), 3 plans comparables, groupes/entitlements, sources (eau/refuges/météo/réglementation), cockpit live, pack offline + sync idempotente, carte Terrain Live, backtesting, E2E local.
- **a14** : healthcheck/alertes, backup+restore chronométrés (RTO 3,8 s), export/suppression RGPD, audit sécurité (bbox bornée, HMAC fail-closed).
- **a15** : charge locale (p95 4–142 ms), rollout mesuré 1→100 %, budgets, `mobile:build`.
- **Premier déploiement production** : 41 migrations poussées (ledger 184), F1 fermé, données intactes (tag `prod-db-deployed-20260911`).

### 1.2 Corrections vérifiées au début de ce chantier
- HEAD réel = `1c570b50791925b3f75c565ce3bb0ba2bd77eba2` (et non `3ae4db51`) ; `main` = `audit/adventure-intelligence`.
- Checks du HEAD : `build` rouge = workflow dynamique **GitHub Pages/Jekyll** (pas `nextjs.yml`) ; `visual-tests` rouge = snapshots `-linux` absents (seuls des `-win32` étaient commités) + helper d'auth lisant `.env` (10 min de retries) ; `database-gates`/`visual-gates` = *skipped* (opt-in).
- Anomalies produit vérifiées une à une (6 VRAI, 2 PARTIEL) : AutoGen minimal, chaîne d'IDs non atomique (`selected_route_id` **absent du dépôt**), démos communauté codées en dur, carnet `public` par défaut (UI+API+DB), fusion localStorage↔serveur, repli `uniform_from_blueprint` non gardé, absence de matrice de couverture.
- Skills : le document de chantier référence les skills réellement présents dans `.agent/skills` (`ui-ux-designer`, `frontend-mobile-development-component-scaffold`, `wcag-audit-patterns`…) ; les skills UX (`ux-mobile`, `apple-ui-designer`, `interaction-design`) vivent dans `.agents/skills` et restent applicables (règle AGENTS.md).

---

## 2. Méthode appliquée

- **Preuves avant affirmations** : chaque phase produit `PHASE_N_VERIFICATION.md`, `PHASE_N_RESULTS.json`, `PHASE_N_ROLLBACK.md` ; `INSUFFICIENT_DATA` n'est jamais converti en `PASS`.
- **Aucun développement direct sur `main` après la Phase 0** : ruleset `main-protection` (PR obligatoire, 5 checks requis, résolution des conversations, force-push/suppression interdits, bypass admin en filet de secours uniquement).
- **Sous-agents spécialisés** par phase (DATABASE/BACKEND/FRONTEND/SECURITY), revue orchestratele + CI avant merge.
- **Zéro secret dans Git** : scan dédié, `.env*` ignorés, keystore et PAT stockés uniquement dans `%TEMP%` hors dépôt.
- **Free-only IA** : garde-fou `:free` sur OpenRouter, aucune dépense.

---

## 3. Phase 0 — Réparer et figer la base de livraison (PASS)

**Livrables :**
- Document directeur `docs/architecture/CHANTIER_LANCEMENT_MONDIAL.md` (13 phases, gates, ordre d'exécution, journal de preuve).
- **GitHub Pages désactivé** : `DELETE /repos/.../pages` → 204 ; le check rouge `build` a disparu des nouveaux SHA (production = Vercel).
- **Régression visuelle réparée**, en trois temps (chaque correctif prouvé par un run CI) :
  1. cause racine plateforme : snapshots `win32` vs CI Linux → **69 baselines `-linux` générées dans la CI elle-même** (mode `workflow_dispatch` + `update_snapshots`) ;
  2. flake « onglet actif » : transitions CSS capturées en plein vol → **freeze transitions/animations** à la capture ;
  3. flake « barre de filtres » : scrollbars overlay puis `backdrop-filter` → **scrollbars masquées** + **masque nommé** `data-visual-mask` sur la barre.
- **Sécurité dépendances** : `next` 15.5.18 → **15.5.25** (corrige un critique DoS/SSRF App Router), retrait de **`swapy` (GPL-3.0, aucun import)**, `npm audit fix` non-major. Audit prod : **1 critique → 0**, 13 → 5 vulnérabilités (restant : `postcss` high nécessitant next@16 majeur, documenté).
- **SBOM CycloneDX** (1,1 Mo), audits npm (prod/complet, avant/après), inventaire licences (MIT/ISC/Apache dominants ; points signalés : react-leaflet Hippocratic-2.1, sharp LGPL, caniuse-lite CC-BY).
- **Scan secrets : PASS** (aucun secret tracké, aucun JWT `service_role`, `.env.example` vide).
- **Protection de `main`** : ruleset `main-protection` (id 22982405) + correction d'`ios.yml` pour que `build-ios` se déclenche aussi sur les PR (PR #34).
- **Tag `g0-certified-20260911`** posé sur `02afe6ee` — CI 100 % verte (quality-gates, lighthouse, bundle-analysis, build-ios, visual-tests).

**Preuves locales :** type-check 0, lint 0, tests 2027 passed, invariants 0, build 0.

---

## 4. Phase 2 — Chaîne d'identifiants unifiée (PASS local)

**BDD (PR #36, SHA `03595239`) :**
- Migration `20260911500000_phase2_chain_integrity.sql` : `adventure_plans.selected_route_id bigint → hiking_routes`, `correlation_id uuid` sur 5 pivots, FK `community_posts.linked_carnet_id → carnets`, table `adventure_plan_route_selections` (une seule sélection active par plan), RPC `select_adventure_plan_route` (SECURITY DEFINER, propriétaire vérifié sous verrou, **géométrie navigable exigée**, propagation `trips.metadata.route_id`).
- 36 assertions pgTAP.

**Serveur (PR #37, SHA `c3ed27e5`) :**
- Migration `20260911510000` + RPC `attach_adventure_plan_to_trip` (double propriété, idempotente, refus de ré-affectation).
- Projection `TripExperience` (trip → plan → version → route → kit → session → carnet → publication + `correlation_id`), client session/RLS.
- Action Zod `selectAdventurePlanRoute` ; propagation `correlation_id` (génération, sessions, publication).
- Test d'intégration chaîne complète avec **échecs injectés** : 7/7 en local.

**Preuves :** pgTAP complet 262 PASS (57 nouvelles assertions) ; vitest 2042/0 échec.

---

## 5. Phase 3 — Création de voyage réelle bout-en-bout (PASS local)

**Principe :** fini le « voyage minimal » — AutoGen appelle une vraie commande.
- Migration `20260911520000` : `phase3_route_navigable(bigint)` (prédicat exact de la RPC de sélection) + `phase3_search_navigable_routes(...)` (recherche bornée, index GIST, ≤3 candidats).
- Commande `createTripFromAutogenIntent` : brief persisté (`trips.metadata.autogen`), recherche de parcours **réels**, 1–3 plans, attachement, sélection du parcours **uniquement si géométrie réelle**, kit/budget/checklist/documents, erreurs typées 400/401/403/409/429/500/503, idempotence `correlation_id`, compensation best-effort.
- **Gate navigation unique** (`hikingNavigation.ts`) : « Démarrer la randonnée » exige `routeNavigable`; le repli `uniform_from_blueprint` ne peut jamais activer la navigation ; câblé sur tous les points d'entrée réels (SortieMenu, NextActionCard, SortieMoment, HikingBlocks).
- E2E local : **2/2** (journey complet : connexion → phrase → propositions → sélection → voyage actif → route → kit → budget → documents).

**Preuves :** pgTAP 16 fichiers/292 PASS ; vitest 2063/0 échec.

---

## 6. Phase 7 — Carnet & communauté sans démonstrations (PASS)

- **Zéro donnée fictive** : posts/clubs/groupes/événements codés en dur supprimés ; événements branchés sur la vraie table `events` ; états vides sobres.
- **Zéro fusion silencieuse localStorage ↔ serveur** ; plus d'ids fantômes (`carnet-${Date.now()}`, `club-…`) ; erreurs d'insertion affichées.
- **Carnet privé par défaut** : `ALTER COLUMN visibility SET DEFAULT 'private'` + UI + API + complétion de voyage (opt-in explicite).
- **Liaison carnet ↔ session ↔ voyage** (`hike_sessions.trip_id` additive).
- **Snapshot de publication immuable** : `snapshot_payload/snapshot_at/snapshot_exclude_location` + trigger (copie figée sous RLS, champs sensibles retirés, retrait géo optionnel). **Gate prouvé 24/24** : modifier le carnet privé après publication n'expose rien ; UPDATE du post ne réécrit pas le snapshot ; suppression du carnet conserve le snapshot.
- Prépublication : consentement explicite + retrait des coordonnées.

**Preuves :** pgTAP 17/316 PASS ; vitest 2068/0 échec.

---

## 7. Phase 5 — Kit voyageur complet (PASS local)

- Migration `20260911540000` (additive, backfills avant `SET NOT NULL`) : `ownership` (perso/partagé/manquant), `owner_id`, `condition`, `reason` (raison vérifiable **persistée**), `priority`, `is_vital`.
- Engines purs : `kitCompletenessEngine`, `preTripSafetyRules` (contrôles sécurité pré-trip selon activité/pays, branchés sur l'existant).
- UI `TripKitView` : filtres perso/partagé/manquant, badges d'état, raisons affichées, modale d'édition complète.
- Documents attendus par pays/activité (checklist ; `trip_documents.file_url` NOT NULL respecté — pas de ligne sans fichier réel).
- Storage : bucket privé, chemins `<userId>/…`, **URL signées courtes (3600 s)** ; bug d'URL publique corrigé.

**Preuves :** pgTAP 18/340 PASS (24 nouvelles) ; vitest 2084/0 échec.

**Limites documentées :** agrégats anonymisés *kit* non branlés (INSUFFICIENT_DATA) ; pas de flux d'upload `trip_documents`.

---

## 8. Phase 6 — Cockpit terrain & hors-ligne (PASS local)

- **Rate limiting distribué** : abstraction `src/lib/rate-limit` (Upstash REST + repli mémoire + **fail-safe explicite** : fail-closed 503 sur routes sensibles, repli dégradé signalé ailleurs), 6 routes API migrées, 10 routes protégées au total avec la Phase 8.
- **Pack hors-ligne versionné** (refus des packs incompatibles) ; **conflits de sync champ par champ** ; **vault local WebCrypto** pour les brouillons sensibles.
- **Reroutage uniquement sur géométrie réelle** ; ETA avance/retard + consommation recalculées sur les fixes GPS réels.

**Preuves :** 41 nouveaux tests, vitest 2125/0 échec.

**Limites :** Upstash réel non provisionné (fetch mocké) ; détection auto départ/arrivée non automatisée ; tuiles commerciales et tests physiques = humain.

---

## 9. Phase 8 — Paiement, sécurité, vie privée (PASS code / INSUFFICIENT_DATA clés & juridique)

- **Revue RLS exhaustive** : 224 tables auditées (223 RLS ; `spatial_ref_sys` PostGIS sans privilèges clients). **7 trous réels corrigés** (`hike_sessions`, `carnet_moments`, `carnet_kit_items`, `groupe_messages`, `comment_reports`, `community_posts` UPDATE, `affiliate_*`) + DML révoqué sur 6 vues.
- **Anti-escalade verticale** : trigger interdisant la modification de `role`, `trust_score`, suspension, 2FA, email par l'utilisateur ; `is_admin()` SECURITY DEFINER.
- **Stripe sans clé** : idempotence par table `stripe_events`, signature `constructEvent` vérifiée, 5 flux testés (paiement, renouvellement, échec, remboursement, annulation) en mocks, entitlements **serveur uniquement** (anti-forge testé).
- **8 variables Stripe attendues** (noms documentés) ; fail-safe `configured:false` sans invention de prix.
- **Docs conformité** : 8 brouillons (`docs/compliance/`) marqués « À VALIDER PAR UN HUMAIN HABILITÉ » (rétention, DPA, AIPD, DPO, modération/appel, mentions par marché).

**Preuves :** pgTAP 19/380 PASS (40/40 accès horizontal/vertical) ; 30 tests Stripe.

**Dettes :** révocation d'entitlement à l'annulation/impayé non implémentée ; `loyalty_points/xp/level` modifiables par leur propriétaire (documenté).

---

## 10. Phase 10 — Observabilité & capacité (PASS code / INSUFFICIENT_DATA ops)

- Entrée **`x-correlation-id`** validée + propagation + écho ; logger JSON **sans PII** (redaction testée).
- **SLO as code** + CLI `ops:slo-check` : 4 `pass`, 5 `insufficient_data` (honnête).
- Budget IA pur (calcul depuis `ai_usage_daily`) ; specs de dashboards avec sources réelles ; profils de capacité locaux : **100 → p95 8,9 ms**, **1 000 → p95 28 ms**, **10 000 → INCONCLUSIVE assumé**.
- Healthcheck A14 revérifié : SAIN.

**Preuves :** 34 nouveaux tests ; vitest 2189/0 échec.

**Limites :** destinataire réel d'alertes, RUM, métriques prod, charge distante = humain/Phase 1.

---

## 11. Phase 4 — Couverture mondiale & POI (PASS structure / INSUFFICIENT_DATA données)

- **Modèle versionné** : `coverage_licenses`, `coverage_regions`, `coverage_datasets`, `coverage_dataset_events` ; garde-fous trigger : refus d'import sans licence active, refus du statut `covered` sans seuils atteints + 20 échantillons humains + ruptures sous contrôle ; **promotion/rollback de dataset** conservés.
- **Pipeline 11 étapes** `scripts/coverage/` exécutable en dry-run (contrôle licence → normalisation → validation GeoJSON/GPX → dédup → métriques → segments → POI → validation auto → échantillonnage → publication sous flag).
- **Séparation POI / offres / affiliation** : disponibilité et prix **horodatés + expiration**, flag `has_affiliate_link` exposé ; zéro prix inventé.
- **Matrice honnête** : `docs/coverage/COVERAGE_MATRIX.md` — **0 région `covered`**, flag de publication **désactivé**.

**Preuves :** pgTAP 20/438 PASS (58 nouvelles) ; 70 tests pipeline.

---

## 12. Phase 11 — Mobile natif (PASS build / INSUFFICIENT_DATA stores & terrain)

- JDK 17 + **JDK 21** (requis Capacitor 8) + Android SDK 36 installés localement (`%LOCALAPPDATA%\LKDV\tools\…`), licences acceptées.
- **AAB release signé produit et vérifié** : 146 405 405 octets (proche plafond Play 150 Mo — à alléger), SHA-256 `C01A9DB0D60DE1B3DF35D69D2A99383DA10BF8B5AA5563374AA604C0E398C5A5`, `jarsigner -verify` exit 0.
- **Signature sans secret versionné** : `keystore.properties.example` + `.gitignore` ; keystore réel dans `%TEMP%` (`lkdv-release.keystore` + `lkdv-keystore.txt` — **à sauvegarder dans un coffre, perte = impossibilité de mettre à jour l'app**).
- Docs `docs/mobile/ANDROID_RELEASE.md` + `STORES_CHECKLIST.md` (Play Console, iOS/Xcode, appareils, terrain).

---

## 13. Phase 8B — Durcissement RLS de production (PASS, déployé)

**Constat prod (mesuré) :** 18 tables avec policies `USING(true)`/`WITH CHECK(true)` **et** grants DML complets pour `authenticated` — tout compte connecté pouvait écrire `promo_codes` (réductions), `feature_flags` (activer des features), `affiliate_*` (commissions), `stock_movements` (inventaire), `ambassadors`, et lire/modifier des données perso potentielles (`loans`, `gear_history`, `gear_images`, `kit_items`).

**Correctif (migration `20260911570000_phase8b_permissive_policy_hardening.sql`) :**
- Catalogue public → SELECT conservé, **écriture service_role/admin** ; données perso → **propriétaire uniquement** (via `gear_items.user_id`) ; `feature_flags` → SELECT authenticated (client) + écriture admin ; `promo_codes` → SELECT ambassadeur/admin ; `stock_movements` → admin (INSERT policy `is_admin()`) ; `events` → organisateur/admin + RPC atomiques `join_event`/`leave_event`.
- **Grants ajustés** (REVOKE DML) + **garde-fou anti-policy permissive** dans la base.
- 56 assertions pgTAP ; code corrigé (`evenements/page.tsx` en RPC, insert mort `kit_items` retiré).

**Vérification post-déploiement prod :** ledger 195 ; **`write_all_policies` = 0** (aucune policy d'écriture `true` pour anon/authenticated) ; grants dangereux fermés ; données intactes.

---

## 14. Vague D — IA free-only (PASS)

- Garde-fou `assertFreeModel` : tout identifiant de modèle sans suffixe `:free` est refusé **avant l'appel réseau** (ProviderError 400), même si la configuration est modifiée par erreur. 4 tests. Aucune dépense possible.

---

## 15. Déploiement production Supabase (opérationnel)

| Contrôle | Résultat |
|---|---|
| Migrations | **195/195 appliquées, 0 en attente** (10 migrations Phases 2→4 poussées, puis Phase 8B) |
| Objets clés | `selected_route_id`, `hike_sessions.trip_id`, `snapshot_payload`, trigger snapshot, 5 tables (couverture, stripe_events, sélections), 7 RPC — présents |
| Défaut carnet | `'private'` |
| RLS | **0 table métier sans RLS** ; **0 policy d'écriture permissive** anon/authenticated |
| Données | intactes : 19 voyages, 62 comptes, 20 sessions, 35 carnets, 20 publications |
| Couverture | 0 région déclarée couverte, flag publication OFF (honnête) |
| Stripe | 0 événement traité, `configured:false` (clés humaines) |
| Flags | 13 flags, 1 actif (`hub_all_enabled`) — aucun palier de rollout activé |

---

## 16. Récapitulatif Git / CI

- **15 PR protégées mergées** : #34 (ios PR trigger), #35 (garde-fou free), #36–#38 (Phase 2), #39 (Phase 3), #40 (Phase 7), #41 (Phase 5), #42 (Phase 6), #43 (Phase 8), #44 (Phase 10), #45 (Phase 4), #46 (Phase 11), #47 (point d'étape), #48 (Phase 8B).
- Chaque PR : **5 checks requis verts** (`quality-gates` ×2, `lighthouse`, `bundle-analysis`, `build-ios`, `visual-tests`).
- Correction notable : `build-ios` ne se déclenchait jamais sur PR (workflow sans trigger) — corrigé via PR #34 pour que la gate soit réelle.
- Snapshots visuels Linux stabilisés (transitions figées, scrollbars masquées, masque nommé de la barre de filtres).

## 17. Preuves globales (dernier état)

| Preuve | Résultat |
|---|---|
| `npm run test` | **2 259 tests passés / 27 skippés — 0 échec** (318 fichiers) |
| pgTAP (base locale) | **21 fichiers / 494 tests — PASS** |
| `type-check` / `lint` / `verify:invariants` | exit 0 / exit 0 / exit 0 |
| SBOM + audits | `docs/reports/sbom-cyclonedx-20260911.json`, `npm-audit-*.json` |
| Scan secrets | PASS (`docs/reports/PHASE_0_SECRET_SCAN.md`) |
| Prod | 195 migrations, RLS durcie vérifiée, données intactes |

## 18. Verrous humains restants (aucun ne peut être levé par un agent)

1. **PAT Supabase complet** (scope `projects:write`) → Phase 1 : projet de test isolé, certification BDD distante, `database-gates`, E2E distants.
2. **Stripe** : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, 6 `STRIPE_PRICE_*` → monétisation réelle.
3. **Upstash** : `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` → rate limiting distribué réel.
4. **Tuiles commerciales** : contrat fournisseur.
5. **Stores** : compte Play Console (upload AAB prêt), compte Apple + Mac/Xcode (iOS impossible ici).
6. **Appareils & terrain** : 5 profils d'appareils, batterie/réseau instable, **30 paires ETA/réel**, calibration.
7. **Juridique** : validation des brouillons `docs/compliance/` (DPO, AIPD, DPA, mentions par marché).
8. **Phase 12** : décision humaine à chaque palier de rollout (interne → 1 → 5 → 20 → 50 → 100 %).

## 19. Dettes documentées (reprises futures)

- Révocation d'entitlement Stripe à l'annulation/impayé (Phase 8).
- Détection automatique départ/arrivée de session (Phase 6).
- Charge 10 000 concurrents réelle + certification distante (Phase 1).
- Allègement de l'AAB (139,6 Mo — limite Play 150 Mo).
- Migration Next 16 (corrige `postcss` high restant).
- localStorage legacy éventuel hors périmètre communaute/carnets.

## 20. Où retrouver les preuves

- Phase 0→11 : `docs/reports/PHASE_<N>_{VERIFICATION.md,RESULTS.json,ROLLBACK.md}`
- Durcissement prod : `docs/reports/PHASE_8B_HARDENING.md`
- Point d'étape : `docs/reports/CHANTIER_PROGRESS.md`
- Doctrine : `docs/architecture/CHANTIER_LANCEMENT_MONDIAL.md`
- Conformité : `docs/compliance/`
- Mobile : `docs/mobile/`
- Couverture : `docs/coverage/COVERAGE_MATRIX.md`
- Observabilité : `docs/observability/`

## 21. Conclusion

Le chantier « Lancement mondial » est **exécuté jusqu'à la limite de ce qui est réalisable sans humain** : plateforme de livraison certifiée (Phase 0, tag `g0-certified-20260911`), chaîne produit complète (création → plan → route réelle → kit → session → carnet → publication snapshotée), communauté assainie, sécurité durcie (y compris en production), observabilité et garde-fous en place, build Android signé prêt. **La base Supabase de production est à jour (195 migrations), durcie et vérifiée.**

Le chemin restant vers l'ouverture mondiale ne dépend plus de code : il dépend des **verrous humains** (§18) — credentials marchands, comptes stores, tests terrain et validation juridique — puis du **rollout progressif** (Phase 12) sous autorité humaine.
