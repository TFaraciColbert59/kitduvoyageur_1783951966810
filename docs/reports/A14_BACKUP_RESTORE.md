# A14 — Sauvegarde / restauration / rollback réellement testés (local)

Date : 2026-09-11 · Environnement : **base Supabase locale** `supabase_db_ai-finalization`
(conteneur Docker) — **jamais la production, aucun accès distant**.
Script : `scripts/ops/a14_backup_restore_test.ps1` (exécuté, exit 0).
Preuve JSON : `%TEMP%\a14_backup_evidence.json` (hors dépôt, aucune donnée personnelle).

## 1. Procédure exécutée (sortie réelle)

```text
powershell -ExecutionPolicy Bypass -File scripts/ops/a14_backup_restore_test.ps1

==> conteneur local verifie : supabase_db_ai-finalization (running)
==> pg_dump complet de postgres (schema + donnees)
==> dump produit : 1465629 octets en 433 ms
==> creation de la base jetable a14_restore_test
==> pg_restore complet vers a14_restore_test
==> restauration complete : 0 erreur
==> comptages source/restauration identiques (tables, policies, fonctions, lignes cles)
==> suppression de la base jetable a14_restore_test
==> base jetable supprimee
==> rollback flags : test d'integration local (terrain_live OFF => 503, ON => pass-through, OFF => 503)
   tests/ops/a14-flag-rollback.integration.spec.ts (6 tests) — 6 passed
==> tous les flags sont OFF (etat par defaut restaure)
RESULTAT : SUCCES (sauvegarde restauree, base jetable supprimee, flags OFF)
```

Détail commandes (dans le conteneur local) :

```text
pg_dump  -U supabase_admin -d postgres -Fc --no-owner --no-privileges -f /tmp/a14_backup_restore.dump
psql     -U supabase_admin -d postgres -c "CREATE DATABASE a14_restore_test"
pg_restore -U supabase_admin -d a14_restore_test --no-owner --no-privileges /tmp/a14_backup_restore.dump
psql     -U supabase_admin -d postgres -c "DROP DATABASE IF EXISTS a14_restore_test"
```

**Finding opérationnel** : dans l'image Supabase locale, le rôle `postgres` n'est
pas superutilisateur (objets possédés par `supabase_admin`) ; une restauration
complète exige `-U supabase_admin`, sinon erreurs `permission denied` sur
`spatial_ref_sys`/`vault.secrets`. Les procédures prod doivent utiliser un rôle
disposant des mêmes droits (cf. A12_RUNBOOKS §4).

## 2. Vérifications de comptages (source vs restauration)

| Contrôle | Source | Restauré | Égal |
|---|---|---|---|
| Tables `public` | 223 | 223 | oui |
| Policies `public` | 629 | 629 | oui |
| Fonctions `public` | 1975 | 1975 | oui |
| Tables `auth` | 23 | 23 | oui |
| `feature_flags` | 8 | 8 | oui |
| `adventure_engine_runs` | 22 | 22 | oui |
| `adventure_plans` / `user_profiles` / `terrain_reports` / `hike_sessions` | 0 | 0 | oui |

Restauration : **0 erreur** (`pg_restore` exit 0), base jetable supprimée en fin
de test (vérifié : plus aucune base `a14_restore_test`).

## 3. RPO / RTO mesurés (chronos réels)

| Métrique | Valeur mesurée | Cible politique | Commentaire |
|---|---|---|---|
| RPO (fenêtre de perte potentielle) | **0,169 s** | ≤ 24 h | écart fin de dump → début de restauration (base au repos) |
| RTO (reprise) | **3,827 s** | ≤ 60 min | création base jetable + `pg_restore` complet + vérifications, sur base locale de 223 tables |
| Durée du dump | 0,433 s | — | 1 465 629 octets (schéma + données) |

Ces valeurs sont des mesures locales (conteneur, base quasi vide) : elles valident
la **procédure** et donnent un plancher. Les cibles prod (PITR Supabase, jeux de
données réels) restent à mesurer sur environnement de test dédié.

## 4. Rollback par flags — test réel exécuté

`tests/ops/a14-flag-rollback.integration.spec.ts` s'exécute **sur la base locale
réelle** (utilisateur jetable créé puis supprimé) — 6 tests verts :

| Test | Preuve |
|---|---|
| TEST-A14-FLAG-ROLLBACK-01 | utilisateur jetable + profil créés localement |
| TEST-A14-FLAG-ROLLBACK-02 | `terrain_live=false` ⇒ `POST /api/terrain/reports` = **503** |
| TEST-A14-FLAG-ROLLBACK-03 | `terrain_live=true` ⇒ route ouverte, **signalement réel inséré (201)** |
| TEST-A14-FLAG-ROLLBACK-04 | `UPDATE feature_flags SET enabled=false` ⇒ RPC confirme false ⇒ **503 de nouveau** |
| TEST-A14-FLAG-ROLLBACK-05 | flags shadow OFF ⇒ cron shadows = zéro échantillon lu |
| TEST-A14-FLAG-ROLLBACK-06 | suppression utilisateur ⇒ lignes absentes (cascades) |

Rollback SQL utilisé (sans déploiement) :

```sql
UPDATE public.feature_flags SET enabled = false, updated_at = now()
WHERE id = 'terrain_live';
```

État final vérifié : **tous les flags OFF** (`SELECT ... WHERE enabled = true` → 0 ligne).

## 5. Runbook de sauvegarde/restauration (local + prod)

1. **Local** : `npm run ops:backup-restore` (dump complet, base jetable `a14_*`,
   vérifications, suppression). Toujours vérifier `A14_BACKUP_RESULT` : `ok: true`.
2. **Prod** : sauvegardes gérées par la plateforme (PITR) ; test de restauration
   trimestriel sur **projet de test isolé** (jamais in-place), même grille de
   comptages (tables/policies/fonctions/lignes clés).
3. Consigner RPO/RTO mesurés à chaque exercice ; toute dérive > cible déclenche
   une revue d'infrastructure.
