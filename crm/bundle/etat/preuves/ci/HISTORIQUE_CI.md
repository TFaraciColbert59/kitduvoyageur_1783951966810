# CI — historique des exécutions (branche crm/phase-0-preparation)

| Run | Commit | Conclusion | Job application | Job base éphémère |
| --- | --- | --- | --- | --- |
| 42560941148 | 8b1908c | failure | success | failure (aucun test pgTAP) |
| 42562851575 | 16901de | failure | failure (test skip non motivé) | failure (M07 target_type) |
| 42563121778 | 91e951b | failure | success | failure (M07) |
| 42563556023 | 45f067a | failure | failure (lint db.ts) | failure (M07) |
| 42572014941 | 700a632 | failure | success | failure (M12 realtime) |
| 42572275603 | 6f8d6a4 | failure | success | failure (M12 dollar quote) |
| 42572695994 | 1679bd7 | failure | success | failure (pgTAP NOTESTS + rollback) |
| 42573218628 | f32bdfb | failure | success | failure (pgTAP plans/fixtures) |
| 42657721875 | c269875 | failure | success | failure (FK post_reports) |
| 42658479918 | 0413a4c | failure | success | failure (contrainte support_tickets) |

Le job Application est vert depuis 91e951b (types, lint, 93 tests unitaires, build).

## Dernier run (vert)

- Run : https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810/actions/runs/42661132343
- Commit : 0d5e648
- Application : types, lint, 93 tests, build = success
- Base éphémère : 19 migrations, 10 suites pgTAP, rollback = success
