# Audit indépendant n° 1 — LKDV Control

- **Date** : 2026-11-09 17:50–18:15 (Europe/Paris) · **Auditeur** : sous-agent `auditeur`, n'a écrit aucune ligne du chantier.
- **Périmètre** : `crm/` + registre d'état ; lecture seule. **Aucune** écriture hors ce fichier, aucun commit, aucun appel Supabase / Vercel / GitHub.
- **Règle appliquée** : `07_VERIFICATION.md` § 3 — « pas de preuve = écart » ; une preuve est un artefact rejouable ou une sortie de commande, pas une déclaration.

---

## 1. Méthode

1. Lecture des sources autorisées : `etat/ETAT.md`, `etat/ECARTS.md`, `etat/DECISIONS.md`, `crm/CONTRACT.md`, `bundle/01` (tableaux), `bundle/04` (en-têtes + comptages), `bundle/07` (§1, §3, §4), `bundle/08`, puis des preuves de `etat/preuves/**`.
2. Exécution des contrôles statiques et unitaires (rien modifié) + `git` + greps de conformité.
3. Confrontation compteur par compteur : 88 `EX`, 144 `ACT`, garde-fous, 8 écrans, production, E2E.
4. Aucun test n'a été écrit, aucun `skip` ajouté, aucun seuil touché.

### 1.1 Sorties exactes des commandes

```
$ cd crm && npx tsc --noEmit
(sortie vide)                                                    EXIT=0

$ cd crm && npx next lint --max-warnings=0
`next lint` is deprecated and will be removed in Next.js 16.
✔ No ESLint warnings or errors                                   EXIT=0

$ cd crm && npx vitest run
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'` …
 RUN  v4.1.11 …/lkdv-control-work/crm
 ✓ src/lib/catalog.test.ts (9)      ✓ src/lib/test-guardrails.test.ts (8)
 ✓ src/lib/format.test.ts (10)      ✓ src/lib/countdown.test.ts (15)
 ✓ src/lib/fingerprint.test.ts (9)  ✓ src/server/__tests__/errors-contract.test.ts (6)
 ✓ src/lib/cmd-schema.test.ts (12)  ✓ src/lib/errors.test.ts (9)
 ✓ src/lib/rbac.test.ts (10)        ✓ src/design/tokens.test.ts (1)
 ✓ src/lib/totp-harness.test.ts (4)
 Test Files  11 passed (11) · Tests  93 passed (93) · 658 ms       EXIT=0

