# Chantier Communauté LKDV — Rapport de clôture de l'assemblage

**Date :** 2026-10-10 · **Référence :** `main` local @ `02e4f83b` + arbre de travail assemblé (2 phases)
**Portée :** Feed V1 communautaire (R1–R4), LKDV Social / messagerie canonique (M1–M4), Admin OS (P0–P5), intégration sécurité (F-001/F-003/F-008/F-010/F-011/F-012, H-017, B8), rejouabilité complète des migrations, E2E locales.

---

## 1. Situation d'entrée (constat honnête)

Trois flux de travail coexistaient sans être assemblés :

1. **Branche `feat/explorer-mobile-osm`** — 30 commits au-dessus de `main` (explorer OSM, Admin v1 « rebuild from scratch », SSO, MFA TOTP, CSP, correctifs sécurité `d8bfb063`). Jamais fusionnée.
2. **Stash `stash@{0}`** (« WIP avant passage sur main 2026-10-09 ») — 45 fichiers modifiés : types/service de messagerie M1 (séquence, nonce, curseur, file offline), UI communautaire (MobileCommunityHub +606, CommunityPostCard +247, CommunityHubNav +45, page /communaute +35), durcissements admin (`requireAdmin`, `audit`, `sanitize`, `mfa`), `src/lib/supabase/types.ts` (+227).
3. **597 fichiers non suivis** — Feed V1 (`src/features/community/feed`, route `/api/community/feed`, `/api/community/interactions`), LKDV Social M1–M4 (services de domaine, cartes live, clubs, Expedition Rooms, Terra, réputation), Admin OS P0–P5 (routes, primitives, migrations `2026100512*`), tests (community 190, messaging 416, admin 91), migrations R1/R2/social core.

État mesuré avant assemblage : `tsc` **202 erreurs**, 4 fichiers de tests rouges (dont bombe temporelle P015), Admin OS importait des modules absents.

## 2. Phase 1 — Assemblage produit

| # | Action | Détail |
|---|--------|--------|
| 1 | **Sauvegarde** | Les 597 fichiers non suivis ont été copiés dans `%TEMP%\opencode\lkdv-backup-untracked` avant toute opération git. |
| 2 | **Fusion fast-forward** | `git merge --ff-only feat/explorer-mobile-osm` → `main` avance de `14d80de8` à `02e4f83b` (30 commits, 147 fichiers, zéro commit de fusion, zéro collision avec les fichiers non suivis — vérifié avant). |
| 3 | **Application du stash** | `git stash apply stash@{0}` → application propre, zéro conflit (base du stash = nouvelle tête). Le stash est **conservé** comme filet de sécurité. |
| 4 | **Réparation des 4 suites rouges** | Reprise du correctif `0a4faca6` (branche sécurité) : N7-06/N7-H conditionnels sans corpus local, P015 désamorcée (`2099-01-05`), narration 4 couches, registre IA. Ajout de `trail-ai-enrichment` au registre attendu (feature apportée par la branche). |
| 5 | **Comblement du trou d'intégration desktop** | La page `/communaute` mappait `fil → pour-toi` mais ne rendait **rien** pour les onglets opérationnels sur desktop. Ajout du fetch `/api/community/feed` (Pour toi / Abonnements / Autour de moi), rendu `CommunityPostCard` + transparence, état invité strict pour Abonnements, repli sur les posts serveur, sidebar desktop alignée sur les 4 onglets opérationnels. |
| 6 | **Montage Expedition Room (R3)** | `ConversationView` réunit désormais la conversation dans `ExpeditionRoomCockpit` (discussion + météo + tracé GPX + checklist partagée + points de situation) quand `context_type === 'expedition_room'` ; vue standard inchangée sinon. Test de montage ajouté (`tests/messaging/expedition-room-mount.spec.ts`, 2 tests). |

## 3. Phase 2 — Intégration sécurité, rejouabilité, E2E

