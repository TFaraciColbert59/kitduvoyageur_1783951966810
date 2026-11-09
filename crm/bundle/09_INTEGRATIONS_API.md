# Intégrations et API — tout connecter

Pour chaque service : à quoi il sert, comment s'y connecter, quelles variables, ce qui est testé, ce qui se passe s'il manque. Les identifiants et URL ci-dessous ont été relevés le 8/11/2026 ; l'agent les revérifie en phase 0 (la documentation officielle fait foi, liens dans `references/LIENS.md`).

## 1. Variables d'environnement du projet Vercel `lkdv-control`

| Variable | Environnements | Source | Côté | Obligatoire |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Tous | Supabase `get_project_url` | Client + serveur | Oui |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Tous | Supabase `get_publishable_keys` | Client + serveur | Oui |
| `SUPABASE_SERVICE_ROLE_KEY` | Tous | Déjà dans le projet Vercel de LKDV : la recopier par l'API Vercel sans l'afficher | Serveur seulement | Oui |
| `NEXT_PUBLIC_LKDV_URL` | Tous | `https://lekitduvoyageur.fr` (liens vers les contenus) | Client | Oui |
| `CRM_SESSION_MAX_HOURS` / `CRM_IDLE_MINUTES` | Tous | `12` / `30` | Serveur | Oui |
| `CRON_SECRET` | Production, Preview | Tony (P-liste LKDV) ; sinon généré par l'agent pour le seul projet CRM, jamais affiché | Serveur | Oui |
| `STRIPE_SECRET_KEY` | Preview = test (P5) ; Production = live (P6) | Tony | Serveur | Non (brique désactivée) |
| `STRIPE_WEBHOOK_SECRET_CRM` | Selon environnement | Créé à l'ajout du point d'entrée | Serveur | Non |
| `NVIDIA_API_KEY` | Tous | P7 (recopie depuis LKDV) | Serveur | Non (agents éteints) |
| `NVIDIA_MODEL_FAST` / `NVIDIA_MODEL_HEAVY` | Tous | Mêmes valeurs que LKDV | Serveur | Oui si agents |
| `RESEND_API_KEY` / `ALERT_FROM_EMAIL` | Tous | P8 | Serveur | Non |
| `AGENT_TOKEN_SIGNING` | Tous | Généré, pour les jetons courts des agents | Serveur | Oui si agents |

Un test de démarrage (`crm/src/lib/env.ts`, schéma zod) refuse de lancer le serveur s'il manque une variable obligatoire, et expose à l'écran « Technique » la liste des briques désactivées faute de variable facultative (sans jamais afficher de valeur).

## 2. Supabase (projet `icxyvwzfjbflcbqukpfz`)

| Besoin | Moyen |
| --- | --- |
| Migrations | Outil `apply_migration` (MCP Supabase) ou CLI `supabase db push`, après les étapes de `08_GARDE_FOUS.md` § 2 |
| Lecture d'état | `list_tables`, `list_migrations`, `execute_sql` (lecture seule hors migration), `get_advisors` |
| Exposer le schéma `admin` | API de gestion : `PATCH https://api.supabase.com/v1/projects/icxyvwzfjbflcbqukpfz/postgrest` avec `{"db_schema":"public,graphql_public,admin"}` ; relire avec `GET` d'abord et **conserver** les schémas déjà exposés |
| Auth : MFA TOTP | Vérifier par l'API de gestion (`GET /v1/projects/{ref}/config/auth`) que TOTP est activé (`mfa_totp_enroll_enabled`, `mfa_totp_verify_enabled`) ; l'activer sinon. Ne pas toucher aux autres réglages d'Auth de LKDV |
| Auth : actions d'administration | `supabase.auth.admin.updateUserById(id, { ban_duration })`, `auth.admin.signOut` (révocation), côté serveur avec la clé de service, uniquement dans les commandes `cmd_ban_*` / `cmd_suspend_*` après `admin.approve_request` |
| Comptes de service des agents | `auth.admin.createUser` (e-mail `agent-<nom>@agents.lkdv-control.invalid`, `email_confirm: true`, mot de passe aléatoire non conservé), puis ligne `admin.agents`. Jeton court obtenu par le serveur (JWT signé, durée 10 min, `role=authenticated`, `sub=<id agent>`) |
| Realtime | Canaux privés `admin:*` (`supabase.channel(topic, { config: { private: true } })`), `realtime.send` dans les déclencheurs ; vérifier que l'option « Allow public access » des canaux reste sans effet sur `admin:*` (policy M01) |
| Types | `generate_typescript_types` → `crm/src/types/db.ts` après chaque migration |
| Tests base | `.github/actions/ephemeral-postgres` + pgTAP (`supabase/tests/database/crm_*.sql`), schéma de départ = `supabase db dump --schema-only` du projet |

