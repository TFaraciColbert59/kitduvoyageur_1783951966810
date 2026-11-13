# Architecture — LKDV Control

Ces choix sont arrêtés. Les changer exige une décision consignée (`templates/DECISION.md`) avec la raison et l'alternative.

## 1. Vue d'ensemble

```
┌──────────────────────────┐        ┌──────────────────────────┐
│ LKDV (public)            │        │ LKDV Control (CRM)       │
│ lekitduvoyageur.fr       │        │ lkdv-control.vercel.app  │
│ Next.js 15, dossier /    │        │ Next.js 15, dossier crm/ │
│ session membre, RLS      │        │ équipe + MFA, RPC admin  │
└────────────┬─────────────┘        └────────────┬─────────────┘
             │ lecture/écriture membres          │ appels admin.cmd_* (RPC)
             ▼                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Supabase icxyvwzfjbflcbqukpfz — une seule base                   │
│  public : 307 tables (RLS par membre) + état de modération        │
│  admin  : commandes métier, journal, file, pôles, agents, réglages│
│  Realtime : canaux privés admin:* (CRM) + abonnements LKDV         │
└─────────────────────────────────────────────────────────────────┘
             ▲                                    ▲
             │ /api/mcp (outils = commandes)      │ Stripe, NVIDIA NIM, Resend
      Agents IA du CRM (comptes de service)       │ (routes serveur du CRM)
```

## 2. Dépôt et déploiement

| Sujet | Choix |
| --- | --- |
| Emplacement du code | Dossier `crm/` du dépôt `kitduvoyageur_1783951966810`, avec son propre `package.json` (Next.js 15.5.x, React 19, TypeScript strict, Tailwind 3.4, `@supabase/ssr`, `zod` 4, Vitest 4, Playwright 1.63, `@axe-core/playwright`) — mêmes versions que LKDV |
| Projet Vercel | Nouveau projet `lkdv-control`, *Root Directory* = `crm`, région `cdg1`, domaine `lkdv-control.vercel.app` |
| Branches | Une branche par phase `crm/phase-N-…` ; pull request vers `main` ; aperçu Vercel automatique par branche |
| CI | Nouveau workflow `.github/workflows/crm-ci.yml` : lint, types, tests unitaires, tests base (Postgres éphémère via `.github/actions/ephemeral-postgres` + pgTAP), E2E sur l'aperçu |
| Partage de code avec LKDV | Le CRM ne dépend pas de `src/` de LKDV. Il reçoit une **copie versionnée** des jetons (`crm/src/design/tokens.css` = copie de `src/styles/tokens.css`) et des primitives nécessaires ; un test vérifie que les jetons copiés sont identiques à ceux de LKDV |
| Types | `supabase gen types` pour les schémas `public` et `admin` → `crm/src/types/db.ts` régénéré à chaque migration |

## 3. Accès à la base

- Le schéma `admin` est exposé à l'API (PostgREST) : ajouter `admin` à la configuration *exposed schemas* du projet via l'API de gestion Supabase (`PATCH /v1/projects/{ref}/postgrest`, champ `db_schema` = `public,graphql_public,admin`). Le schéma reste protégé : `USAGE` accordé à `authenticated` seulement, chaque fonction appelle `admin.assert_staff()` ou `admin.assert_actor()`.
- Le navigateur du CRM ne lit **que** des vues/fonctions `admin.*` qui contrôlent le rôle, et n'écrit **jamais** : toute écriture passe par une *server action* ou une route `crm/src/app/api/*` qui appelle `admin.cmd_*` **avec le jeton de l'utilisateur** (pas la clé de service), pour que le contrôle de rôle et la MFA s'appliquent en base.
- La clé `service_role` ne sert qu'à trois choses, côté serveur : l'API admin d'Auth (bannissement `banned_until`, révocation de sessions), les tâches planifiées, l'amorçage des comptes d'agents.

## 4. Authentification

- Supabase Auth, même projet. Middleware `crm/src/middleware.ts` : session présente, `aal2`, rôle d'équipe via `admin.my_role()` ; sinon redirection vers `/connexion` ou `/double-authentification`.
- MFA : facteur TOTP (`supabase.auth.mfa.enroll/challenge/verify`). Enrôlement guidé si aucun facteur vérifié. Les 6 comptes super admin existants n'ont aucun facteur au 8/11/2026 : l'enrôlement est le premier écran qu'ils verront.
- Durées : session 12 h max, inactivité 30 min (verrouillage côté client + contrôle `iat`/dernière activité côté serveur).

## 5. Rôles, pôles, droits

