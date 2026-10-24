# Inventaire des branches GitHub — 24 octobre 2026

Établi par comparaison de chaque branche distante avec `main` (ancêtre, PR fusionnée à tête identique, `git cherry`).
Rien n'a été supprimé : la suppression d'une branche distante est refusée à la session qui a produit ce document ;
le script `scripts/ops/clean-branches.sh` fait le travail (à lancer par quelqu'un qui a le droit de supprimer des branches).

## 1. Suppression sûre (62 branches)
Ancêtres de `main`, ou branches dont la tête est exactement celle d'une PR fusionnée (le code est dans `main`, et la PR garde sa référence `refs/pull/N/head`).

| branche | dernier commit | classe (A ancêtre / B PR fusionnée) | PR |
|---|---|---|---|
| `chantier/kit-simulation-socle` | 2026-10-18 | A |  |
| `claude/geo-center-fix` | 2026-10-18 | B | #114 |
| `claude/geo-import-workflow` | 2026-10-18 | B | #109 |
| `claude/geo-overpass-busy` | 2026-10-18 | B | #110 |
| `claude/workflows-node24` | 2026-10-18 | B | #111 |
| `deploy/compte-v8-prod` | 2026-10-17 | A |  |
| `feature/ios-community-native-create-sheet-v2` | 2026-10-16 | A |  |
| `feature/ios-files-import-export` | 2026-10-16 | B | #107 |
| `feature/community-instagram-inspired-v1` | 2026-10-15 | A |  |
| `feature/community-instagram-inspired-v1-fix-conflicts` | 2026-10-15 | A |  |
| `feature/ios-native-ui-bridge-p0` | 2026-10-15 | B | #105 |
| `fix/community-story-highlight-privacy-20261015` | 2026-10-15 | A |  |
| `fix/ios-native-choices-accessibility` | 2026-10-15 | A |  |
| `feat/stories-v2` | 2026-10-14 | A |  |
| `feat/stories-v2-tests` | 2026-10-14 | A |  |
| `feat/stories-v2-ux` | 2026-10-14 | A |  |
| `feature/ios-native-glass-account-tabbar` | 2026-10-14 | A |  |
| `fix/stories-media-logging` | 2026-10-14 | A |  |
| `chantier/phase1-incr2-demo` | 2026-10-10 | A |  |
| `chantier/phase1-incr3-producers` | 2026-10-10 | A |  |
| `chantier/phase1-incr4-reconcile` | 2026-10-10 | A |  |
| `chantier/phase1-incr5-6` | 2026-10-10 | A |  |
| `chantier/phase1-incr6-ci-green` | 2026-10-10 | A |  |
| `chantier/progression-v2-p0-contracts` | 2026-10-10 | A |  |
| `phase1-live` | 2026-10-10 | A |  |
| `claude/fix-main-tests` | 2026-10-08 | B | #73 |
| `chantier/admin-os-control-plane` | 2026-10-06 | A |  |
| `codex/marketplace-completion` | 2026-10-04 | B | #65 |
| `codex/unified-inventory` | 2026-10-04 | B | #64 |
| `feat/compas-preparateur` | 2026-10-01 | A |  |
| `docs/chantier-progress` | 2026-09-12 | B | #47 |
| `docs/phase2-reports` | 2026-09-12 | B | #38 |
| `docs/rapport-complet` | 2026-09-12 | B | #49 |
| `feat/free-only-guard` | 2026-09-12 | B | #35 |
| `feat/phase10-observability` | 2026-09-12 | B | #44 |
| `feat/phase11-mobile-build` | 2026-09-12 | B | #46 |
| `feat/phase2-chain-integrity` | 2026-09-12 | B | #36 |
| `feat/phase2-server-chain` | 2026-09-12 | B | #37 |
| `feat/phase3-autogen-chain` | 2026-09-12 | B | #39 |
| `feat/phase4-coverage` | 2026-09-12 | B | #45 |
| `feat/phase5-kit-complet` | 2026-09-12 | B | #41 |
| `feat/phase6-cockpit-offline` | 2026-09-12 | B | #42 |
| `feat/phase7-community-privacy` | 2026-09-12 | B | #40 |
| `feat/phase8-security-payments` | 2026-09-12 | B | #43 |
| `feat/phase8b-policy-hardening` | 2026-09-12 | B | #48 |
| `chantier/x-design-unique` | 2026-09-08 | B | #31 |
| `chantier/y-audit-fixes` | 2026-09-08 | B | #33 |
| `chantier/y-hub-voyage` | 2026-09-08 | B | #32 |
| `release/voyage-v1` | 2026-09-07 | B | #29 |
| `agent-with-le-kit-du-voyageur-message-0040` | 2026-08-26 | B | #26 |
| `vercel/install-vercel-speed-insights-nyzscw` | 2026-08-26 | B | #27 |
| `feat/materiel-rebuild-liquid-glass` | 2026-08-23 | B | #25 |
| `feat/mon-materiel-cockpit-dashboard-final` | 2026-08-18 | B | #23 |
| `refonte-cockpit-liquid-glass-mon-materiel` | 2026-08-18 | B | #22,21 |
| `agent-declaration-in-srcapplayouttsx-939b` | 2026-08-17 | B | #19 |
| `agent-in-suspense-for-nextjs-fda3` | 2026-08-17 | B | #18 |
| `agent-nextjs-font-fetching-issue-9dd8` | 2026-08-17 | B | #20 |
| `fix/ci-workflow-path` | 2026-08-08 | B | #16 |
| `fix/remove-build-bypass-flags` | 2026-08-06 | B | #14 |
| `ci/quality-gates-v2` | 2026-08-04 | B | #13 |
| `fix/country-cache-validation` | 2026-08-02 | B | #10 |
| `fix/norway-temp-clean` | 2026-08-01 | B | #9 |

## 2. À supprimer APRÈS la fusion de la PR #108 (9 branches)
Leur contenu est repris par la version consolidée (écran v5 du Compas, passage des 50 demandes, clubs de Tony).

| branche | dernier commit | commits d'avance | PR |
|---|---|---|---|
| `claude/clubs-refonte-liquid-glass` | 2026-10-24 | +1 |  |
| `claude/compas-p1-referentiel` | 2026-10-23 | +49 | #115 |
| `claude/optimistic-albattani-i06ge7` | 2026-10-23 | +19 | #92,91,90,88,87,86,84,83,82,81,80,79,78,77,76,75,74,72 |
| `v5-carte` | 2026-10-23 | +23 |  |
| `v5-nous-budget` | 2026-10-23 | +29 |  |
| `v5-sac-prevoir` | 2026-10-23 | +21 |  |
| `v5-serveur` | 2026-10-22 | +23 |  |
| `claude/wizardly-pasteur-8por4e` | 2026-10-14 | +133 | #70,69,68,67,66,63,62,61,60,59,58,57,56,55,54,53 |
| `claude/pr88-parallel-batches-lzhet2` | 2026-10-13 | +32 | #93 |

## 3. Anciennes branches (avant le 1er octobre) : archiver en étiquette puis supprimer (61 branches)
Chantiers de juillet à septembre (u1…z9, c1…c8, phases 2 à 11, matériel, etc.). Leur historique n'est pas dans `main` sous les mêmes empreintes
(l'historique de `main` a été réécrit), donc on ne peut pas prouver commit par commit qu'elles sont reprises : le script crée d'abord une étiquette
`archive/<nom>` (réversible : `git branch <nom> archive/<nom>`), puis supprime la branche.

| branche | dernier commit | commits d'avance | PR |
|---|---|---|---|
| `chantier/2routes-closure` | 2026-09-27 | +1414 | #51(closed) |
| `chantier/2routes-p7-routing` | 2026-09-27 | +1425 |  |
| `design/ios27-full-glass` | 2026-09-26 | +1402 | #50 |
| `feat/mobile-direction-progression` | 2026-09-20 | +1304 |  |
| `chantier/zero-defaut` | 2026-09-17 | +1266 |  |
| `audit/adventure-intelligence` | 2026-09-12 | +1052 |  |
| `chantier/etape2-hub-unique` | 2026-09-10 | +886 |  |
| `chantier/h-hub-voyageur` | 2026-09-09 | +852 |  |
| `chantier/z-materiel-hub` | 2026-09-08 | +824 |  |
| `resolve/merge-main` | 2026-09-08 | +813 |  |
| `chantier/u1-corrections-fonctionnelles` | 2026-09-07 | +691 |  |
| `chantier/u10-qualite-service` | 2026-09-07 | +706 |  |
| `chantier/u11-matrice-tests-preuves` | 2026-09-07 | +708 |  |
| `chantier/u12-cloture-documentation` | 2026-09-07 | +711 |  |
| `chantier/u13-b-model-blueprints` | 2026-09-07 | +714 |  |
| `chantier/u13-c-solver-pipeline` | 2026-09-07 | +716 |  |
| `chantier/u13-d-ui-three-gestures` | 2026-09-07 | +718 |  |
| `chantier/u13-e-safety-connectors` | 2026-09-07 | +720 |  |
| `chantier/u13-f-golden-validation` | 2026-09-07 | +722 |  |
| `chantier/u2-design-system-shell` | 2026-09-07 | +693 |  |
| `chantier/u3-modele-donnees-rls` | 2026-09-07 | +694 |  |
| `chantier/u4-refonte-equipages` | 2026-09-07 | +695 |  |
| `chantier/u5-architecture-temporelle` | 2026-09-07 | +696 |  |
| `chantier/u6-contexte-actif-interconnexions` | 2026-09-07 | +698 |  |
| `chantier/u7-bus-evenements` | 2026-09-07 | +700 |  |
| `chantier/u8-fonctionnalites-cles` | 2026-09-07 | +702 |  |
| `chantier/u9-ethique-legal-securite` | 2026-09-07 | +704 |  |
| `chantier/z1-securite` | 2026-09-07 | +726 |  |
| `chantier/z2-donnees-verite` | 2026-09-07 | +728 |  |
| `chantier/z3-coherence-chiffres` | 2026-09-07 | +729 |  |
| `chantier/z4-honnetete-conseil` | 2026-09-07 | +730 |  |
| `chantier/z5-finition` | 2026-09-07 | +731 |  |
| `chantier/z6-tests-verite` | 2026-09-07 | +732 |  |
| `chantier/z8-rectificatif` | 2026-09-07 | +733 |  |
| `chantier/z9-rapports` | 2026-09-07 | +735 |  |
| `feat/c2-trip-wizard` | 2026-09-05 | +671 |  |
| `feat/c3-itinerary-planner` | 2026-09-05 | +673 |  |
| `feat/c4-community-places` | 2026-09-05 | +675 |  |
| `feat/c5-affiliation` | 2026-09-05 | +677 |  |
| `feat/c6-ai-kit` | 2026-09-05 | +678 |  |
| `feat/c7-collab-offline` | 2026-09-05 | +680 |  |
| `feat/c8-trip-completion` | 2026-09-05 | +682 |  |
| `feat/c1-trips-core` | 2026-09-04 | +668 |  |
| `feat/lignees-kits` | 2026-09-04 | +638 |  |
| `feat/orientation-empreinte` | 2026-09-04 | +660 |  |
| `feat/nemotron-ai-router` | 2026-09-03 | +632 |  |
| `fix/ci-deps` | 2026-08-26 | +434 |  |
| `vercel/install-vercel-web-analytics-i-g3ot8d` | 2026-08-26 | +442 | #28(closed) |
| `feat/mon-materiel-clean-rebuild-v3` | 2026-08-20 | +376 |  |
| `docs/reset-inventaire-boutique-mon-materiel` | 2026-08-19 | +353 |  |
| `feat/mon-materiel-smart-cockpit-final` | 2026-08-19 | +346 |  |
| `feat/cockpit-materiel-randonnees-kits-complet` | 2026-08-18 | +335 |  |
| `feat/mon-materiel-smart-cockpit` | 2026-08-18 | +339 |  |
| `feat/mon-materiel-smart-cockpit-v2` | 2026-08-18 | +339 |  |
| `agents/greeting-bot-integration` | 2026-08-11 | +295 |  |
| `rocket-update` | 2026-08-11 | +349 | #2,1 |
| `fix/ci-workflow-correct-path` | 2026-08-07 | +236 |  |
| `ci/move-workflow-to-actions-dir` | 2026-08-06 | +234 |  |
| `ci/quality-gates` | 2026-08-04 | +235 | #12(closed) |
| `fix/norway-november-temp-bug` | 2026-07-30 | +214 | #7(closed) |
| `frontend-redesign` | 2026-07-30 | +214 | #5,4 |

## 4. À garder / décision de Tony (12 branches)
Travail récent non repris dans `main` : chantier iOS natif, POC pays, phase 1 points, explorer mobile, outils.

| branche | dernier commit | commits d'avance | PR |
|---|---|---|---|
| `agent/hermes-autonomy-bootstrap` | 2026-10-18 | +27 | #112(open) |
| `feature/ios-native-liquid-glass-tabbar` | 2026-10-17 | +2 |  |
| `claude/add-maestro-mcp` | 2026-10-16 | +2 |  |
| `feature/ios-community-glass-toolbar` | 2026-10-16 | +11 |  |
| `feature/ios-native-community-create-actions` | 2026-10-16 | +1 |  |
| `fix/ios-native-nav-auth-modal-mobile` | 2026-10-15 | +1 |  |
| `refactor/mobile-interface-cleanup-except-compas` | 2026-10-15 | +9 | #104(open) |
| `feat/stories-v2-suite` | 2026-10-14 | +4 | #98(closed) |
| `chantier/phase1-points` | 2026-10-10 | +59 |  |
| `security/fixes-wave1` | 2026-10-10 | +17 | #85(open) |
| `poc/pays-minichat` | 2026-10-04 | +22 |  |
| `feat/explorer-mobile-osm` | 2026-10-03 | +9 |  |

