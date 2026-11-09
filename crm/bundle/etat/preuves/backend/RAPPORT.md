# Backend / Intégrations / Agents IA — preuves et état (task-3)

Date : 2026-11-09. Périmètre écrit : `crm/src/app/api/**`, `crm/src/server/**`,
`crm/src/agents/**` (non utilisé), `crm/src/lib/{cmd,errors}.ts`.
Rien n'a été commité, poussé, ni appliqué en base. Aucun appel réel Stripe / NIM / Resend
(aucune clé en local) : tous les chemins « clé absente » sont câblés et renvoient un refus clair.

## 1. Ce qui est construit

| Fichier | Rôle |
| --- | --- |
| `src/lib/errors.ts` | Codes d'erreur, phrases françaises, statuts HTTP, traduction `hint` → code, `redact()` (jetons, clés Stripe/Supabase, e-mails), journal structuré sans secret |
| `src/lib/cmd.ts` | Schéma zod strict par commande (144), `reason_code` exigé quand le catalogue l'exige, JSON Schema pour le MCP, locale zod française |
| `src/server/session.ts` | Session personne : `getUser` → `aal2` → `admin.my_context()` ; rôle, pôles, solo ; refus `staff_only` |
| `src/server/cmd.ts` | `runCommand` (`p_command`/`p_params`), `runCommandAs` (agent), `authorizeAgent`, `approveRequest`, `rejectRequest`, `undoAction` |
| `src/server/http.ts` | Corps JSON borné, `Bearer`, IP, `request_ref`, réponses JSON typées, `methodNotAllowed` |
| `src/server/rate-limit.ts` | Limite en mémoire par IP puis par utilisateur (la vérité budget reste `admin.agent_rate`) |
| `src/server/db.ts` | `service_role` serveur uniquement, réutilise `src/lib/supabase/service.ts` ; accès `ops.*` |
| `src/server/jobs.ts` | `ops.job_run_start` / `job_run_finish` + lecture `ops.job_runs` pour l'idempotence |
| `src/server/cron.ts` | Bearer `CRON_SECRET` à temps constant, clés de fenêtre (`cronBucket`, `dayBucket`), bornes de purge |
| `src/server/stripe.ts` | Remboursement test uniquement, idempotence `crm-refund-<request_id>`, `complete_request`, résolution de la demande |
| `src/server/resend.ts` | Alertes d'équipe uniquement, `delivered@resend.dev` hors production, `Idempotency-Key` |
| `src/server/sos.ts` | `sos_overdue`, escalade > 5 min idempotente, alerte haute, journal |
| `src/server/mcp/protocol.ts` | JSON-RPC 2.0 : `initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read`, `ping`, lots, notifications |
| `src/server/mcp/resources.ts` | File du pôle, PII masquées (e-mail, téléphone, IBAN, identifiants) |
| `src/server/agents/token.ts` | Jeton court HS256 (10 min, borné 60–900 s) signé `AGENT_TOKEN_SIGNING` |
| `src/server/agents/store.ts` | Lecture `admin.agents` (service_role, usage « amorçage/auth agents ») |
| `src/server/agents/registry.ts` | 6 contrats : rôle, objectif, outils, budget, SLA, escalade, évals, owner ; plafond dur 6 appels |
| `src/server/agents/prompts.ts` | Prompts système + `<donnee_non_fiable>` + désamorçage des balises |
| `src/server/agents/nim.ts` | NIM `https://integrate.api.nvidia.com/v1/chat/completions` uniquement, retry borné, jamais de prompt loggé |
| `src/server/agents/redact.ts` | Bannit `trip_documents`, `user_orientation`, coordonnées, messages privés avant le modèle |
| `src/server/agents/runner.ts` | Boucle outils bornée, `agent_authorize` avant chaque appel, budget, `ops.job_runs`, escalade |
| `src/server/__tests__/errors-contract.test.ts` | 6 tests : tous les marqueurs db, pas de fuite, `redact`, rate limit |

## 2. Routes HTTP

