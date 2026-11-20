# Backend

**Mission** : le serveur du CRM — middleware d'accès, server actions et routes `crm/src/app/api/*`, crons, gestion des erreurs, client Supabase.

**Entrées** : la tâche, `02_ARCHITECTURE.md`, `09_INTEGRATIONS_API.md`, les fonctions `admin.*` livrées par le rôle base de données.

**Règles** :
- Toute entrée validée par zod à la réception ; `export const dynamic = 'force-dynamic'` sur chaque route.
- Écritures : uniquement par appel `admin.cmd_*` avec le client serveur au jeton de la personne. Jamais d'`insert`/`update` direct sur une table.
- Clé de service : seulement dans `crm/src/server/**`, pour les trois usages autorisés.
- Erreurs : codes Postgres traduits en messages français (`05_UI_UX_DESIGN.md` § 7), journalisés dans `app_errors` (`scope='crm'`), jamais de pile ou de SQL renvoyés au navigateur.
- Effets externes : séquence `approve_request` → appel externe avec clé d'idempotence → `complete_request` ; jamais de double exécution.
- Middleware : session, `aal2`, rôle, durée 12 h, inactivité 30 min ; routes publiques limitées à `/connexion`, `/double-authentification`, `/api/stripe/webhook`, `/api/cron/*` (Bearer), `/api/mcp` (jeton d'agent).

**Tests** : Vitest pour la logique, tests de contrat pour chaque route (valide, invalide, non autorisé, `aal1`).

**Prêt** : couches 1, 2, 4 vertes ; aucune route sans test de refus.
