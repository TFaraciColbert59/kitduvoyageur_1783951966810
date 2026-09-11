# A12 — Runbooks d'exploitation (P2 · Généralisation)

Date : 2026-09-11 · Statut : plan opérationnel (exécution humaine requise avec accès infra)

## 1. Rollback applicatif

```text
1. Flags : UPDATE feature_flags SET enabled = false WHERE id IN (...);  -- immédiat, sans déploiement
2. Vérifier la reprise V1 : copilote 15 min/km, plan sans personnalisation, terrain masqué
3. Déployer le commit précédent si nécessaire (Vercel : promote previous deployment)
4. Aucun DROP : toutes les migrations A sont additives et compatibles N-1
5. Consigner l'incident dans docs/reports/
```

## 2. Rollback par flag (par fonctionnalité)

| Flag | Coupe |
|---|---|
| `performance_profile_v2` | profil appris (fallback générique/standard) |
| `route_prediction_v2` | ETA personnalisée (fallback standard) |
| `collective_intelligence` | cron d'agrégation (aucune écriture d'agrégat) |
| `terrain_live` | APIs Terrain Live (503 propre) + UI |
| `*_shadow` | runners de comparaison |

## 3. Dead-letter queues

| File | Détection | Reprise |
|---|---|---|
| `hike_sessions.processing_status='dead_letter'` | `processing_attempts >= 5` | corriger la cause, repasser en `pending` + `next_retry_at = now()` |
| `adventure_domain_events.status='failed' AND attempts >= 5` | claim cesse de reprendre | rejouer manuellement après correctif (`attempts = 0, status='pending'`) |
| `offline_*_queue` (client) | `attempts >= 8` | purge locale proposée à l'utilisateur ; jamais de suppression silencieuse serveur |

## 4. Restauration / sauvegarde

```text
1. Supabase : vérifier la restauration PITR sur un projet de test (jamais in-place)
2. pg_dump quotidien vérifié : supabase db dump --db-url <copie> -f backup-$(date).sql
3. Test de restauration mensuel sur base jetable (procédure ci-dessous) :
   docker run postgres:17 → psql < backup.sql → SELECT count(*) sur les tables critiques
4. Documenter RPO/RTO réels observés
```

**A14 — exécuté localement** : `npm run ops:backup-restore` (dump complet →
base jetable `a14_*` → `pg_restore` 0 erreur → comptages → suppression → rollback
flags). RPO mesuré 0,169 s ; RTO mesuré 3,827 s. Détail : `A14_BACKUP_RESTORE.md`.
Attention : dans l'image locale, restaurer avec `-U supabase_admin` (le rôle
`postgres` n'est pas superutilisateur).

## 5. Rotation des secrets

- `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `CRON_SECRET`, clés IA : rotation trimestrielle,
  via le gestionnaire d'environnement (jamais dans le dépôt) ; après rotation, redéployer.
- Vérifier qu'aucune clé n'est présente dans `src/` (`rg 'eyJ|sk-' src` doit rester vide).

## 6. Dashboards & alertes minimaux

- Erreurs API 5xx par route (seuil 1 % sur 15 min).
- `ai_jobs`/`adventure_domain_events` : profondeur de file + âge du plus vieux `pending`.
- Latence `a5_terrain_reports_near` (p95 < 300 ms sur rayon 5 km).
- Coût IA : compteur `ai_usage_daily` vs budget ; fallback rate (doit monter, plan doit rester servi).
- Batterie mobile : temps de recalcul effectif (anti-rebond 60 s respecté).

**A14 — exécutable** : `npm run ops:healthcheck` interroge la base locale et sort
0/1/2 (files, âge, ratio d'échecs moteurs, latence RPC). Seuils documentés et
testés : `A14_OBSERVABILITY.md` (§4-5).

## 7. Incident — procédure courte

```text
1. Geler le rollout (flags OFF si concerné)
2. Évaluer l'impact données (RLS, santé, localisation) — si fuite : notification CNIL sous 72 h
3. Capturer les preuves (logs, requêtes, versions) avant correction
4. Corriger + test de non-régression dédié
5. Post-mortem écrit + mise à jour des seuils d'arrêt (A9_ROLLOUT.md)
```

## 8. Budgets

- IA : plafond quotidien par utilisateur (quota existant) + plafond global ; cache d'abord.
- Cartographie : tuiles mises en cache, viewports bornés (`get_routes_for_map`), jamais de dataset complet.
- PostGIS : requêtes indexées uniquement (`EXPLAIN` documenté, lot 10.2).