| Route | Méthode | Auth | Comportement | Erreurs typées |
| --- | --- | --- | --- | --- |
| `/api/cmd` | POST `{command, params}` | personne + `aal2` + `my_context` | zod strict → `admin.run_command(p_command,p_params)` ; `delegated` signalé, jamais exécuté en silence | 400 `unknown_command`, 422 `invalid_params`, 403 `mfa_required`/`not_allowed`, 409 `request_pending`, 429 `rate_limited` |
| `/api/approve` | POST `{id, confirmation}` | personne + `aal2` | lit `admin.request_detail(p_request)`, `admin.approve_request(p_request,p_confirmation)`, puis effet externe Stripe si `status='executed'` et commande `order_refund` | 403 `self_approval`, 409 `fingerprint_mismatch`/`not_pending`, 410 `request_expired` |
| `/api/reject` | POST `{id, reason}` | personne + `aal2` | `admin.reject_request(p_request,p_reason)` | 400 motif vide, 409 `not_pending` |
| `/api/undo` | POST `{audit_id}` | personne + `aal2` | `admin.undo(p_audit_id)` | 410 `undo_expired`, 409 `undo_not_allowed` |
| `/api/mcp` | POST JSON-RPC | `Bearer` jeton d'agent (HS256 10 min) | outils = `admin.commands` ∩ `admin.agents.tools` ∩ `agent_allowed` ; `agent_authorize` puis `run_command_as` | 401 `agent_token_missing`/`invalid`/`unknown`, 409 `agent_stopped`/`paused`, 403 `tool_not_allowed`, 422 arguments |
| `/api/cron/agents` | GET | `Bearer CRON_SECRET` | cycle des agents actifs, fenêtre 5 min | 401 `cron_secret_missing`/`invalid`, 503 `{disabled:true}` sans `NVIDIA_API_KEY` |
| `/api/cron/sla` | GET | `Bearer CRON_SECRET` | `sos_overdue(5)` → escalade idempotente ; `requests_overdue()` → digest horaire | 401, 200 avec `available:false` si RPC absente |
| `/api/cron/purge` | GET | `Bearer CRON_SECRET` | `purge_logs(p_days)` borné 30–3650 ; journal d'audit non purgé | 401, 503 `{disabled:true, reason:'purge_non_deployee'}` si M11 absente |
| `/api/stripe/webhook` | POST | signature `stripe-signature` | `charge.refunded`, `charge.dispute.created|closed` ; idempotent sur `event.id` + `ops.job_runs` ; `stripe_event_ingest` (service_role) | 403 signature fausse, 503 sans `STRIPE_WEBHOOK_SECRET_CRM` |
| `/api/health` | GET | aucune | `brickStatus()`, version, horodatage, aucun secret | — |

Aucune route n'écrit une table métier : toutes les écritures passent par une RPC `admin.*`
(`run_command`, `run_command_as`, `approve_request`, `reject_request`, `undo`,
`complete_request`, `stripe_event_ingest`, `purge_logs`, `ops.job_run_*`).

## 3. MCP — ce qui est refusé

| Cas | Réponse |
| --- | --- |
| Pas de `Authorization` | HTTP 401 `-32001` « Jeton d’agent absent. » |
| Jeton mal signé / expiré / mauvais `aud` | HTTP 401 « Jeton d’agent invalide ou expiré. » |
| Agent inconnu de `admin.agents` | HTTP 401 « Cet agent n’est pas reconnu. » |
| Agent `stopped` / `paused` | HTTP 409, phrase métier |
| Outil hors `admin.agents.tools` ou commande `never` | JSON-RPC `-32602` « Cet outil n’est pas dans la liste autorisée de l’agent. » |
| Argument hors schéma | JSON-RPC `-32602` + `issues[]` français (chemins, jamais de valeur) |
| Plafond `admin.agent_rate` atteint | `agent_authorize` lève `rate_limited` → `isError:true` + phrase ; agent mis en pause par la base |
| Tentative de validation | impossible : `approve_request` n'est pas un outil du registre ; la base lève `agent_cannot_validate` |

Ressources : `lkdv://pole/<CODE>/file`. La PII est masquée avant sortie. **Limite connue** :
`admin.inbox()` exige `is_staff()` (jeton humain) ; il n'existe pas encore d'`admin.agent_inbox(p_pole)`,
donc en service_role la ressource répond `{unavailable:true}` au lieu d'échouer. Les outils
de lecture restent la voie normale pour l'agent.

## 4. Agents (6 contrats)

