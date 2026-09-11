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

## conservation.test.sql

| Élément | Constat |
|---|---|
| Cause exacte | Prototype « conservation des kits » (matviews kit_item_survival*, kit_trust_scores) antérieur à A10 : sémantique de fixtures divergente (valeurs NULL) et index unique kit_trust_scores_kit_id_key incompatible avec le premier REFRESH non concurrent. |
| Preuve pré-A10 | Échec dès le replay historique complet (rapport A10_BDD_VALIDATION, suites historiques). |
| A10/A11 n'aggrave pas | Le refresh a été rendu résilient (migration 20260911390000 : plain refresh + index unique best-effort, jamais bloquant) ; aucune table/matview n'est modifiée par les migrations A. |
| Reproduction | psql -f supabase/tests/database/quarantined/conservation.test.sql → assertion 1 NULL vs 33.3, puis casts numériques. |
| Propriétaire | Décision produit (humain). |
| Cible | Décider du maintien du prototype conservation (réécriture des matviews + fixtures) ou retrait. |