Modèle :
- `admin_roles` (existante) : garde le rôle `super_admin`. Les valeurs `admin` et `moderateur` sont migrées en appartenances de pôle (voir `03_MODELE_DE_DONNEES.md`).
- `admin.poles` : les 7 pôles.
- `admin.staff_memberships (user_id, pole_id, role ∈ {responsable, membre})`.
- `admin.agents (id, auth_user_id, pole_id, name, tools text[], hourly_cap, status)`.
- `admin.elevations (user_id, command, expires_at, reason)` pour l'élévation temporaire.
- `admin.commands` : le registre des 144 commandes (pôle, rôle minimal, validation requise, destructive, motif requis, autorisée aux agents, événement temps réel). **Le registre pilote tout** : l'interface, la barre de commande, le serveur MCP et les tests en sont générés.

Règle d'autorisation unique, en base (`admin.can(actor, command)`) :

| Acteur | Peut lancer | Peut valider |
| --- | --- | --- |
| Super admin | Toute commande | Toute demande dont il n'est pas l'auteur ; ses propres demandes en mode solo |
| Responsable de pôle | Les commandes de son pôle | Les demandes de son pôle faites par d'autres |
| Membre de pôle | Les commandes de son pôle marquées `role_min = membre` ; plus les élévations actives | Si délégation du responsable |
| Agent IA | Les commandes de sa liste `tools`, marquées `agent_allowed`, en mode « proposer » si `needs_validation` | Jamais |

Mode solo : `admin.is_solo_mode()` = nombre de comptes humains d'équipe actifs (super admin + appartenances de pôle, comptes non désactivés, connectés dans les 90 derniers jours) = 1.

## 6. Commandes métier

- Chaque action du catalogue = une fonction `admin.cmd_<nom>(…)` `SECURITY DEFINER`, `search_path = ''`, qui : vérifie l'acteur (`admin.assert_actor(command)`), valide les entrées, vérifie l'état courant, agit, écrit `admin.audit_log`, émet l'événement temps réel, crée la notification au membre si concerné, retourne le nouvel état en JSON.
- Commandes à validation : `admin.cmd_*` crée une ligne `admin.requests` (statut `pending`, empreinte SHA-256 des paramètres) ; `admin.approve_request(id, confirmation)` exécute si l'approbateur est autorisé et l'empreinte inchangée.
- Commandes à effet externe (Stripe, Auth, e-mail) : la route serveur appelle d'abord `admin.approve_request` (qui passe la demande en `approved`), puis l'API externe avec une clé d'idempotence = id de la demande, puis `admin.complete_request(id, résultat)`. En cas d'échec externe : `failed`, réessai manuel, jamais double exécution.
- Annulation 10 s : l'interface propose « Annuler » qui appelle `admin.undo(audit_id)` ; seules les commandes marquées `undoable` l'acceptent, dans les 10 s.

## 7. Temps réel

- Déclencheurs `AFTER INSERT OR UPDATE` sur les tables sources (signalements, `sos_alerts`, `support_tickets`, `admin.requests`, `orders` pour les litiges, `reward_withdrawals`, `marketplace_listings`, `admin.audit_log`) → `realtime.send(payload minimal, event, 'admin:<flux>', true)`. Le payload ne contient jamais de donnée personnelle : identifiants et type seulement ; l'interface relit la ligne via une fonction contrôlée.
- Policy `SELECT` sur `realtime.messages` : `realtime.topic() like 'admin:%'` et appartenance à l'équipe (agents exclus des canaux humains).
- Présence : canal `admin:presence` (présence Supabase).
- Le déclencheur ne bloque jamais l'écriture d'origine : `EXCEPTION WHEN OTHERS` → journal technique.

## 8. Agents IA

- Exécutés par des tâches du projet CRM (Vercel Cron toutes les 5 min + déclenchement par événement via une file `admin.agent_jobs`).
- Chaque agent s'authentifie comme son compte de service Supabase (jeton à durée courte obtenu côté serveur) : la base applique ses droits.
- Outils = commandes du registre exposées par le serveur MCP `crm/src/app/api/mcp/route.ts` (transport HTTP), filtrées par `admin.agents.tools` ; schémas JSON stricts (`additionalProperties: false`).
- Modèle : NVIDIA NIM (`NVIDIA_API_KEY`), Nemotron comme dans LKDV. Tout texte de membre est passé dans un bloc balisé « donnée non fiable » avec l'instruction de ne jamais l'exécuter.
- Plafond horaire en base (`admin.agent_rate`), arrêt immédiat par `admin.agents.status = 'stopped'` vérifié à chaque appel.

## 9. Observabilité

- `ops.job_runs` (généralisation de `progression_ops.job_runs`) pour chaque tâche planifiée et chaque exécution d'agent.
- Erreurs serveur du CRM : `app_errors` (existante) avec `scope = 'crm'`.
- Écran « Technique » du CRM : erreurs, tâches, quotas IA, état Realtime, advisors.

## 10. Ce qui change dans LKDV

Liste fermée, rien d'autre : politiques restrictives de modération et de statut de compte (migrations), verrou des colonnes de modération, notifications de modération avec « Contester », écran de recours, abonnement temps réel au masquage, suppression de l'ancien `/admin`, mise à jour de `CLAUDE.md` (règle `trip_documents` et mention du CRM). Chaque changement a son test de non-régression.