| Agent | Pôle | Outils | Modèle | Plafond / run |
| --- | --- | --- | --- | --- |
| Trieur de signalements | CONF | `sos_board`, `carnet_list_reported`, 8 `*_report_resolve`, `terrain_report_decide` | fast | 6 appels |
| Remboursements | COMM | `order_refund`, `dispute_arbitrate` | heavy | 6 |
| Support | MEMB | `member_view_360`, `ticket_reply`, `ticket_set_status` | fast | 6 |
| Résumeur de fiches | MEMB | `member_view_360` (aucun document, aucune orientation) | fast | 6 |
| Relecteur de fiches pays | CONT | `country_content_review`, `country_guide_regenerate`, `place_update` | heavy | 6 |
| Surveillant d'erreurs | TECH | `errors_view`, `daily_report_view`, `alert_resolve` | fast | 6 |

Boucle : tâche → NIM → outils → vérification → `ops.job_runs`. Chaque appel d'outil :
`admin.agent_authorize(p_command, p_auth_user_id)` (statut + allowlist + 1 unité de
`admin.agent_rate`) **puis** `admin.run_command_as(...)`. Un run en échec est `error` +
alerte d'équipe (une par heure et par agent). Budget mensuel : estimation
`NIM_COST_CENTS_PER_1K_TOKENS` (défaut 0,1 centime/1k jetons) lue dans `ops.job_runs` ;
dépassement → arrêt + e-mail, jamais de poursuite silencieuse.

Interdits tenus : aucun autre fournisseur IA, aucun `service_role` hors `src/server/**`,
aucune écriture directe, aucun accès `trip_documents` / `user_orientation` (allowlist +
`redactForModel` qui remplace ces clés par `[masqué]`).

## 5. Stripe

Séquence vérifiée sur le code : `admin.approve_request` d'abord ; si `status='executed'` et
commande `order_refund`, la route `/api/approve` lit la demande **avant** validation,
appelle `refunds.create({payment_intent, amount, metadata:{request_id, order_id}},
{idempotencyKey:'crm-refund-'+request_id})`, puis `admin.complete_request(p_request,p_result,p_error)`,
puis e-mail d'équipe (idempotent). Clé non `sk_test_…` → refus `stripe_test_only`, aucune
tentative. Prix/montants jamais fixés par la route : ils viennent des paramètres validés
par la base.

Webhook : jamais le webhook LKDV (chemin distinct `/api/stripe/webhook`), signature vérifiée,
rejeu Stripe sans effet (idempotence base + `ops.job_runs`). `stripe_event_ingest` ne décide
pas d'argent ; `charge.refunded` / litiges nécessitent `metadata.order_id` sur le paiement
côté Stripe/LKDV, sinon la base classe l'événement `ignored` (comportement documenté par db).

## 6. Briques désactivées faute de secret (aucune valeur affichée)

| Brique | Variable | Comportement sans elle |
| --- | --- | --- |
| Remboursements | `STRIPE_SECRET_KEY` (test exigée) | `/api/approve` renvoie `external.ok=false`, `complete_request(ok:false,'stripe_unavailable')` ; rien n'est exécuté |
| Webhook Stripe | `STRIPE_WEBHOOK_SECRET_CRM` | 503 `{disabled:true}` |
| Agents IA | `NVIDIA_API_KEY` (+ `NVIDIA_MODEL_FAST/HEAVY`) | cron agents 503 `{disabled:true, brick:'nvidia'}` ; file humaine continue |
| Jetons d'agent | `AGENT_TOKEN_SIGNING` (< 32 car. refusé) | `/api/mcp` 503 « jeton de service indisponible » |
| Alertes e-mail | `RESEND_API_KEY`, `ALERT_FROM_EMAIL`, `TEAM_ALERT_EMAILS` | escalade journalisée + `emailed:false`, pas d'envoi |
| Crons | `CRON_SECRET` | 401 explicite, aucune exécution |

## 7. Tests manuels (à jouer avec les vraies variables en aperçu)

```bash
# 1. santé (aucune valeur secrète)
curl -s https://<apercu>/api/health | jq '.bricks | length, .summary'

# 2. cron sans jeton → 401 clair
curl -s -o /dev/null -w '%{http_code}\n' https://<apercu>/api/cron/agents

# 3. cron avec mauvais jeton → 401
curl -s -H 'Authorization: Bearer faux' https://<apercu>/api/cron/agents | jq '.error.code'

# 4. MCP sans jeton → 401 JSON-RPC
curl -s -X POST https://<apercu>/api/mcp -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' | jq '.error'

# 5. cmd sans session → redirection /connexion (middleware) ; avec session aal2 → 200
curl -s -X POST https://<apercu>/api/cmd -H 'Content-Type: application/json' \
  -d '{"command":"sos_board","params":{}}' | jq '.ok'

# 6. webhook signature fausse → 403 sans détail
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<apercu>/api/stripe/webhook \
  -H 'stripe-signature: t=1,v1=faux' -d '{}'
```

