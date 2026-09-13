# TRIBU — Rapport lot 1 (Phases 0→6)

Date : 2026-09-13 · Branche : `chantier/tribu` · Déploiement DB prod : **appliqué** (12 migrations `20260913*`)

## Livré

### Phase 0 — Sécurité (débloque tout le reste)
- Capacités (`group_capability` dont `contribute`), matrice 40 lignes, overrides par membre, `group_member_has_capability` (override > délégation > rôle).
- **Toutes les escalades fermées** : 5 `*_member_all` + 7 lectures publiques prod-only supprimées, fuite `invitations_public_read_by_token` fermée, auto-promotion de rôle bloquée (trigger), join forcé `role='member'`, votes par appartenance et self-only, `search_path` durci.
- **Bootstrap organizer** par trigger DB (plus de groupe orphelin, plus d'insert app fragile).
- Preuves : `tribu_permissions.test.sql` **70/70**, harnais `install`+`upgrade` certifié, double revue `database-reviewer` (GO après correctifs). Voir `docs/tribu/phase0-preuve.md`.

### Phase 1 — Pont Club ↔ Hub (TRIBU-R1)
- `parent_club_id` + `is_club_member` + visibilité `club_only` (RLS prouvée).
- Onglet « Groupes » club (desktop `ClubVerticalTabs` + mobile `BottomTabBar`/`MobileClubDetailView`) : cartes qui **posent le cookie d'aventure et naviguent vers `/hub/groupe`** ; création `createGroupFromClub` (action) ; badge « Né du club X » desktop/mobile.
- Garde anti-injection : un groupe `club_only` exige d'être membre du club (RLS, pas seulement l'app).

### Phase 2 — Groupe éclair (TRIBU-R5/R6)
- Colonnes `is_ephemeral`/`auto_dissolve_at` + index partiel ; cron `cleanup-ephemeral-groups` (filtre re-vérifié à la suppression, anti-TOCTOU).
- CTA Explorer « Sortie entre amis » (desktop + mobile au-dessus du carrousel) + sheet de sélection (co-membres ∪ `user_follows` ∪ recherche) ; badge « Sortie du jour » + compte à rebours + conversion en groupe complet ; invitations compensées (suppression si échec).

### Phase 3 — Délégations temporaires
- Table + RLS (rangs de rôle, cible active, fenêtre ≤ 7 jours) ; **additives uniquement** (revue finale : bug soustractif corrigé et couvert par pgTAP) ; UI « Déléguer mon rôle » + « Reprendre » dans `VoyageursCard`.

### Phase 4 — Sondages à quorum
- `poll_type`/`quorum_threshold` + contraintes ; résolution **à la lecture** (`src/lib/queries/pollResolution.ts`, 6 tests) ; consommation `getGroupeComplet` + badge UI + toggle « Décision importante ».

### Phase 5 — Journal d'activité
- Table + 6 triggers AFTER (expenses/tasks/kit/polls/album/members), lecture membres, **aucune écriture applicative** ; panneau « Journal » desktop + mobile.

### Phase 6 — Modèles de checklist
- Tables templates/items + RLS (membres du club, officiel service) ; publication depuis l'onglet Groupes du club ; panneau « Modèles de checklist du club » appliqué en masse dans les tâches du groupe.

## Gates finaux (avant merge)

```text
npx tsc --noEmit                    → 0
npm run lint                        → 0 erreur (warnings préexistants)
npx vitest run                      → 2708 passed | 23 skipped ; 4 suites en échec = préexistantes
npm run build                       → ✓
harnais DB install + upgrade        → SUCCÈS (218 versions, pgTAP PASS, F1, EXPLAIN 18 ms)
pgTAP TRIBU (7 suites, 135 assertions) → toutes vertes
e2e prod preparer/depart/atlas      → 7/7
garde design H-D85                  → 14/14
migrations prod `db push --linked`  → 12 appliquées + vérif service-role (colonnes, tables, RPC, matrice 40)
```

## Revues

- `database-reviewer` Phase 0 : 1 critique + 4 importants → tous fermés (contre-revue GO).
- `database-reviewer` final M4-M11 : critique C1 (délégations soustractives) + I1 (injection club), I2 (items supprimables par un pair), I3 (fuite templates orphelins) → **tous corrigés et couverts** (tests 14-18 délégations, 12-13 templates, garde insert club) ; mineurs traités : revoke anon `is_club_member`, fenêtre délégation max, anti-TOCTOU cron, compensations d'écritures partielles.

## Écarts / dette assumée (transparence)

- E2E dédiés « pont club » et « modèles » non écrits dans ce lot (couverture unitaire + pgTAP + vérification prod) — ajoutés au backlog lot 2 avant Phase 7.
- `group_messages` non journalisé (choix documenté) ; quorum : `option_index` borné au minimum seulement.
- Affordances UI historique (toggle tâche/kit par tout membre) : refus RLS désormais visibles en 0 ligne silencieuse selon les cas — alignement sur les capacités prévu avec la vue permissions (lot 2).
- `AdventureSwitcher` : multi-groupes déjà couvert ; pas d'onglets « Mes groupes/découverte » créés (TRIBU-R1 respecté).
