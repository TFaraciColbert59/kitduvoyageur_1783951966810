# B2 — preuve dynamique notifications (2026-10-10)

Contexte : F-003 corrigé (Bearer CRON_SECRET) ; aucun déclencheur versionné dans le dépôt.

## Test dynamique sur serveur réel (isolé)

- Build local (`next build`) + `next start -p 4099` dans le worktree `lkdv-fixes`,
  env factices (`CRON_SECRET='local-test-secret'`, Supabase placeholder, service key vide).
- Résultats :
  - `POST /api/notifications/process` sans en-tête → **401**
  - avec `Authorization: Bearer wrong-secret` → **401**
  - avec `Authorization: Bearer local-test-secret` → **passe la garde** (500 ensuite :
    configuration Supabase placeholder absente — attendu en local)
  - `GET /api/notifications/digest` sans en-tête → **401**
- Serveur arrêté après test (aucune donnée, aucun effet externe).

## Reste à faire côté plateforme (action humaine, D1/D3)

1. Créer le déclencheur réel : Vercel Cron (ou équivalent) sur
   `POST /api/notifications/process` et `POST /api/notifications/digest` avec
   `Authorization: Bearer ${CRON_SECRET}` — OU pg_cron + pg_net avec le secret stocké dans Vault.
2. Vérifier après déploiement : les routes répondent 401 sans secret et traitent la file avec.
3. Le digest transmet déjà le Bearer au process interne (corrigé) — aucun autre appelant dans le
   dépôt (grep vérifié).
