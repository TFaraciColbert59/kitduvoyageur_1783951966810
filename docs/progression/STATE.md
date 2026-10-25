# État de la branche `feat/mobile-direction-progression` — à lire en premier

Mise à jour : 20 septembre 2026 (session autonome de nuit). Worktree : `C:\Users\Tony\Downloads\LKDV\worktrees\lkdv-mobile-direction`.
**Aucun push, merge, déploiement ou publication store n'a été effectué.** Trois réparations additives de migrations préexistantes sont incluses (voir `LOCAL_DB_TESTING.md`).

## Ce qui est vérifié

| Preuve | Résultat |
|---|---|
| `npm test` | **2936 passés, 27 skipped, 0 échec** (406 fichiers) |
| `npm run type-check` / `npm run build` | 0 erreur / succès, 104 kB partagé |
| pgTAP (15 suites) sur base de travail **et** base neuve | **195/195** |
| Chaîne complète à froid (baseline + ~100 migrations) | 0 erreur |
| Base héritée : migration + réconciliation + rebuild | vérifié (archive, purge, solde économique intact) |
| Rollback (13 descentes) + remigration | vérifié |
| Contrastes WCAG | 42/42 |
| Revue sécurité (85 fonctions héritées) | 3 gardes ajoutées, 50+ révoquées, FK RGPD, privilèges nettoyés |
| Anti-triangulation 1 km (synthétique, flag OFF) | 10/10 |

## Décisions à connaître

- **Anglais désactivé par défaut** : `NEXT_PUBLIC_I18N_EN_ENABLED !== '1'` force `fr`. Ne pas activer avant traduction complète des surfaces (`docs/i18n/COVERAGE.md`).
- **Flag `local_leaderboard_active` OFF** : ne pas activer avant validation anti-triangulation sur téléphones réels.
- **Mapping hérité non branché** : `apply_legacy_level_mapping` existe mais n'est jamais appelée automatiquement.
- **Saisons** : ouverture/clôture manuelles (`OPERATIONS.md` §2bis) ; aucune automatisation.
- **Crons** : routes prêtes et protégées (`CRON_SECRET`) mais planification plateforme non configurée (`PERFORMANCE.md` §6).

## Portes restantes (dans l'ordre)

1. **Revue visuelle mobile avec captures** (390×844, 430×932, 768×1024, 1440×900) et régression visuelle (baselines à régénérer après revue).
2. **Validation iPhone/Android** (appareils réels) : safe areas, clavier, reprise arrière-plan, splash.
3. **Charge + canari** : scénario 2× sur environnement de test autorisé, puis 1 % → 5 % → 25 % → 100 %.

## Où regarder

- Cadrage et décisions : `docs/superpowers/specs/2026-09-19-lkdv-progression-canonique-direction-mobile-design.md`
- Preuves de lancement : `docs/progression/LAUNCH_READINESS.md`
- Producteurs (actifs/désactivés) : `docs/progression/PRODUCER_MATRIX.md`
- Exploitation (santé, crons, saisons, rétention) : `docs/progression/OPERATIONS.md`
- Performance (index, plans, cache, rate-limits) : `docs/progression/PERFORMANCE.md`
- Base de test locale : `docs/progression/LOCAL_DB_TESTING.md`
- i18n : `docs/i18n/COVERAGE.md` et `docs/i18n/CRITICAL_PATHS.md`