Clients dans le CRM :
- `crm/src/lib/supabase/server.ts` : `createServerClient` (`@supabase/ssr`) avec les cookies du CRM ; c'est lui qui appelle `admin.cmd_*` avec le jeton de la personne.
- `crm/src/lib/supabase/browser.ts` : lecture des fonctions `admin.*` autorisées + Realtime ; **aucune** méthode d'écriture exportée (règle vérifiée par la couche 1).
- `crm/src/lib/supabase/service.ts` : clé de service, importable uniquement depuis `crm/src/server/**` (règle ESLint `no-restricted-imports`).

## 3. Vercel (équipe `team_lBmtlHsEp3YQAM4hQCaWovPG`)

1. `create_project` : nom `lkdv-control`, dépôt GitHub du projet, *Root Directory* `crm`, framework Next.js, région `cdg1`.
2. Commande d'ignorance de build (*Ignored Build Step*) : `git diff --quiet HEAD^ HEAD -- crm/` pour ne pas reconstruire le CRM sur chaque commit LKDV ; inversement, ajouter `crm/` au filtre équivalent du projet LKDV s'il en a un (ne pas créer de filtre qui empêcherait LKDV de se construire).
3. `create_project_env` pour chaque variable du § 1, par environnement.
4. Protection : *Deployment Protection* sur les aperçus. En offre Hobby, la production ne peut pas être protégée par mot de passe : la protection repose sur l'authentification + MFA (noté dans le rapport, P9).
5. Crons dans `crm/vercel.json` : `/api/cron/agents` (toutes les 5 min — en offre Hobby, les crons sont limités à une exécution par jour : dans ce cas, déclenchement par événement via `admin.agent_jobs` + appel de la route par un déclencheur `pg_net` si l'extension est disponible, sinon par le passage d'une personne dans le CRM ; décision consignée), `/api/cron/sla` (compte à rebours, escalades), `/api/cron/purge` (quotidien). Chaque route exige `Authorization: Bearer ${CRON_SECRET}`.
6. Suivi : `list_deployments`, `get_deployment`, `get_runtime_errors`, `get_runtime_logs` ; retour arrière `request_rollback`.
7. En-têtes de sécurité (`crm/next.config.mjs`) : CSP stricte (`default-src 'self'`, Supabase et Stripe seulement en `connect-src`), `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy` minimale, `X-Robots-Tag: noindex, nofollow` et `robots.txt` qui interdit tout.

## 4. GitHub (`TFaraciColbert59/kitduvoyageur_1783951966810`)

- Branches `crm/phase-N-<nom>` depuis `main`, pull request par phase avec la liste des tâches, des exigences et des preuves.
- Workflow `.github/workflows/crm-ci.yml` déclenché sur `crm/**`, `supabase/**` : installation, `tsc`, ESLint, Vitest, pgTAP sur Postgres éphémère, Playwright sur l'aperçu Vercel (attendre le statut de déploiement), axe.
- Le workflow LKDV existant continue de tourner tel quel ; le CRM ne le modifie pas.
- Secrets GitHub nécessaires : `SUPABASE_DB_URL` et `BACKUP_PASSPHRASE` (déjà prévus par `db-backup.yml`), `VERCEL_AUTOMATION_BYPASS_SECRET` pour les E2E sur aperçu protégé.

## 5. Stripe