$ git log --oneline -15
0413a4c test(db): fixtures de signalement avec publication cible (FK post_reports.post_id)
c269875 test(db): plans pgTAP exacts, fixtures sans target_type (absent du schema CI), droits realtime
f32bdfb fix(ci): pgTAP via run_pgtap.sh (fichiers explicites) + down M01 supprime le schema admin
1679bd7 fix(ci): doublure realtime dans le shim CI (au lieu d'un DO imbrique fragile)
05cdf51 fix(a11y): liens secondaires des ecrans d'authentification a 44 px (controle 32)
6f8d6a4 fix(db): M12 cree le minimum realtime sur une base sans Supabase Realtime (CI)
700a632 fix(crm): M07 robuste aux colonnes post-baseline (to_jsonb) + type exporte (lint CI)
45f067a feat(crm): pgTAP (10 fichiers), RPC contexte/commande/file agent, effets delegues, ordre M02/M07
684301f fix(crm): middleware resilient (307 au lieu de 500), CSP sans unsafe-eval en prod, preuve runtime
91e951b test(crm): motif de skip explicite (garde-fou) + registre des ecarts
16901de feat(crm): application complete (30 routes), 18 migrations M00-M15, backend, MCP et tests
8b1908c chore(crm): socle phase 0 — application Next.js, jetons, catalogue 144 actions, etat et preuves
2c22d49 feat(carnet): libelles de type sur les 9 familles de moments
6da5339 docs(carnet): deploiement final de la refonte 100%
26a4faa docs(carnet): checklist 100% — etat final

$ git status --porcelain
(vide)                                            branche crm/phase-0-preparation
```

### 1.2 Greps de conformité

| Contrôle | Commande | Sortie | Verdict |
| --- | --- | --- | --- |
| Écriture directe de table depuis l'UI | `grep -rE "\.(insert\|update\|delete\|upsert)\(" crm/src/components crm/src/app` | 0 ligne | **conforme** |
| Couleur littérale hors jetons | `grep -rE "#[0-9a-fA-F]{6}" crm/src` moins `src/design/tokens.css` et `src/ui/crm.module.css` | 0 ligne (tokens.css : 238, crm.module.css : 0) | **conforme** |
| `service_role` hors `src/server` + `src/lib/supabase/service.ts` | `grep -rn "service_role" crm/src` | 5 fichiers hors périmètre : `types/db.ts:755`, `app/api/cmd/route.ts:40`, `app/api/stripe/webhook/route.ts:19`, `lib/test-guardrails.test.ts:93`, `lib/env.ts:41` — **commentaires, libellés et une regex de test uniquement** ; aucune instanciation de client | **conforme sur le fond**, littéral non respecté |
| 144 actions | `grep -c '"id": "ACT-' crm/src/lib/catalog.ts` · `grep -c "^  {"` · `grep -c "^  ('ACT-" supabase/migrations/20261109090300_crm_commands_registry.sql` | **144** · **147** (= 144 commandes + 3 entrées `POLES`) · **144** | **144/144** |
| Migrations | `ls supabase/migrations/2026110909*.sql` · `ls supabase/migrations_down/2026110909*.sql` | **19** up · **19** down (M00→M15 + `…093000_crm_context_agent_inbox`) | **conforme** |
| Secrets en dur | `grep -rn "sk_test_\|sk_live_\|eyJhbGciOiJIUzI1NiIs"` | seulement `src/server/stripe.ts` (garde `startsWith('sk_test_')`), tests et rapports | **conforme** |
| `using (true)` / grant `anon` sur `admin` | grep sur les 19 migrations | 0 ligne | **conforme** |
| Périmètre des commits | `git log --name-only -11` hors `crm/`, `supabase/`, `.github/` | `scripts/db/ci/supabase_shim.sql` (outil CI) | **conforme**, aucun fichier `src/` LKDV touché |

### 1.3 Ce qui n'a pas pu être vérifié

Aucun accès Supabase/Vercel/GitHub (interdit par la consigne) ⇒ **non rejoués** : application des 19 migrations, advisors, CI GitHub, aperçu Vercel, `next build`. Ces points sont donc jugés **sur pièces**, pas sur exécution.

---

## 2. Écarts vérifiés

### 2.1 Écarts du registre, revus (10 non clos, dont 2 marqués « 0 / 0 / 0 / 0 » dans ETAT)

| ID | Source attendue | Constat (chemin:ligne) | Gravité | Rôle | Preuve de fermeture attendue |
| --- | --- | --- | --- | --- | --- |
| E-0001 | `02_ARCHITECTURE §2`, `09 §3` | `ECARTS.md:7` — projet Vercel `lkdv-control` inexistant, 403 à la création. Confirmé par `ETAT.md:52` « pas encore déployé ». | critique | deploiement | URL d'aperçu + `get_deployment` READY |
| E-0002 | `08 §2.2` | `ECARTS.md:8` — 0/19 migration en production, schéma `admin` absent en prod. Cohérent avec `ETAT.md:17` (0/16) et `:54`. | critique | deploiement | artefact `db-backup` + `list_migrations` prod = 19 |
| E-0003 | `EX-COM-04` | `ECARTS.md:9` — effets externes non exécutés ; le code existe (`src/server/external.ts`) mais rien ne prouve un remboursement test de bout en bout. | haute | integrations | 1 remboursement `sk_test` + `stripe_event_ingest` tracé |
| E-0004 | `EX-AGT-03` / `09 §8` | `ECARTS.md:10` — ressource MCP « file du pôle » indisponible ; `admin.agent_inbox` est **livrée** : `supabase/migrations/20261109093000_crm_context_agent_inbox.sql:215`. **Périmé** ; reste à prouver l'appel MCP de bout en bout. | moyenne | agents-ia | test d'appel MCP archivé |
| E-0005 | `CONTRACT.md` | `ECARTS.md:11` dit les RPC **manquantes** ; elles sont écrites : `supabase/migrations/20261109093000_crm_context_agent_inbox.sql:13` (`my_context`), `:88` (`order_detail`), `:215` (`agent_inbox`). **Écart mal formulé / périmé** : le manque est l'application en prod, pas le code. | haute | base-de-donnees | migration appliquée + écran alimenté |
| E-0006 | `07` couche 3 | `ECARTS.md:12` « tests pgTAP non écrits » ; 10 fichiers existent (`supabase/tests/database/crm_*.test.sql`) et `crm-ci.yml:49` a un job `crm-db`. **Périmé** ; aucun log CI vert archivé. | haute | base-de-donnees | run `crm-db` vert (URL + log) |
| E-0007 | `07` couche 5 | `ECARTS.md:13` « test-guardrails rouge » ; **faux aujourd'hui** : `vitest run` = 93/93 verts (dont `test-guardrails` 8/8) et `src/ui/crm.module.css:1094-1097` porte `min-height: 44px` (commit `05cdf51`). | moyenne | testeur | rejeu axe archivé (voir A-04) |
| E-0009 | `EX-LKDV-05` | `ECARTS.md:17` — ancien `/admin` LKDV toujours en place ; dépend de E-0001/E-0002. | haute | deploiement | `/admin` → 404 + test |
| E-0010 | `04_CATALOGUE` | `ECARTS.md:15` — 23 commandes sur 144 lèvent `domain_pending` (`supabase/migrations/20261109091300_crm_commands_core.sql:953`). **16 % du catalogue est inerte.** | haute | base-de-donnees | effet porté + 1 test pgTAP par commande |
| E-0011 | `03 §2 M00` | `ECARTS.md:16` — M00 partiel (`public_profiles` reste `SECURITY DEFINER`, décision D-0004). | moyenne | base-de-donnees | décision de Tony + adviser à 0 |
| E-0008 | `03 §1` | `ECARTS.md:14` — **seul écart clos**, preuve `preuves/base/ETAT_BASE_2026-11-09.md` présente. | basse | base-de-donnees | — (fermé) |

### 2.2 Écarts nouveaux constatés par cet audit

| ID | Source attendue | Constat (chemin:ligne) | Gravité | Rôle | Preuve de fermeture |
| --- | --- | --- | --- | --- | --- |
| A-01 | `07 §3` (registre = vérité) | `ETAT.md:19` affiche « Écarts ouverts 0 / 0 / 0 / 0 » alors que `ECARTS.md` en porte **10 non clos** (2 critiques, 5 hautes, 3 moyennes, 1 basse close). Un tableau de bord qui ment sur son propre registre viole la loi 6. | **critique** (gouvernance) | orchestrateur | `ETAT.md:19` recalculé depuis `ECARTS.md` + contrôle automatique |
| A-02 | `07 §3` « pour chaque EX retrouver la preuve » | `ETAT.md:14` revendique **24/88 EX** prouvées. Dans tout `etat/preuves/`, **7 identifiants EX seulement** sont cités (`EX-AGT-02, AUTH-02, AUTH-03, COM-04, INBOX-02, ROLE-07, RT-04`). Aucun fichier de preuve ne nomme les 17 autres. | haute | orchestrateur | 1 artefact par EX (grep `EX-…` = 88 fichiers ou index) |
| A-03 | `07 §3`, couche 9 | `preuves/playwright/resultats.json` est une **liste**, pas une exécution : `stats.expected=0, skipped=222, unexpected=0`, durée 655 ms. Le seul résultat E2E archivé atteste donc **0 test joué**. | haute | testeur | JSON d'un `playwright test` réel (expected > 0) |
| A-04 | `07 §1` couche 5, `EX-A11Y-01` | `tests/RAPPORT.md:43` déclare 14 verts / 204 skip / **4 rouges** (cibles 18 px). Le correctif est dans le code (commit `05cdf51`) mais **aucun rejeu archivé** : ni rapport axe, ni capture, ni JSON. Le rouge et le vert sont également indémontrables. | haute | testeur | rapport axe 0 violation sur les 20 écrans |
| A-05 | `EX-UX-01`, couche 6 | `visuel/RAPPORT-DIFFERENCES.md:4` : **6 captures / 48**. Les 6 sont 3 écrans publics × 2 tailles ; **0 des 8 écrans de la maquette** (`reference/maquette/*.png`) n'est capturé, faute d'identifiants (`manifest.json`, 42 `skipped`). `ETAT.md:18` « 8/8 conformes » n'a donc aucune preuve visuelle. | haute | testeur + parite-design | 48 captures + diff par écran |
| A-06 | `07 §1` couche 1 | `ETAT.md:24` « `next build` OK ». `ui/RAPPORT.md:186` documente l'inverse (build cassé par `no-restricted-imports`) et `:55` le reconnaît à la clôture ; `backend/RAPPORT.md:172` ne prouve un build que dans une copie `/tmp`. **Aucun log de build dans `preuves/`**. | moyenne | orchestrateur | log `next build` exit 0 dans `preuves/` |
| A-07 | cohérence des compteurs | `ETAT.md:17` « M00–M15 → 0/16 » et `:26` « 18 migrations », alors que **19** fichiers up et **19** down existent (`20261109090000`…`20261109093000`). | basse | orchestrateur | compteur à 19/19 |
| A-08 | `EX-GEN-03` | `ETAT.md:15` « 144/144 enregistrées **et appelables** » : vrai au registre, faux à l'effet (23 inertes, E-0010) et non prouvé à l'interface (`tests/e2e/catalogue-144.spec.ts:10` est `skip` sans identifiants). | haute | orchestrateur | 144 tests E2E verts |
| A-09 | `07 §1` couche 10 / `08 §3` | Aucune preuve de CI verte : pas de run archivé, pas de lien, pas d'artefact. La porte « CI verte sur la PR » n'est donc pas franchie, seulement espérée. | haute | orchestrateur | URL du run `crm-ci` vert |
| A-10 | `08 §1.13` | La règle de grep « aucun `service_role` hors `src/server` » est violée **littéralement** (5 fichiers, §1.2) sans violation de fond. La règle doit être précisée (motif d'usage) ou le contrôle automatisé, sinon tout futur audit conclura à tort. | basse | orchestrateur | règle écrite + test de garde |

### 2.3 Les 144 ACT

| Contrôle | Attendu | Constat | Verdict |
| --- | --- | --- | --- |
| Source | `ACT-001`…`ACT-144` contigus | 144 lignes, 0 trou, 0 doublon (`bundle/04`) | **OK** |
| Code | 144 `CommandDef` | `catalog.ts` : 144 `"id": "ACT-"` ; `grep -c "^  {"` = 147 (144 + 3 pôles) | **OK** |
| Base | 144 lignes `admin.commands` + 144 fonctions | `…090300…:144` lignes ; contrôle SQL `…091500…:119-129` ; parité base revendiquée par `db/RAPPORT.md` (mode base) | **OK sur pièces**, non rejoué |
| Effet | chaque action agit | 61 effets réels · 53 déléguées · 7 validation seule · **23 `domain_pending`** (`db/RAPPORT.md §4.1`) | **KO partiel (16 %)** |
| Interface | 1 test E2E par action | 21 fichiers E2E écrits, **0 exécuté sans identifiants** (`catalogue-144.spec.ts:10`) | **non prouvé** |

---

## 3. Note /100 par axe

Seuils de `07_VERIFICATION.md` § 4 : 95 partout, 100 en non-régression. **Aucun axe n'atteint son seuil.**

| Axe | Note | Justification (points retirés) |
| --- | --- | --- |
| **Complétude** | **44** | 144/144 ACT au registre (+). Mais 23 ACT sans effet (−16 %), 19/19 migrations **non appliquées** en prod, 64/88 EX sans artefact de preuve, 0/8 écrans capturés, couches 4→10 vides dans `ETAT.md:27-33`. |
| **Exactitude** | **61** | Types, drapeaux et RPC conformes au contrat ; `tsc`/`lint`/`vitest` verts rejoués ici. Mais `ETAT.md` contredit `ECARTS.md` (A-01), E-0005/E-0006/E-0007 périmés, compteurs 18/16/19 incohérents (A-07), 23 commandes qui répondent `0A000`. |
| **Sécurité** | **74** | Très bonne architecture : journal en ajout seul avec trigger (`…090100…:180-186`), `revoke all … from anon` sur `admin`, approvals + empreinte, `redact`, aucun `service_role` côté client, aucun secret en dur, 0 écriture de table depuis l'UI. Retiré : advisors jamais lancés, M00 partiel, aucune preuve d'exécution pgTAP, aucun banc d'injection exécuté (couche 8 vide). |
| **Fidélité au design** | **48** | 0 couleur littérale hors jetons (vérifié), 22 différences justifiées, checklist 40 contrôles renseignée — mais **auto-évaluée par l'auteur du code**, 3 « N » et 5 « P », 6/48 captures, **aucun** des 8 écrans de la maquette comparé. |
| **Expérience** | **63** | Raccourcis, annulation 10 s, états vides, messages métier, mode solo documentés et testés unitairement ; mais 7 écarts UI ouverts (recherche globale absente, `/valider` sans index, réglages/IA vides, traduction `42501` incomplète) et aucun test novice. |
| **Accessibilité** | **42** | `@axe-core/playwright` installé, 3 fichiers a11y écrits, cibles 44 px corrigées dans le CSS ; mais **0 rapport axe archivé**, 70 tests a11y en `skip`, 4 rouges non rejoués, contraste non mesuré. |
| **Performance** | **30** | Tests de seuils écrits (`tests/perf`), mais **5 `skip`**, aucune mesure, `ui/RAPPORT.md` dit lui-même « p95 non instrumentée ». Virtualisation décrite par lecture de code seulement. |
| **Fiabilité** | **56** | Idempotence réelle (`ops.job_runs`, empreinte SHA-256, `stripe_event_ingest`), 19 `.down.sql`, rollback 19/19 **déclaré** localement sans log ; aucune reprise après coupure prouvée, aucun DLQ/replay exercé, E2E à zéro. |
| **Non-régression LKDV** | **68** | Aucun fichier `src/` LKDV touché par les 15 commits (vérifié) et aucune migration appliquée ⇒ risque nul **à ce jour**. Mais `EX-LKDV-01`→`06` ne sont prouvés par aucun test exécuté, et l'ancien `/admin` est toujours là. |

---

## 4. Verdict — porte finale (`07_VERIFICATION.md` § 3 et § 6)

**NON. La porte est fermée.** Exigence : zéro écart ouvert, quelle que soit la gravité. Constat : **10 écarts du registre non clos + 10 écarts nouveaux**, dont 3 critiques.

Manques à lever, dans l'ordre :

1. **A-01** — corriger `ETAT.md:19` (0/0/0/0 → 10 non clos) et rendre le compteur calculé, pas saisi. Sans cela, aucun tableau de bord n'est crédible.
2. **E-0001 / E-0002** — débloquer P3 (projet Vercel) et P4 (sauvegarde + secrets) ; sans eux : 0 migration en prod, 0 aperçu, 0 couche 10.
3. **A-03 / A-04 / A-05 / A-09** — archiver des exécutions réelles : E2E, axe, 48 captures, run CI vert. Aujourd'hui, `preuves/` contient des **déclarations**, pas des résultats.
4. **E-0010 / A-08** — porter les 23 commandes inertes ou les retirer du catalogue ; aligner le discours « 144/144 appelables ».
5. **A-02** — index de preuve par `EX-…` (7/88 cités aujourd'hui) ; c'est la seule façon de juger la complétude.
6. **E-0003** — un remboursement de bout en bout en mode test, avec `request_id`, `audit_id`, événement Stripe.
7. **A-06 / A-07 / A-10** — log de build, compteurs 19/19, règle `service_role` précisée.

Points solides, à ne pas casser : catalogue 144/144 généré et contrôlé, 19 migrations avec rollback, journal immuable, approvals + empreinte, aucune écriture de table côté navigateur, 0 couleur littérale, 93 tests unitaires verts, périmètre git propre.

---

## 5. Résumé (10 lignes)

1. Statique et unitaire rejoués : `tsc` 0 erreur, `next lint` 0 avertissement, **93 tests / 11 fichiers verts**.
2. `git` : 15 commits, arbre propre, branche `crm/phase-0-preparation`, **aucun fichier LKDV touché**.
3. 144 ACT : présentes au bundle, dans `catalog.ts` et dans le registre M03 — **mais 23 (16 %) sans effet**.
4. 19 migrations up / 19 down sur disque ; **0 appliquée en production** (E-0002).
5. 88 EX : **7 seulement** sont cités dans `preuves/` ; la revendication « 24/88 » n'est pas vérifiable.
6. 8 écrans : **6 captures / 48**, aucune des 8 maquettes ; « 8/8 conformes » n'a aucune preuve visuelle.
7. E2E : l'artefact archivé est un `--list` (`expected: 0, skipped: 222`) ; **aucun test joué n'est prouvé**.
8. `ETAT.md` affiche « 0 écart ouvert » alors que `ECARTS.md` en porte **10** (dont 2 critiques) : défaut de gouvernance critique.
9. Quatre écarts du registre sont périmés (E-0004, E-0005, E-0006, E-0007) et trois compteurs sont faux (16/18/19).
10. Verdict : **porte NON franchie** — notes de 30 (performance) à 74 (sécurité), aucune au seuil de 95.
