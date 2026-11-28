# LKDV Control — bundle d'implémentation autonome

Ce dossier contient tout ce qu'il faut à un agent IA (orchestrateur + sous-agents) pour construire, vérifier et mettre en production **LKDV Control**, le CRM externe du Kit du Voyageur, sans revenir vers Tony avant la fin.

Version du bundle : 1.0 — 8 novembre 2026. Dépôt cible : `TFaraciColbert59/kitduvoyageur_1783951966810`. Base : Supabase `icxyvwzfjbflcbqukpfz`. Équipe Vercel : `team_lBmtlHsEp3YQAM4hQCaWovPG`.

---

## 1. Comment lancer

1. Remplir la section **Prérequis** ci-dessous (5 minutes) : sans elle, l'agent avancera mais certaines briques resteront désactivées.
2. Copier ce dossier à la racine du dépôt, dans `crm/bundle/` (l'agent le lit depuis là et y tient son état).
3. Donner à l'agent, comme instruction système ou premier message, le contenu de `00_PROMPT_MAITRE.md`.
4. Ne plus intervenir. L'agent écrit son avancement dans `crm/bundle/etat/` ; le rapport final arrive dans `crm/bundle/etat/RAPPORT_FINAL.md`.

Le bundle est écrit pour n'importe quel harnais d'agents (DeepSeek, Claude Code, autre) :
- si le harnais sait lancer des sous-agents, l'orchestrateur leur passe les fiches de `agents/` ;
- s'il ne le sait pas, l'orchestrateur joue les rôles l'un après l'autre, en relisant la fiche du rôle avant chaque tâche. Le résultat attendu est le même.

## 2. Prérequis à fournir avant le lancement

L'agent ne doit jamais attendre une réponse. Tout ce qui ne dépend que de Tony est listé ici. Une ligne vide n'empêche pas le chantier : la brique concernée sera livrée désactivée, et signalée dans le rapport final.

| # | Élément | Où le mettre | Sans lui |
| --- | --- | --- | --- |
| P1 | Accès GitHub en écriture au dépôt, création de branches et de pull requests | Harnais | Bloquant |
| P2 | Accès Supabase complet au projet `icxyvwzfjbflcbqukpfz` (Management API + SQL) | Harnais | Bloquant |
| P3 | Accès Vercel complet à l'équipe `team_lBmtlHsEp3YQAM4hQCaWovPG` (création de projet, variables, déploiements) | Harnais | Bloquant |
| P4 | `SUPABASE_DB_URL` (chaîne de connexion Postgres directe) pour les sauvegardes avant migration | Secret GitHub Actions + harnais | Les migrations de production restent en attente : l'agent ne migre jamais sans sauvegarde |
| P5 | `STRIPE_SECRET_KEY` de **test** (sk_test_…) | Variables Vercel du projet CRM, environnement Preview | Remboursements testés sur simulateur seulement |
| P6 | `STRIPE_SECRET_KEY` de **production** | Variables Vercel du projet CRM, environnement Production | Le bouton « Valider et rembourser » reste désactivé en production |
| P7 | `NVIDIA_API_KEY` (déjà utilisée par LKDV) | Variables Vercel du projet CRM | Agents IA livrés éteints |
| P8 | `RESEND_API_KEY` (e-mails d'alerte SOS et d'astreinte) | Variables Vercel du projet CRM | Alertes par notification push et dans le CRM seulement |
| P9 | Offre Vercel. L'offre gratuite (Hobby) interdit l'usage commercial et ne protège pas la production par mot de passe | Décision de Tony | L'agent déploie quand même ; la protection repose alors sur la connexion + double authentification |
| P10 | Un téléphone avec une application d'authentification (TOTP), pour la première connexion de Tony | — | Tony ne pourra pas se connecter au CRM tant que la double authentification n'est pas enrôlée |

Budget : 0 €. Le CRM est servi sur `lkdv-control.vercel.app` (gratuit, et séparé de `lekitduvoyageur.fr`, donc aucun cookie partagé). Aucun achat de domaine, aucune option payante Supabase (pas de branches Supabase) : les migrations sont répétées sur une base Postgres éphémère en CI, outil déjà présent dans le dépôt (`.github/actions/ephemeral-postgres`).

## 3. Ce que l'agent livre

- `crm/` : l'application Next.js LKDV Control (8 écrans de la maquette et tous les écrans des 144 actions), son serveur MCP pour les agents IA, ses tests.
- `supabase/migrations/2026111*_crm_*.sql` : le schéma `admin`, les états de modération, le statut des comptes, les commandes métier, le journal, avec chacun son rollback dans `supabase/migrations_down/`.
- Dans LKDV : filtrage des contenus masqués, blocage des comptes suspendus, notifications de modération avec bouton « Contester », suppression de l'ancien `/admin`.
- La production à jour, vérifiée, et un rapport final daté avec les preuves.

## 4. Les risques connus et comment le bundle les tient

| Risque | Parade imposée par le bundle |
| --- | --- |
| Casser LKDV en production (176 comptes réels) en modifiant des règles d'accès sur des tables vivantes | Toute migration est d'abord répétée sur la base éphémère avec les tests d'accès, puis appliquée avec sauvegarde préalable, rollback écrit et testé, et vérification sur LKDV juste après |
| Rembourser de l'argent réel par erreur | Stripe en mode test pour tous les tests ; aucun remboursement réel n'est jamais lancé par l'agent ; le bouton de production ne s'active qu'avec la clé P6 |
| Un agent IA trop autonome dans le CRM | Agents sans droit de validation, liste fermée d'outils, plafond par heure, bouton d'arrêt, contenus des membres traités comme des données |
| L'agent constructeur qui « déclare fini » trop tôt | Registre des écarts, auditeur indépendant qui n'a pas écrit le code, et fin seulement après deux audits complets consécutifs sans nouvel écart |
| Perte de contexte de l'agent sur un long chantier | État tenu dans des fichiers (`etat/`), relu à chaque cycle ; tâches décrites dans `tasks.json` |

## 5. Plan du dossier

| Fichier | Rôle |
| --- | --- |
| `00_PROMPT_MAITRE.md` | Instruction de l'orchestrateur : mission, règles, boucle, définition de « terminé » |
| `01_CAHIER_DES_CHARGES.md` | Ce qu'il faut construire, exigence par exigence (identifiants `EX-…`) |
| `02_ARCHITECTURE.md` | Architecture cible, choix techniques arrêtés |
| `03_MODELE_DE_DONNEES.md` | Schéma `admin`, migrations dans l'ordre, règles d'accès |
| `04_CATALOGUE_ACTIONS.md` | Les 144 actions : commande, pôle, rôle, validation, journal, temps réel |
| `05_UI_UX_DESIGN.md` | Écrans, composants, jetons LKDV, interactions, accessibilité |
| `06_PLAN_PHASES.md` | Phases, portes de passage, ordre de construction |
| `07_VERIFICATION.md` | Les 11 couches de vérification, l'auto-évaluation, la boucle des écarts |
| `08_GARDE_FOUS.md` | Ce qui est interdit, ce qui exige sauvegarde, les seules raisons de s'arrêter |
| `09_INTEGRATIONS_API.md` | Supabase, Vercel, GitHub, Stripe, NVIDIA NIM, Resend, MCP |
| `agents/` | Une fiche par sous-agent : rôle, entrées, sorties, critères de qualité |
| `templates/` | Modèles : registre des écarts, journal de bord, décision, rapport final |
| `tasks.json` | Graphe des tâches, lisible par machine |
| `sql/001_socle_admin.sql` | Brouillon de la première migration, à valider avant usage |
| `references/` | Recherche complète, maquette (8 écrans HTML), liens |