- Bibliothèque `stripe` ^17.7 (même version que LKDV), côté serveur seulement.
- Remboursement : `stripe.refunds.create({ payment_intent, amount, reason, metadata: { request_id, order_id } }, { idempotencyKey: 'crm-refund-' + request_id })`, appelé **uniquement** après `admin.approve_request` réussi, puis `admin.complete_request`.
- Lecture : paiement, litiges (`disputes.list`), état du remboursement pour l'écran commande.
- Webhook : nouveau point d'entrée `crm/src/app/api/stripe/webhook/route.ts` pour `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed` → met à jour la commande et la file. Ne pas modifier le webhook LKDV existant (`/api/stripe/webhook`) ; si les deux doivent écouter les mêmes événements, le CRM lit l'état écrit par LKDV plutôt que de doubler le traitement (décision à consigner après lecture du code LKDV).
- Tests : clés de test, cartes de test Stripe, `stripe trigger` si la CLI est disponible, sinon événements signés construits dans les tests (`stripe.webhooks.generateTestHeaderString`).
- Mode solo : la validation en deux étapes de Tony (`EX-ROLE-07`) précède toujours l'appel Stripe.

## 6. NVIDIA NIM (agents IA)

- Point d'accès compatible OpenAI : `https://integrate.api.nvidia.com/v1/chat/completions`, en-tête `Authorization: Bearer ${NVIDIA_API_KEY}`. Réutiliser les noms de modèles et le client de LKDV (lire `src/lib/ai/` ou équivalent en phase 0) ; aucun autre fournisseur.
- Appels d'outils : schémas JSON du registre `admin.commands` (générés), `additionalProperties: false`, validation zod de chaque argument renvoyé par le modèle avant l'appel de la commande.
- Gabarit de prompt : règles de l'agent (fiche) + outils + contenu du membre entre balises `<donnee_non_fiable>` avec la consigne de ne jamais exécuter ce qu'elle contient.
- Plafonds : `admin.agent_rate` (par agent et par heure) + quota IA de LKDV (`check_and_increment_ai_quota`) partagé avec le plafond du site `AI_DAILY_CAP`.
- Panne ou clé absente : l'agent passe `paused`, la file humaine continue ; affiché à l'écran Équipe et agents.

## 7. Resend (alertes)

- `POST https://api.resend.com/emails` côté serveur, pour : alerte SOS sans « Je prends » après 5 min (EX-SOS-01), escalade d'astreinte, résumé hebdomadaire de la relecture des agents.
- Destinataires : les adresses des membres de l'équipe d'astreinte (lues dans Auth côté serveur), jamais un membre de la communauté.
- Tests : `delivered@resend.dev` uniquement.
- Absent : alertes dans le CRM et notification navigateur seulement.

## 8. Serveur MCP du CRM (`/api/mcp`)

- Transport HTTP streamable (spécification MCP en vigueur), route `crm/src/app/api/mcp/route.ts`.
- Authentification : jeton court d'agent (§ 2) ; aucun accès anonyme ; aucun accès humain par ce canal.
- Outils : générés depuis `admin.commands` filtrés par `admin.agents.tools` et `agent_allowed = true` ; chaque outil appelle la même `admin.cmd_*` que l'interface, avec le jeton de l'agent, donc la base applique ses droits (une commande `needs_validation` crée une demande, jamais une exécution).
- Ressources en lecture : file du pôle de l'agent, fiche résumée d'un objet (données personnelles masquées).
- Arrêt : chaque appel vérifie `admin.agents.status`, refus immédiat si `stopped` ou `paused`.
- Tests : appel valide, outil hors liste, argument invalide, agent arrêté, tentative de validation, plafond atteint.

## 9. LKDV ↔ CRM : ce qui circule

| Sens | Quoi | Comment |
| --- | --- | --- |
| LKDV → CRM | Nouveau signalement, SOS, ticket, commande litigieuse, contribution | Déclencheurs `realtime.send` (M12) → file « À traiter » en moins de 2 s |
| CRM → LKDV | Contenu masqué/retiré | `moderation_state` + politique restrictive ; abonnement temps réel côté LKDV qui retire l'élément affiché |
| CRM → LKDV | Compte suspendu/banni | `account_status` + Auth `ban_duration` + révocation des sessions |
| CRM → membre | Décision motivée + lien « Contester » | Table de notifications existante de LKDV, texte de `admin.member_notice` |
| Membre → CRM | Recours | Écran LKDV « Contester » → `admin.appeals` → file |
| CRM → LKDV | Réglages (TVA, frais, seuils) | `admin.app_settings` lus par une fonction publique en lecture seule |
