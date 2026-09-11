# A14 — Ops & conformité · Rapport d'exécution (preuves réelles, local/test uniquement)

Date : 2026-09-11 · Worktree : `worktrees/ai-finalization` (branche `audit/adventure-intelligence`)
Environnement : Supabase local `supabase_db_ai-finalization` (127.0.0.1:54322) — **aucune
production, aucun PII réel, aucun push distant**.

## Statut global

| Livrable | Statut | Preuve principale |
|---|---|---|
| 1. Observabilité + healthcheck | Fait | `scripts/ops/a14_healthcheck.mjs` exécuté (exit 0/1/2), alerte locale dégradée→saine, `docs/reports/A14_OBSERVABILITY.md` |
| 2. Sauvegarde/restauration/rollback | Fait | `scripts/ops/a14_backup_restore_test.ps1` exit 0 (dump+restore 0 erreur, 223 tables/629 policies/1975 fonctions identiques), RPO 0,169 s / RTO 3,827 s, `docs/reports/A14_BACKUP_RESTORE.md` |
| 3. RGPD export/suppression/registre | Fait | routes `GET /api/account/export` + `DELETE /api/account/delete` testées (mock + intégration locale), `docs/reports/A14_GDPR.md` |
| 4. Modération/anti-abus/audit sécurité | Fait | findings SEC-A14-01/02/03 corrigés, 19 tests `TEST-A14-ABUSE-*`, `docs/reports/A14_SECURITY_AUDIT.md` |
| 5. Runbooks + incident simulé | Fait | incident local exécuté (détection→flag→503→rollback→sain), `docs/reports/A14_INCIDENT_SIMULATION.md` |

## Vérifications finales (exécutées)

```text
npm run test            → 280 fichiers passés / 2020 tests passés / 16 skippés (intégration gatée env)
npm run type-check      → exit 0
npm run lint            → exit 0 (warnings préexistants uniquement)
npm run verify:invariants → SUCCÈS (tous les invariants)
pgTAP                    → aucun test ajouté (aucune migration) — base non modifiée
flags                    → tous OFF (collective_intelligence=false, terrain_live=false, ... x8)
utilisateurs jetables    → 0 restant ; bases a14_* → 0 ; dump local supprimé
```

## Détail des preuves exécutées

1. **Healthcheck réel** : `node scripts/ops/a14_healthcheck.mjs` sur la base locale :
   23 runs moteurs (17 succès, 6 skipped, 0 échec, p95 2 ms), files vides,
   latence RPC `current_feature_flags` 0,59 ms → exit 0. Injection de 60 événements
   en attente (90 min) → 2 seuils dépassés → **exit 1** ; nettoyage → **exit 0**.
   Tests de codes de sortie : 7 verts.
2. **Sauvegarde/restauration** : `npm run ops:backup-restore` → dump 1 465 629 octets
   (433 ms), `pg_restore` 0 erreur (3 827 ms), comptages source=restauré
   (223/223 tables, 629/629 policies, 1975/1975 fonctions, 22/22 engine runs),
   base `a14_restore_test` supprimée, flags OFF vérifiés.
3. **Rollback flags réel** : 6 tests d'intégration sur base locale — 503 (OFF) →
   201 avec signalement réellement inséré (ON) → 503 (rollback) ; shadows →
   zéro échantillon lu ; suppression ⇒ cascades.
4. **RGPD réel** : utilisateur jetable → export 200 complet (profil + 18 tables +
   plan/versions/décisions/runs) ; confirmation erronée ⇒ 400 données intactes ;
   suppression exacte ⇒ 200 + zéro donnée résiduelle ; export post-suppression ⇒
   profil null, compteurs 0.
5. **Garde-fous production** : le healthcheck refuse tout DSN non local
   (TEST-A14-OPS-HEALTH-04) ; les tests d'intégration lèvent sur URL non locale.
6. **Correctifs sécurité** : bbox GeoJSON bornée (RPC réelle revérifiée 200),
   secrets HMAC d'invitation/document fail-closed (plus de constante publique).

## Limites / actions humaines (non bloquantes code)

- Validation juridique RGPD (textes, AIPD « non requise en l'état » à confirmer,
  DPO à désigner) — checkpoint humain roadmap a14.
- 5xx/dashboards : instrumentation plateforme à brancher (seuils documentés).
- Rate limiting distribué (remplacer les seaux en mémoire) avant a15.
- Rétention des sauvegardes prod (PITR) et test trimestriel sur projet isolé.

## Commits

1. `feat(ops): A14 healthcheck, sauvegarde/restauration et rollback prouvés en local`
2. `feat(gdpr): A14 export et suppression de compte réellement testés + registre`
3. `fix(security): A14 bornage GeoJSON et secrets HMAC fail-closed`