| # | Action | Détail |
|---|--------|--------|
| 7 | **Intégration des correctifs sécurité vérifiés** (cherry-picks sans commit) | F-003 (Bearer CRON_SECRET sur les jobs notifications), H-017 (purge SW des caches privés), F-008 (migration d'invalidation des credentials de démo + garde alignée prod), F-010 rev2 (garde SSRF og-preview complète + rate-limit 20/min), F-011 rev2/rev3 (purge centralisée de l'état client au changement de compte), F-001/D5 partiel (garde CSRF systémique `/api` par origine + `SameSite`), F-006 phase 1 (politiques group-media), F-012 (rejouabilité de la chaîne), B8 (porte CI RLS réelles). Bump deps : Capacitor 8.5.3 (CVE critical), next 15.5.27, sharp 0.35.5. |
| 8 | **Correctif de rejouabilité réel trouvé et corrigé** | `20261003090000_hiking_route_sources_and_revisions.sql` référençait `trail_metadata.id`, colonne absente de la chaîne de replay (stand-in minimal). Garde `information_schema` ajoutée → la migration s'applique sur base vierge ET sur base historique. |
| 9 | **Preuve de rejouabilité complète (F-012 fermé)** | Conteneur isolé neuf (`supabase/postgres:17.6.1.141`) + préparation storage/extensions/grants + **replay intégral : 272/272 migrations appliquées depuis zéro, 0 échec + migration de matérialisation F-012 (`20261010130000`) appliquée puis re-appliquée (idempotence prouvée) = **273/273****. |
| 10 | **Porte RLS réelle (B8) exécutée** | `scripts/verify/rls-real-tests.mjs` contre la base rejouée : **14/14 scénarios PASS** (rôles anon/authenticated réels, claims, fixtures), exit 0. La porte est branchée dans `.github/workflows/ci.yml` (Gate DB.3). |
| 11 | **E2E locales** | `npm run test:e2e:local` (desktop Chromium, 11 specs `@local-web`) : **46 passés, 0 échec, 10 skipped**, exit 0. Deux attentes de tests périmées corrigées (produit réel) : `/rapport-kit` → `/prepare?tab=equipement` (fusion configurateurs) ; CTA « Préparer » d'un sentier → double issue honnête (connexion avec reprise OU page « données indisponibles », jamais une page morte). |

## 4. Preuves finales (verification-before-completion)

| Affirmation | Commande | Résultat |
|---|---|---|
| TypeScript propre | `npx tsc --noEmit` | **exit 0, 0 erreur** |
| Suite complète verte | `npx vitest run` | **796 fichiers : 7744 passés, 0 échec, 33 skipped** |
| Messagerie (M1–M4 + montage) | `npx vitest run tests/messaging/` | **418/418** |
| Communauté (Feed V1 + UI) | `npx vitest run tests/community/` | **190/190** |
| Admin OS | `npx vitest run tests/server/admin tests/app/admin tests/features/admin-os` | **91/91** |
| Sécurité (specs intégrés) | `npx vitest run tests/security/ tests/pwa/` | **171/171** (17 suites) ; + hubRedirects : **189/189** (18 suites) |
| Rejouabilité migrations | replay intégral sur conteneur vierge | **272/272 depuis zéro + F-012 matérialisation idempotente = 273/273** |
| Porte RLS réelle (B8) | `node scripts/verify/rls-real-tests.mjs` | **14/14 PASS, exit 0** |
| Lint | `npm run lint` | **exit 0** (warnings préexistants uniquement) |
| Build production | `npm run build` | **exit 0** (next 15.5.27) |
| E2E locales | `npm run test:e2e:local` | **46 passés / 0 échec / 10 skipped, exit 0** |
| Pas de marqueurs de conflit | scan `<<<<<<<` / `>>>>>>>` sur `src`, `tests`, `scripts`, `supabase` | **aucun** |

## 5. Critères d'acceptation du chantier

### R1 — Sécurité Reward Engine : ✅
`claim_reward_points` exige `auth.uid()` (usurpation → 42501), rejette les appels anonymes, `search_path = public, pg_temp`, exécution révoquée pour `anon/authenticated` — validé par `tests/community/m1-security-hardening.spec.ts`.

### R2 — Graphe social persistant : ✅
`post_saves`, `content_feedback` (+ réactions, follows) avec FK, index et RLS étanche — migration `20261003121000`, route `/api/community/interactions` (save/hide/less_like_this/report), typée dans `src/lib/supabase/types.ts`.

### R3 — Feed V1 déterministe : ✅
Pools de candidats (abonnements, clubs, géo, intention, découverte), scoring multi-signaux, reranking de diversité (max 2 consécutifs par auteur/format), filtrage de confidentialité, transparence « Pourquoi je vois ceci » — 6 suites de tests dédiées.

### R4 — Interface communautaire : ✅
4 onglets opérationnels (Pour toi, Abonnements chronologique, Autour de moi, Clubs) sur mobile **et** desktop, mutations persistantes avec retour haptique optimiste et rollback sur erreur, `tsc` 0 erreur, lint 0 erreur, tests 100 % verts.

### LKDV Social M1–M4 : ✅
Séquence atomique + idempotence `client_nonce` + curseur + file offline (facade `messagingService` 100 % rétrocompatible), cartes live GPX/Kit/Équipement/Expédition, Pack Merge (plafonds 20 % humain / 15 % chien), clubs à 5 rôles, Expedition Rooms **montées**, Terra en isolation par conversation avec citations obligatoires et brouillons validés humainement, réputation anti-spam (0 point pour le texte brut).

