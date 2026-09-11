# Suites pgTAP en quarantaine — preuves exigées (ruling Étape 0)

Ces suites ne sont PAS exécutées par le harnais certifiant
(`scripts/db/install-from-baseline.ps1`, glob non récursif
`supabase/tests/database/*.test.sql`). Elles restent versionnées pour être
réactivées si la fonctionnalité correspondante est dégelée.

## Réactivations

- `attributions.test.sql` et `security_lignees.test.sql` : **réactivées** le
  2026-09-11 (A11). La réimplémentation additive
  `supabase/migrations/20260911400000_a11_kit_attributions.sql` fournit les
  objets absents (tables, RPC, RLS, grants) ; les suites sont revenues dans
  `supabase/tests/database/` et passent (7/7 et 10/10). Détail : rapport
  `.superpowers/sdd/step0/attributions-report.md`.
- `conservation.test.sql` : **réactivée** le 2026-09-11 (A11). La correction
  source `supabase/migrations/20260911410000_a11_conservation_matviews_fix.sql`
  recrée les 3 matviews sans produit cartésien (`GROUP BY k.id`, laterals
  corrélés) et rétablit l'index unique `kit_trust_scores_kit_id_key` ; la suite
  est revenue dans `supabase/tests/database/` et passe (8/8). Détail : rapport
  `.superpowers/sdd/step0/conservation-report.md`.

_Plus aucune suite en quarantaine à ce jour._
