# SDD ledger — plan: docs/superpowers/plans/a1-domain-database-security.md

Spec: docs/superpowers/specs/2026-09-11-a1-domain-database-security-design.md (read)
Preflight scan: TS tasks (1-4,7) share only planned barrel files (schemas/index.ts, index.ts) in creation order — no conflict. Task 5 migrations committed before TS tasks (disjoint files). Task 6 pgTAP depends only on migration table/function names (Task 5). Task 7 depends on Task 3 schema names. Scan clean.

Task 5: complete (commits 7b50f72f..7b99ccb5, migrations controller-authored; 18 CREATE TABLE = 18 ENABLE RLS, SECURITY DEFINER avec search_path, diff --check OK)
Ruling: supabase db push/test db ne peut pas s'exécuter localement (aucune base) — gate manuelle sur copie documentée dans le plan et a0. Coût si faux : défauts SQL détectés uniquement à la validation sur copie.
Task 1-4,7: implementer DONE (27e982c6..201b2d7d, 46/46 tests, type-check 0)
Task 1-4,7: revue independante — Spec ✅ 5/5, 1 Important (requiresConfirmation default) + 4 Minor
Task 1-4,7: fix round 1/5 (1 adressé, 0 ouvert; commit 4374a5af; 46/46 tests, type-check 0)
Task 1-4,7: minor (deferred): mapping DB↔TS (ascentSpeedMPerHour/ascent_speed_m_per_h, effortScore/predicted_effort) — mapper en Phase 3
Task 1-4,7: minor (deferred): z.string().url() déprécié Zod 4 — cohérence repo
Task 1-4,7: complete (commits 27e982c6..4374a5af, review clean après 1 round)

Task 6: complete (commit eced2ebe, pgTAP 22 assertions; concern grants resolu par M9 13434b91)
Task 8: complete (5a1f07ac, tag a1-done; gates lint/type-check/1567 tests/build/invariants OK)
--- Phase 2 (plan a2-gps-segmentation-map-matching.md) ---
Task 1-5: complete (b0d66613..dde5b9d3, 32 tests A2, 1599 total)
Task 1-5: fix round 1/5 (1 adresse: liaison observations-passages; commit f3fb79d7; 78/78)
Task 1-5: minor (deferred): horodatage GeoJSON synthetique 10 s; pondérations qualite non normées; exposition/isolement null jusqu'en Phase 4
Ruling: passage_id obligatoire — change le contrat upsertPassages en retour d'ids; cout si faux: relance du fix uniquement.

--- Phase 3 (plan a3-personal-profile-prediction.md) ---
Task 1-4: implementer DONE (b01d6120..8c955bab, 36 tests A3; 114 domaine)
Task 1-4: revue independante — Spec ✅ 4/4, 1 Important (idempotence versions) + 2 Minor
Task 1-4: fix round 1/5 (Important + 1 Minor adresses; commit 4bb477be; 115 domaine, 1636 total)
Ruling: adapter ProfilBuildClient a câbler en Phase 6/7 — le contrat est documente; cout si faux: adaptation locale du seul adaptateur.
Task 1-4: complete (commits b01d6120..4bb477be, review clean apres 1 round)
Flaky note: 1 echec reseau Overpass observe puis non reproduit (1636/1636).

--- Phase 4 (plan: spec a4 combinee) ---
Task 1-5: complete (6f48bbd9..796b666c, 21 tests A4, 1657 total)
Revue: Approved, 0 Critical/Important
Minors (deferred): gate anciennete a l'ecriture; now injecte; bucket 'day' non emis; facade premier groupe; policy_version le plus recent
Ruling: seuils de publication appliques moteur + serveur — cout si faux: ajustement local d'un filtre.
Task 1-5: complete (review clean, 0 parked load-bearing)

--- Phase 5 (plan: spec a5 combinee) ---
Task 1-4 (logique+serveur): implementer DONE (4fcc3e56..4df7f9ee)
Task 5 (UI): implementer interrompu 2x, UI ecrite par controller (ca77fcb9); garde-fou U-D62 corrige
Revue: Rejected narrow (2 Important: cooldown confirmation, corroboration fusion) -> fix 76030f4f verifie (1701 tests)
Minors (deferred): RPC anon no-op, haptics/vaul absents, auto-detection non branchee (shadow OFF), spec A4 commitee tardivement
Task 5: complete (review clean apres 1 round)

--- Phase 6 (plan: spec a6 combinee) ---
Task 1-5: implementer DONE (ffa1e094..8c37cecc, 32 tests A6, 1737 total)
Revue: Approved, 0 Critical/Important; 6 Minors deferred (ordre registre, warnings plan, get partiel silencieux, started_at, zod details, askAI non cable)
Task 1-5: complete (review clean, minores parques avec rulings implicites documentes dans A6_VERIFICATION)

--- Phase 7 ---
Task 1-3: implementer DONE (d8c1a5cc..8832ea0b, 233 tests) ; revue Approved 4 minors ; fix a11y 97e5ddcc ; tag a7-done
--- Phase 8 ---
Task 1-4: implementer DONE (a0eb31da..e4cbf6fe, 21 tests A8, 1775 total)
Revue: Approved, 0 Critical/Important (2 minors: commentaire entitlements corrige 42145d45; semantique totalDriftRisk differee)
Task 1-4: complete (review clean)

--- Phase 9 ---
Task 1: implementer DONE (1b1cfd99, 9 tests A9, 1784 total)
Task 2-3: controller (migrations 190000/200000, audit securite F1-F5, rollout) commit 14261887
Revue finale branche: NOT CLEAN (A7 report absent; flags non consommes) -> fix bb66bd69 (gating terrain_live/collective_intelligence, server-only adaptateurs, rapport A7, doc rollout) ; 242 fichiers/1786 tests
Rulings finaux: UI A7/A8 non montee (composants prets) ; profil non transmis a generate (fallback standard) ; shadow runners absents ; F1 verif copie ; validation DB manuelle
Task 1-3: complete ; tag a9-done
