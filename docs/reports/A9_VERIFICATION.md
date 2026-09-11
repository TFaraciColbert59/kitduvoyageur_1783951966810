# A9 — Rapport de vérification final (Phase 9 + programme complet)

Date : 2026-09-11 · Branche : `chantier/adventure-intelligence` · Commit : `bb66bd69`
Statut : **RÉALISÉ** — validation DB sur copie et fusion restant à la décision humaine.

## 1. Livrables Phase 9

| Livrable | Chemin |
|---|---|
| Spec + plan | `docs/superpowers/specs/2026-09-11-a9-hardening-beta-production-design.md` |
| Backtesting + shadow | `domain/backtesting.ts` (MAE médiane, couverture P90, dérive par bucket), `domain/shadowMode.ts` (accord/désaccord, résumé) |
| Index de performance | `supabase/migrations/20260911190000_a9_performance_indexes.sql` (4 index justifiés, additifs, partiels) |
| Flags de domaine | `supabase/migrations/20260911200000_a9_domain_flags.sql` (8 flags, tous OFF) |
| Audit sécurité | `docs/reports/A9_SECURITY_AUDIT.md` (F1..F5) |
| Rollout / arrêt / rollback | `docs/reports/A9_ROLLOUT.md` |
| Gating réel | APIs Terrain Live (`terrain_live`), cron agrégation (`collective_intelligence`), contexte moteurs (`route_prediction_v2`, `performance_profile_v2`) |
| Rapport A7 manquant | `docs/reports/A7_VERIFICATION.md` (ajouté sur finding de revue finale) |

## 2. Preuves finales (worktree)

| Commande | Résultat |
|---|---|
| `npm run test` | ✅ **242 fichiers, 1786 tests, 0 échec** |
| `npm run type-check` | ✅ exit 0 |
| `npm run lint` | ✅ exit 0 |
| `npm run build` | ✅ exit 0 (artefacts icônes restaurés, non commités) |
| `npm run verify:invariants` | ✅ |
| `npm run verify:icons` | ✅ |
| Scan secrets | ✅ (finding F5 documenté : fallback anon key préexistant) |
| Revue finale de branche | NOT CLEAN → 2 Importants corrigés (`bb66bd69`) → vérifié ensuite (1786 tests) |

## 3. Programme complet — bilan par phase

| Phase | Livrable clé | Tag |
|---|---|---|
| 0 | État des lieux, ADR-AI-001..008, baseline (1521 tests de départ) | — |
| 1 | Domaine TS, 9 migrations RLS 4 niveaux, pgTAP 22 assertions | `a1-done` |
| 2 | Normalisation GPS, map-matching, passages idempotents | `a2-done` |
| 3 | Profil Terrain, fatigue sans santé, prédictions P50/P90, copilote | `a3-done` |
| 4 | Agrégation collective robuste, seuils ≥ 5, shadow-ready | `a4-done` |
| 5 | Terrain Live : cycle de vie, modération, APIs, UI mobile | `a5-done` |
| 6 | Orchestrateur, graphe, 3 candidats, versions, fallback IA | `a6-done` |
| 7 | Cockpit borné, recalcul anti-rebond, offline Dexie V2, UI | `a7-done` |
| 8 | Groupe, trek multi-jours, entitlements, affiliation transparente | `a8-done` |
| 9 | Backtesting, shadow, index, flags, audit, rollout | `a9-done` |

Bilan : **+265 tests domaine** (1521 → 1786), 16 migrations additives
(`20260911130000` → `20260911200000`), 8 suites pgTAP/RLS, 9 specs, 10 rapports.

## 4. Écarts d'activation assumés (à traiter avant généralisation)

1. **UI non montée** : A7 cockpit/section Hub et A8 groupe/trek sont livrés comme composants
   prêts à monter ; l'intégration dans les pages Hub existantes et les tests Playwright
   visuels/a11y restent à faire (décision de montage humain).
2. **ETA personnalisée inactive sur `/api/adventure/generate`** : aucun profil utilisateur ne
   transite encore par l'API ; `buildUserProfile` n'a pas d'appelant de production. Les moteurs
   retombent sur le standard 15 min/km (fallback sûr, conforme).
3. **Shadow runners absents** : les 4 flags `*_shadow` sont déclarés ; aucun job ne les exécute
   encore (conforme « shadow d'abord »).
4. **F1 sécurité préexistante** : policy `public_read_user_profiles` à vérifier/clore sur copie.
5. **Validation DB** : les 16 migrations A1-A9 et les 8 suites pgTAP n'ont pas été appliquées
   (aucune copie disponible) — commandes exactes dans `A9_ROLLOUT.md`.

## 5. Critères d'arrêt et rollback

Publiés dans `docs/reports/A9_ROLLOUT.md` : flags OFF (immédiat, sans déploiement), aucune
migration destructive, paliers 1 → 5 → 20 → 50 → 100 % avec 7 jours d'observation entre paliers.

## 6. Verdict

**Programme Adventure Intelligence livré de bout en bout sur la branche**, avec :
- sécurité et confidentialité tenues par construction et testées ;
- aucune donnée santé, aucun connecteur réel ;
- fallbacks sûrs et déterministes à chaque étage ;
- écarts d'activation listés ci-dessus (montage UI, wiring profil, shadow runners, DB copie).

Validation humaine requise avant généralisation (gate de sortie Phase 9).
