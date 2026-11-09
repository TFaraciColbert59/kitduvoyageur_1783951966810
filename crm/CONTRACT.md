# Contrat interne — LKDV Control (à respecter par tous les rôles)

Source : `bundle/` (00 → 09). Ce fichier ne remplace pas le bundle ; il fixe les interfaces entre rôles.

## RPC de la base (schéma `admin`, appelées avec le jeton de la personne)

| RPC | Retour | Usage |
| --- | --- | --- |
| `admin.my_role()` | `text` (`super_admin`/`responsable`/`membre`/null) | middleware, UI |
| `admin.my_context()` | `{ role, poles:[{code,role}], solo, staff, display_name, email }` | shell |
| `admin.commands_catalog()` | `{ commands:[{id,command,label,pole,roleMin,needsValidation,reasonRequired,undoable,agent,realtime}], poles }` | barre de commande, formulaires |
| `admin.inbox()` | `{ items:[InboxItem], counts, sla }` | écran À traiter |
| `admin.inbox_item(source,id)` | `CaseDetail` | cas/modération |
| `admin.member_360(user_id)` | `Member360` | fiche membre |
| `admin.reveal_pii(user_id, reason)` | `{ email, phone, revealed_until }` | journalisé |
| `admin.order_detail(order_id)` | `OrderDetail` | commande |
| `admin.requests_pending()` | `{ items:[RequestItem] }` | valider |
| `admin.request_detail(id)` | `RequestDetail` | valider |
| `admin.agents_overview()` | `{ agents:[Agent], solo, bricks }` | équipe |
| `admin.audit_page(before, limit, filters)` | `{ rows, next_before }` | journal |
| `admin.technique_status()` | `{ errors, jobs, advisors_hint, bricks, realtime }` | technique |
| `admin.run_command(command, params)` | `{ ok, data, request_id?, audit_id?, message? }` | toutes les actions |
| `admin.approve_request(id, confirmation)` | `{ ok, status, message }` | validations |
| `admin.reject_request(id, reason)` | `{ ok }` | validations |
| `admin.undo(audit_id)` | `{ ok }` | annulation 10 s |
| `admin.sos_board()` / `admin.sos_ack(id)` / `admin.sos_close(id, note)` | `{ items }` | SOS |
| `admin.poles_summary()` | `{ poles:[{code,label,count,role}] }` | navigation |

`InboxItem` : `{ key, source, id, group, title, subtitle, pole, urgency, due_at, created_at, badges[], meta }`.
`group` ∈ `urgence_haute` | `delai_bientot` | `a_valider` | `signalements` | `contributions`.
`source` ∈ `sos` | `support_ticket` | `request` | `post_report` | `comment_report` | `story_report` | `club_report` | `group_report` | `place_report` | `marketplace_report` | `terrain_report` | `contribution` | `alert` | `agent_proposal`.

## Routes HTTP du CRM

| Route | Méthode | Rôle |
| --- | --- | --- |
| `/api/cmd` | POST `{command, params}` | exécute `admin.run_command` (jamais d'écriture directe) |
| `/api/approve` | POST `{id, confirmation}` | `admin.approve_request` |
| `/api/undo` | POST `{audit_id}` | `admin.undo` |
| `/api/mcp` | POST (MCP streamable) | outils agents, jeton court |
| `/api/cron/agents` | GET Bearer | exécution des agents |
| `/api/cron/sla` | GET Bearer | compte à rebours, escalades |
| `/api/cron/purge` | GET Bearer | purge des journaux |
| `/api/stripe/webhook` | POST | `charge.refunded`, `charge.dispute.*` |
| `/api/health` | GET | santé |

Toutes les routes serveur : validation zod, erreurs traduites en français (`42501` → phrase métier), aucun secret renvoyé.

## Écrans (routes)

`/` (À traiter), `/pole/[code]`, `/cas/[source]/[id]`, `/membres/[id]`, `/commandes/[id]`, `/valider/[id]`, `/equipe`, `/journal`, `/sos/[id]`, `/catalogue`, `/contenus`, `/reglages`, `/ia`, `/technique`, `/entrainement`, `/connexion`, `/double-authentification`, `/acces-refuse`.

## Propriété des fichiers (écriture)

| Rôle | Périmètre |
| --- | --- |
| orchestrateur | `crm/package.json`, `crm/tsconfig.json`, `crm/next.config.mjs`, `crm/tailwind.config.ts`, `crm/src/middleware.ts`, `crm/src/app/{layout,globals.css,robots.ts}`, `crm/src/lib/{env,supabase/*,rpc,auth,rbac,countdown,format,fingerprint}.ts`, `crm/src/ui/primitives.tsx`, `.github/workflows/crm-ci.yml`, `crm/bundle/**` |
| base-de-donnees | `supabase/**`, `crm/scripts/gen-commands.mjs`, `crm/scripts/catalog-diff.mjs`, `crm/src/lib/catalog.ts` (généré), `crm/src/types/db.ts` |
| frontend / parite-design | `crm/src/app/(app)/**`, `crm/src/app/{connexion,double-authentification,acces-refuse}/**`, `crm/src/components/**`, `crm/src/ui/**` sauf `primitives.tsx` |
| backend / integrations / agents-ia | `crm/src/app/api/**`, `crm/src/server/**`, `crm/src/agents/**`, `crm/src/lib/{cmd,errors}.ts` |
| testeur | `crm/tests/**`, `crm/playwright*.config.ts`, `crm/scripts/capture-*.mjs`, tous les `*.test.ts` |

## Interdits rappelés

Pas de `service_role` côté client, pas d'écriture directe de table dans le navigateur, pas de couleur littérale hors jetons, pas de fournisseur IA autre que NVIDIA, pas de secret dans le dépôt, pas de test affaibli, pas de production touchée par un rôle autre que l'orchestrateur.
