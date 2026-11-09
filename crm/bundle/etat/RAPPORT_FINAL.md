# LKDV Control — rapport final

Date : 2026-11-09 · Durée du chantier : 1 jour (2 sessions) · Commit : `ee6f63e` (branche `crm/phase-0-preparation`) · Worktree : `lkdv-control-work`

## Verdict

**La porte finale de `00_PROMPT_MAITRE.md` § 6 n'est PAS franchie.** Deux blocages ne dépendent pas de l'agent et interdisent la mise en production telle que le bundle l'exige :

| # | Blocage | Preuve | Conséquence |
| --- | --- | --- | --- |
| P3 | Le jeton Vercel n'a pas le droit de créer un projet : `create_deployment` → `403 You don't have permission to create a project` | `preuves/base/BACKUP_P4.md`, journal | Le CRM n'est pas déployé ; aucun aperçu de production n'existe. |
| P4 | `SUPABASE_DB_URL` et `BACKUP_PASSPHRASE` absents : workflow `db-backup` → `ready=false` (run 42560633757) | `preuves/base/BACKUP_P4.md` | `08_GARDE_FOUS.md` § 2.2 interdit toute migration de production sans sauvegarde : le schéma `admin` n'est **pas** appliqué. |

Sans ces deux éléments, aucune preuve de production (couche 10) ni de non-régression LKDV sur production n'est possible. Le reste a été construit, testé localement et sur base éphémère, et documenté.

## 1. Ce qui est en ligne

- CRM : **rien** (projet Vercel non créé — P3).
- LKDV : inchangé (`main` = `2c22d49`, aucun déploiement déclenché par ce chantier).
- Migrations : **0 / 19** appliquée en production (P4) ; 19 fichiers prêts, avec 19 rollbacks.
- Base de production : aucun schéma `admin`, aucune donnée modifiée, aucun secret créé.

## 2. Ce qui a été construit (dans le dépôt)

| Bloc | Contenu | Preuve |
| --- | --- | --- |
| Application `crm/` | Next.js 15.5 / React 19 / TS strict, 30 routes : coque, file, décision, membre 360, validation, équipe/agents, journal, SOS, commande, pôles, catalogue (144 actions), contenus, réglages, IA, technique, entraînement, connexion, MFA, accès refusé | `next build` OK (`preuves/build/build-2026-11-09.log`) |
| Base | 18 migrations M00→M15 + 1 complément (`my_context`, `order_detail`, `agent_inbox`) et leurs `.down.sql` ; 10 suites pgTAP ; registre `admin.commands` = 144 lignes ; moteur `run_command`, demandes à empreinte, journal immuable, pôles, mode solo, modération, statuts, file, sanctions/recours, membres, support, réglages/ops, realtime, agents | `preuves/db/RAPPORT.md` |
| Backend | `/api/cmd`, `/api/approve`, `/api/reject`, `/api/undo`, `/api/mcp` (JSON-RPC fait main), `/api/stripe/webhook`, `/api/cron/{agents,sla,purge}` ; erreurs françaises ; zod 144 schémas ; agents NVIDIA NIM (6 contrats) | `preuves/backend/RAPPORT.md` |
| Tests | 93 tests unitaires verts ; 10 suites pgTAP ; 21 fichiers E2E + 3 a11y + perf + visuel écrits ; garde-fous anti-affaiblissement | `preuves/tests/RAPPORT.md`, `preuves/audits/audit-1.md` |
| CI | `.github/workflows/crm-ci.yml` : types, lint, unitaires, build, base éphémère (schéma de production + migrations), pgTAP, rollback | `preuves/ci/HISTORIQUE_CI.md` |
| Design | jetons LKDV copiés (test d'identité), primitives, 0 couleur littérale hors jetons, captures 1440/390 des 3 écrans publics | `preuves/ui/RAPPORT.md`, `preuves/visuel/` |

## 3. Conformité, preuves à l'appui

| Élément | Résultat | Preuve |
| --- | --- | --- |
| Exigences `EX-…` | **14 prouvées / 88**, 53 partielles, 7 non prouvées, 14 bloquées par Tony | `preuves/exigences/COUVERTURE_EX.md` |
| Actions `ACT-…` | 144 / 144 au registre et dans l'UI ; **121 avec effet porté**, 23 `domain_pending` (E-0010) | `supabase/migrations/..._crm_commands_*.sql`, `catalog-diff` |
| 11 couches | 1 et 2 vertes ; 3 en cours en CI (10 suites pgTAP, 1 fixture en correction) ; 4–9 partielles ou non exécutées ; 10 bloquée | `ETAT.md` |
| Audits indépendants | 1 audit complet : **verdict NON**, notes 30–74 | `preuves/audits/audit-1.md` |
| Advisors Supabase | relevé « avant » : 3 erreurs (2 `security_definer_view`, 1 `rls_disabled_in_public`), 41 tables sans policy ; « après » impossible sans migration | `preuves/base/ETAT_BASE_2026-11-09.md` |
| Non-régression LKDV | **non mesurée** : aucun test LKDV lancé (dépôt non modifié hors `crm/`, `supabase/`, `.github/`) | — |

## 4. Ce qui attend Tony (5 actions, dans cet ordre)

| # | Action | Effet | Où |
| --- | --- | --- | --- |
| 1 | Autoriser la création du projet Vercel `lkdv-control` (ou le créer, Root Directory `crm`) | Débloque le déploiement (P3) et la couche 10 | Vercel → équipe `team_lBmtlHsEp3YQAM4hQCaWovPG` |
| 2 | Poser `SUPABASE_DB_URL` et `BACKUP_PASSPHRASE` dans les secrets GitHub Actions | Débloque la sauvegarde puis les 19 migrations (P4) | GitHub → Settings → Secrets → Actions |
| 3 | Lancer « Sauvegarde de la base » et vérifier l'artefact chiffré | Condition § 2.2 | Actions → db-backup → Run workflow |
| 4 | Poser `STRIPE_SECRET_KEY` **test** (`sk_test_…`) dans Vercel (Preview) et `NVIDIA_API_KEY`, `RESEND_API_KEY` si voulus | Active remboursements test, agents, alertes (P5/P7/P8) | Vercel → lkdv-control → Environment Variables |
| 5 | Se connecter avec un compte `super_admin` et enrôler le TOTP | Première connexion (P10) | `<URL>/connexion` |

La procédure détaillée, commande par commande, est dans `crm/docs/MISE_EN_PRODUCTION.md`.

## 5. Décisions prises seul

`D-0001` worktree séparé · `D-0002` base Postgres locale de vérification · `D-0003` `is_admin()` non élargi aux pôles · `D-0004` `public_profiles` reste `SECURITY DEFINER` · `D-0005` acteur journalisé = demandeur · `D-0006` M15 ne supprime rien. Détail : `DECISIONS.md` (D-0003, D-0004 et D-0006 sont à montrer à Tony).

## 6. Limites connues

1. **23 commandes inertes** (`domain_pending`) : elles échouent explicitement au lieu de faire semblant d'agir (E-0010). Il manque les colonnes réelles de `places`, `trips`, `club_events`, `badges`, `challenges`, `seasons`, `progression_events`, `affiliate_clicks`, `ai_usage_*`.
2. **Effets externes** (remboursement Stripe, bannissement Auth, e-mail) : la base prépare et valide ; l'appel externe est branché mais renvoie `delegated_not_executed` sans clé (E-0003).
3. **M00 partiel** : `public_profiles` non passée en `security_invoker` (casserait les profils publics) ; `hub_dashboard_kpis` traitée ; décision D-0004.
4. **E2E, axe, 48 captures** : écrits, non exécutés faute de base migrée et de comptes de test (E-0014/E-0015).
5. **CI base éphémère** : les migrations s'appliquent, les 10 suites pgTAP tournent ; la dernière exécution corrige une fixture (`crm_inbox`) — voir `preuves/ci/HISTORIQUE_CI.md` pour la conclusion exacte au moment de la remise.
6. Le schéma de la base éphémère diffère de la production sur quelques colonnes postérieures à la baseline (`post_reports.target_type`, `sos_alerts.country_iso_a2`) : les migrations et tests utilisent `to_jsonb` pour ne dépendre ni de l'un ni de l'autre.

## 7. Comment revenir en arrière

- CRM : aucun déploiement, donc rien à annuler. Si un projet est créé puis déployé : Instant Rollback Vercel ou suppression du projet ; LKDV n'en dépend pas.
- Base : les `.down.sql` sont dans `supabase/migrations_down/`, à appliquer dans l'ordre inverse (M15 → M00) ; M01 supprime le schéma `admin` en dernier. Sauvegarde obligatoire avant toute application.
- LKDV : aucun commit de ce chantier ne touche `src/` ; `git revert` des commits `crm/phase-0-preparation` si nécessaire.

## 8. Auto-évaluation

| Axe | Orchestrateur | Auditeur | Seuil |
| --- | --- | --- | --- |
| Complétude | 46 | 44 | 95 |
| Exactitude | 63 | 61 | 95 |
| Sécurité | 76 | 74 | 95 |
| Fidélité au design | 50 | 48 | 95 |
| Expérience | 65 | 63 | 95 |
| Accessibilité | 44 | 42 | 95 |
| Performance | 32 | 30 | 95 |
| Fiabilité | 58 | 56 | 95 |
| Non-régression LKDV | 70 | 68 | 100 |

Aucun axe n'atteint son seuil : la porte finale reste fermée. Les deux notes diffèrent de 2 points au plus.

## 9. Prochaine étape (une fois P3 et P4 levés)

1. `git checkout crm/phase-0-preparation && npm --prefix crm ci && npm --prefix crm run build`.
2. Lancer la sauvegarde, appliquer M00→M15 un par un (observation 15 min après M00/M05/M06), exposer le schéma `admin`, régénérer les types.
3. Déployer le CRM, exécuter les couches 5 à 10 (axe, captures, E2E, perf, production), puis les 2 audits indépendants consécutifs exigés par § 6.
