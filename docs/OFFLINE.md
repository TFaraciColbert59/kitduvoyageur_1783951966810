# Architecture Hors-Ligne & Synchronisation — LKDV

## 1. Vision & Fonctionnement Terrain
Sur le terrain alpin et en zone blanche (pas de réseau 4G/5G), LKDV garantit la disponibilité totale des informations critiques de voyage et permet la saisie d'actions locales sans perte de données.

---

## 2. Piliers Techniques

1. **Service Worker (`public/sw.js`)** :
   - Mise en cache préventive des pages de base (`/`, `/voyages`, `/equipages`, `/offline.html`).
   - Mise en cache Stale-While-Revalidate des flux API (`/api/voyages`, `/api/trips`).
   - Mise en cache Cache-First des tuiles cartographiques (`lkdv-tiles-v1`).
2. **Stockage Local des Voyages (`tripOfflineStorage.ts`)** :
   - Sauvegarde intégrale du voyage actif (étapes, coordonnées GPS, métadonnées, contacts d'urgence, matériel).
   - Manifeste local des expéditions prêtes pour le hors-ligne.
3. **File d'Attente de Synchronisation (`tripOfflineSyncQueue.ts`)** :
   - Enregistre localement les dépenses, notes de terrain et validations d'étapes.
   - Dépilement séquentiel automatique dès la reconnexion au réseau.
4. **Arbitrage des Conflits (LWW - Last-Write-Wins)** :
   - En cas d'édition concurrente entre plusieurs équipiers ou le serveur, la mise à jour la plus récente dans le temps (`updatedAt`) prévaut.
   - Un journal local immuable (`TripSyncJournal`) conserve l'historique complet de chaque arbitrage pour audit et transparence.
5. **Indicateur Visuel d'État (`TripSyncStatusIndicator.tsx`)** :
   - Présent sur le cockpit mobile et terrain, affichant en direct : *À jour*, *Synchronisation en cours...*, ou *X actions en attente*.
