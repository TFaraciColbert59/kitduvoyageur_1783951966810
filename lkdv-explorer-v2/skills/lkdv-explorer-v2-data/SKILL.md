---
name: lkdv-explorer-v2-data
description: Use for any Explorer v2 database, migration, RPC, RLS, import (Natural Earth, Overpass, Wikidata) or external free API (MET Norway, Hub'Eau, Photon) work.
---
# Données Explorer v2

- Toujours `list_projects` d’abord ; projet `icxyvwzfjbflcbqukpfz` uniquement. Résultats MCP : double parsing JSON (`json.loads(data[0]['text'])`).
- Vérité = `pg_class`, `pg_policies`, `information_schema`, jamais l’historique des migrations seul.
- Migrations idempotentes, transactionnelles, nommées `2026110x_explorer_v2_<objet>.sql`, testées en local (`npx supabase start`) puis appliquées, puis revérifiées.
- RLS sur toute table nouvelle ; test d’intrusion croisée dans `.agents/test_rls_intrusion.mjs`.
- RPC : `SECURITY INVOKER` par défaut ; `bbox` bornée (≤ 2° de côté sauf niveaux monde/pays agrégés) ; `limit` ≤ 400 ; `explain analyze` < 300 ms consigné.
- Imports : scripts dans `scripts/explorer-v2/import/*.mjs`, rejouables, avec source et licence stockées. Overpass : 1 requête/s, tuiles 0,5°, reprise sur erreur, jamais déclenché par un utilisateur.
- API externes : proxy serveur avec cache (MET Norway : User-Agent `LKDV/1.0 contact@…`, `If-Modified-Since`, cache ≥ 30 min), timeout 4 s, repli = bloc masqué.
- Zéro donnée inventée : absente = masquée. Les seeds de démonstration sont interdits en production.
