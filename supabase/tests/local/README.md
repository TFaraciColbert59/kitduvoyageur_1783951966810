# Validation locale des migrations LKDV Control

Ces scripts appliquent **M00→M15** sur un Postgres jetable, jouent les tests
pgTAP, un fumée fonctionnelle, puis les 18 rollbacks. Aucun accès à la
production.

Prérequis : `pg` (`npm i -g pg` ou dans `crm/node_modules`) et un Postgres
local accessible en `127.0.0.1:55432`, utilisateur `postgres/postgres`.

```bash
node supabase/tests/local/fresh.mjs       # crée lkdv_shim + le schéma de substitution
node supabase/tests/local/apply.mjs       # applique les 18 migrations
node supabase/tests/local/run-tests.mjs   # 10 fichiers pgTAP (substitut local de l'extension)
node supabase/tests/local/smoke.mjs       # 41 assertions fonctionnelles
node supabase/tests/local/rollback.mjs    # 18 rollbacks + réapplication
```

`shim.sql` ne reproduit que les objets touchés par les migrations (colonnes
réelles relevées en production le 2026-11-09) et des policies « production-like »
minimales. `pgtap_stub.sql` remplace l'extension `pgtap` absente : en CI, jouer
les mêmes fichiers `supabase/tests/database/crm_*.test.sql` avec la vraie
extension et la baseline complète.
