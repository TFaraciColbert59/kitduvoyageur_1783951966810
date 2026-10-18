# EVIDENCE — Journal de preuves LKDV (OpenCode + Ralph)

Règle : une entrée = une commande réellement exécutée + le résultat observé.
Aucun secret, token, coordonnée ou donnée personnelle dans ce fichier.
« SPÉCIFIÉ » n'est jamais une preuve.

## EV-0001 — Audit initial du dépôt (2026-10-18)

Commandes : `git status`, `git log --oneline -5`, lecture ciblée des fichiers
d'intégration, `rg` sur les migrations.

Résultats observés :
- Local = `main` au commit `61963cc9…` = commit figé du dossier maître. ✔
- `docs/autonomy/` absent → registre créé (cet EV).
- `src/features/kit-simulation/` absent → KIT-001 créé.
- `enforceRateLimit` (src/lib/rate-limit/routes.ts:25) : signature
  `(identifier, {scope, limit, windowMs, failMode})` — compatible avec la route de référence. ✔
- `createClient` (src/lib/supabase/server.ts:23) asynchrone — compatible. ✔
- `gear_items.product_id uuid REFERENCES shop_products(id)` —
  migration 20260720110000 ligne 7 — précondition SQL du dossier satisfaite localement. ✔
- CI pgTAP : `scripts/db/ci/run_pgtap.sh` ne collecte que
  `supabase/tests/database/*.test.sql` → le fichier copié
  `supabase/tests/kit_simulation_structure.sql` reste inerte (voulu tant que les
  propositions ne sont pas des migrations). ✔
- Dépôt : 361 fichiers de migration (conforme au dossier §3). ✔
- CI : portes type-check, lint, vitest, build, verify:invariants, pgTAP — inchangées. ✔

Non exécuté (à ne pas confondre avec un échec) : accès Supabase staging (P0A-001
bloqué sans identifiants), flux Awin (P2A-001 bloqué).

## EV-0002 — KIT-001 : intégration du socle kit-simulation

_(en cours — complété après exécution des commandes de vérification)_