## 8. Preuves exécutées (locales, sans réseau)

```
$ npx tsc --noEmit
(0 erreur)

$ npx vitest run src/server/__tests__/errors-contract.test.ts src/lib/cmd-schema.test.ts src/lib/errors.test.ts
Test Files  3 passed (3)
Tests       27 passed (27)

$ npm run build            # source copiée dans /tmp (même node_modules), .next isolé
✓ Compiled successfully in 6.8s
✓ Generating static pages (8/8)
ƒ /api/approve  ƒ /api/cmd  ƒ /api/cron/{agents,purge,sla}  ƒ /api/health
ƒ /api/mcp      ƒ /api/reject  ƒ /api/stripe/webhook       ƒ /api/undo
exit 0

Note : dans le dossier partagé `crm/`, `.next` est réécrit par les builds/dev des autres
rôles en parallèle ; les échecs « PageNotFoundError / _document » observés venaient de ces
collisions (même source, second run vert). Le build isolé ci-dessus fait foi.
```

## 9. Écarts, risques, à suivre

1. **Middleware (hors périmètre)** : `/api/cmd|approve|reject|undo` ne sont pas dans
   `PUBLIC_API`. Une requête sans session reçoit une **redirection 307** vers `/connexion`
   au lieu du 401 JSON typé. Correctif d'une ligne dans `crm/src/middleware.ts` (orchestrateur).
2. **Ressource MCP « file du pôle »** : pas d'`admin.agent_inbox(p_pole)` en base ;
   `admin.inbox()` exige un jeton équipe. Dégradation propre (`unavailable:true`) en attendant.
3. **`admin.my_context`, `admin.order_detail`** : présentes au CONTRACT, pas encore dans les
   migrations au moment de l'écriture. Noms d'arguments supposés `p_order_id` (comme
   `p_request` pour `request_detail`, corrigé après lecture des migrations).
4. **`delegated`** : les commandes à effet externe Auth (bannir, révoquer) et e-mail ne sont
   **pas exécutées** par `/api/cmd` ; la réponse le dit (`external.handled=false`) et le
   journal le trace. À brancher (Auth admin) ou à traiter côté base.
5. **Build** : vert en isolation (`/tmp`, source identique, exit 0). Dans `crm/` partagé,
   `.next` est écrasé par les builds des autres rôles : lancer les vérifications de build
   dans une copie isolée (ou accepter les collisions). Aucune erreur de compilation dans
   `src/app/api/**` ni `src/server/**`.
6. **Test QA rouge hors périmètre** : `src/lib/test-guardrails.test.ts` échoue sur
   `crm/tests/a11y/etats.spec.ts:45` (motif de `skip` entre backticks, la regex n'accepte que
   les apostrophes simples) — fichier du rôle testeur, non modifié ici.
7. **Budget mensuel** : plafond dur = `admin.agent_rate` (horaire, en base). Le budget mensuel
   est une estimation de coût journalisée dans `ops.job_runs` (`NIM_COST_CENTS_PER_1K_TOKENS`),
   à recalibrer quand les tarifs NIM réels seront connus.
8. **Arrêt < 5 s** : vérifié avant chaque appel d'outil (`agent_authorize`). Pendant un appel
   NIM (jusqu'à 60 s), l'arrêt prend effet au retour, avant l'outil suivant. Le test pgTAP
   « arrêt effectif » reste à écrire par le rôle testeur.
9. **Déclenchement par événement** : le runner est prêt (`runAgents({trigger:'event'})`), mais
   aucun consommateur de `admin.agent_jobs` n'est écrit : les agents tournent par cron. À brancher
   (pg_cron + pg_net ou route dédiée) quand la file sera livrée.
10. **ESLint** : `no-restricted-imports` interdit `@/lib/supabase/service` partout, y compris
    dans `src/server/**` (config `.eslintrc.json`, périmètre orchestrateur). Le client
    service_role est donc créé localement dans `src/server/db.ts` ; `npx next lint
    --max-warnings=0` : 0 erreur.
