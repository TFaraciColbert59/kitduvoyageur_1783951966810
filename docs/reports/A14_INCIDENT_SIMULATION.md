# A14 — Incident simulé & runbooks (preuves exécutées, local)

Date : 2026-09-11 · Environnement : **base Supabase locale uniquement**.
Scénario : régression Terrain Live / file d'événements en retard, détectée par
le healthcheck, coupée par flag, vérifiée par route réelle, puis retour à l'état
sain. Toutes les étapes ci-dessous ont été exécutées et leurs sorties copiées.

## 1. Détection (alerte réelle)

Injection volontaire de 60 événements en attente vieux de 90 min (base locale
jetable), puis exécution du healthcheck :

```text
INSERT 0 60
node scripts/ops/a14_healthcheck.mjs
=== A14 healthcheck Adventure Intelligence (base locale) ===
Généré : 2026-09-11T20:34:13.787Z
File événements domaine : attente=60, échec=0, plus vieil en attente=90 min
ÉCHEC : file événements domaine : 60 en attente > 50
ÉCHEC : file événements domaine : plus vieil élément en attente depuis 90.0 min > 60
RÉSULTAT : DÉGRADÉ (2 seuil(s) dépassé(s)).
EXIT_DEGRADED=1
```

## 2. Mitigation (coupure par flag, sans déploiement)

Commande réelle appliquée sur la base locale :

```sql
UPDATE public.feature_flags
SET enabled = false, updated_at = now()
WHERE id = 'terrain_live';
```

Vérifications exécutées :

1. RPC `current_feature_flags` ⇒ `terrain_live = false` ;
2. route réelle `POST /api/terrain/reports` ⇒ **503 « Fonctionnalité non activée »** ;
3. après réactivation temporaire, route ouverte et signalement réellement inséré
   (201) — puis **rollback** : 503 de nouveau.

Preuve : `tests/ops/a14-flag-rollback.integration.spec.ts` (6 tests verts sur base
réelle) — TEST-A14-FLAG-ROLLBACK-02 (503), -03 (201 réel), -04 (rollback → 503),
-05 (shadow OFF ⇒ skip : zéro échantillon lu), -06 (nettoyage).

```text
npx vitest run tests/ops/a14-flag-rollback.integration.spec.ts
 ✓ 6 tests passed
```

## 3. Remise en état et vérification finale

```text
DELETE FROM public.adventure_domain_events WHERE event_type='a14.health.test';
DELETE 60
node scripts/ops/a14_healthcheck.mjs
File événements domaine : attente=0, échec=0, plus vieil en attente=0 min
RÉSULTAT : SAIN (tous les seuils respectés).
EXIT_HEALTHY=0
```

État final : `SELECT ... FROM feature_flags WHERE enabled = true` ⇒ **0 ligne**
(tous les flags OFF, état par défaut ADR-AI-008). Aucun utilisateur de test
résiduel (supprimé, cascades vérifiées).

## 4. Décision

- **Pas de lancement** : les flags restent OFF ; Terrain Live n'est pas activé
  tant que le rollout a15 n'est pas autorisé.
- L'incident simulé confirme la chaîne : **détection (healthcheck exit 1) →
  coupure par flag (503 immédiat) → vérification route → rollback → état sain**.
- Aucune donnée de production touchée ; aucune suppression destructive hors
  base locale jetable.

## 5. Runbooks exécutables (a14)

| Situation | Commande | Preuve attendue |
|---|---|---|
| Santé ops (files, moteurs, RPC) | `npm run ops:healthcheck` | exit 0 ; exit 1 si seuil dépassé (testé) |
| Sauvegarde + restauration + rollback (local) | `npm run ops:backup-restore` | `A14_BACKUP_RESULT ... "ok": true`, base `a14_restore_test` supprimée |
| Coupure d'une fonctionnalité | `UPDATE feature_flags SET enabled=false WHERE id=...` | route 503 (A12_RUNBOOKS §1-2) |
| Rollback flags vérifié sur base réelle | `A14_LOCAL_INTEGRATION=1 npx vitest run tests/ops/a14-flag-rollback.integration.spec.ts` | 6 tests verts, flags OFF |
| Export RGPD | `GET /api/account/export` (session requise) | JSON `a14-v1` téléchargeable |
| Suppression RGPD | `DELETE /api/account/delete` + confirmation exacte | 200 + résidus 0 ; 400/500 sinon |
| Incident RGPD | A12_RUNBOOKS §7 | gel flags, évaluation, CNIL < 72 h si fuite |

Rappels : jamais de DROP, migrations additives, flags OFF par défaut, gel du
palier de rollout (A9_ROLLOUT.md) en cas de seuil d'arrêt dépassé.