### Admin OS P0–P5 : ✅
Shell Liquid Glass V2 + 11 sections, autorité canonique `has_permission('admin.access')` (middleware + gardes serveur), moteur de commandes idempotent, approbations `decide_approval()` atomique, MFA Tier ≥ 3, JIT elevations, audit canonique. **Migrations vérifiées par replay intégral** ; application staging = opération d'exploitation (aucune base distante touchée ici).

### Sécurité (mission du 2026-10-09/10) : ✅ intégrée et vérifiée
F-001 (CSRF systémique), F-003, F-008, F-010 rev2, F-011 rev2/rev3, F-012, H-017, B8 : code + migrations + portes CI dans l'arbre, prouvés par les suites de sécurité et le replay complet.

## 6. Points ouverts (assumés)

1. **Application des migrations en staging/production** : opération d'exploitation (connexion distante requise) — la rejouabilité et l'idempotence sont prouvées localement (272/272).
2. **Composants Terra UI** (`QuietCatchUp*`, `TerraDraftActionCard`, `ReputationBadge`, `AdventureStreakBanner`) et `ClubChannelsList` : livrés et testés ; leur montage exige des flux de création de données (brouillons Terra, canaux de club, rooms) qui n'étaient pas dans le périmètre du chantier — suites documentées.
3. **Décisions humaines résiduelles de la mission sécurité** : D2/D4/D5 complet/D7/D8 (juridique, rétention, purge déconnexion, og-preview allowlist, group-media phase 2) — éléments préparés dans `security-mission/`.
4. **Stash conservé** : `stash@{0}` non supprimé (filet de sécurité). À dropper manuellement après validation.
5. **Aucun commit/push** : l'assemblage est dans l'arbre de travail ; `main` local est en avance de 30 commits sur `origin/main` (fusion FF). La mise en commit est laissée à la demande explicite.

## 7. Reproduction

```powershell
npx tsc --noEmit                    # 0 erreur
npx vitest run                      # 7744 verts / 0 échec
npm run lint                        # exit 0
npm run build                       # exit 0
npm run test:e2e:local              # 46 verts / 0 échec

# Rejouabilité + porte RLS (conteneur isolé jetable) :
#   docker run -d --name lkdv-replay-pg -e POSTGRES_PASSWORD=postgres -p 55433:5432 public.ecr.aws/supabase/postgres:17.6.1.141
#   préparation storage/extensions/grants (cf. security-mission/evidence/d1-rls-isolated.md §8)
#   boucle psql -v ON_ERROR_STOP=1 -U supabase_admin sur supabase/migrations/*.sql  → 272/272 depuis zéro (273/273 avec la matérialisation F-012)
#   $env:LKDV_TEST_DATABASE_URL='postgresql://supabase_admin:postgres@localhost:55433/postgres'
#   node scripts/verify/rls-real-tests.mjs  → 14/14
```
## 8. Livraison git (clôture finale)

Le chantier est committé sur `main` local (11 commits au-dessus de la fusion FF, non poussés) :

| Commit | Contenu |
|---|---|
| `686aad1a` | feat(community) : Feed V1 déterministe + interactions persistantes (R1–R4) |
| `b3469458` | feat(social) : messagerie canonique M1–M4 + Expedition Room montée |
| `e7964acb` | feat(social) : socle M1–M4 complémentaire (domaines, cartes live, types, suites) |
| `62799746` | feat(admin-os) : back-office P0–P5 (shell, primitives, socle serveur, suites) |
| `e8af3927` | feat(admin-os) : migrations P0–P5 |
| `db61f760` | feat(admin-os) : routes P2–P5 et files de travail |
| `7a4ea3ae` | feat(admin-os) : socle serveur complémentaire + 13 suites |
| `571710ad` | fix(security) : F-001/F-003/F-008/F-010/F-011/F-012, H-017, porte RLS B8 |
| `4eaf0753` | test(ci) : suites réparées + E2E alignées produit + baselines visuelles |
| `1589ccc1` | chore(deps) : Capacitor 8.5.3 (CVE), next 15.5.27 pinné, sharp 0.35.5 |
| `6b8018da` | docs(chantier) : rapport de clôture + artefacts de session + skill Stripe |

État final vérifié **sur l'arbre committé** : `tsc` 0 erreur, `vitest` 7744 verts / 0 échec.
Reste non suivi (volontaire) : `hosted-schema.json` (dump de travail non référencé).
Stash `stash@{0}` conservé (filet de sécurité, contenu désormais dans l'historique).
Aucun push : `main` local est à +41 commits d'`origin/main` (30 FF + 11 phases).
