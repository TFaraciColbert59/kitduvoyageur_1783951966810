# Runbook d'Exploitation & Maintenance — LKDV

## 1. Procédures de Déploiement & Portes Qualité
Avant tout déploiement en production, exécuter la chaîne complète des portes de qualité :
```bash
# 1. Validation des types
npm run type-check

# 2. Analyse statique
npm run lint

# 3. Suite complète de tests unitaires et intégration (762+ tests)
npm test

# 4. Compilation de production Next.js
npm run build

# 5. Suite navigateur Playwright
npx playwright test scripts/e2e/voyage.spec.ts
```

---

## 2. Procédures de Rollback

### Rollback Base de Données (Migrations Supabase)
En cas d'anomalie sur le modèle de données :
- Migration `20260907000000_unify_crews_trips_rls.sql` : Appliquer le script `down` associé pour restaurer les tables antérieures sans interruption.
- Les données historiques sont conservées dans les tables archivées et les vues de compatibilité (`travel_groups_legacy`).

### Rollback Applicatif (Git)
Pour revenir à l'état stable précédent :
```bash
git checkout main
git revert HEAD -m 1
git push origin main
```

---

## 3. Gestion des Incidents Courants

### A. Désynchronisation Hors-Ligne
- **Symptôme** : Des actions locales restent en attente dans le badge de synchronisation.
- **Diagnostic** : Vérifier `localStorage.getItem('lkdv_trip_offline_queue_v1')`.
- **Résolution** : Cliquer sur le badge pour forcer le flush ou appeler `flushTripOfflineQueue(tripSlug)` depuis la console.

### B. Erreur d'Authentification ou de Permissions (403 RLS)
- **Symptôme** : Requête Supabase retournant un tableau vide sur un équipage ou un voyage privé.
- **Diagnostic** : Vérifier que l'utilisateur est bien listé dans `crew_members` ou `trip_participants` avec un statut `active`.
- **Résolution** : Utiliser la fonction SQL `SELECT public.lkv_can('trips', 'select', trip_id, user_id)` pour auditer le droit d'accès.

### C. Purge du Cache Service Worker
Pour forcer le rafraîchissement des assets chez les utilisateurs :
- Incrémenter `CACHE_VERSION` dans `public/sw.js` (ex: `lkdv-v3`).
