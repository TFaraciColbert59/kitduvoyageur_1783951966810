# Matrice des Permissions & RLS Unifiée — `lkv_can`

## 1. Principes Fondamentaux
La sécurité des équipages et des expéditions repose sur une fonction unifiée de contrôle d'accès :
- En SQL : fonction PostgreSQL `public.lkv_can(target_table, operation, record_id, user_id)`
- En TypeScript (Server Actions & SSR) : `lkvCan(table, operation, context)` dans `src/lib/security/permissions.ts`

Toutes les tables (`crews`, `crew_members`, `trips`, `trip_participants`, `trip_expenses`, `trip_documents`) appliquent des politiques RLS (Row Level Security) fondées sur ce moteur.

---

## 2. Rôles dans un Équipage (`crew_members`)

| Rôle | SELECT | UPDATE (Équipage) | INVITE | GÉRER TRIPS | SUPPRIMER ÉQUIPAGE |
|---|---|---|---|---|---|
| **`owner` (Capitaine/Fondateur)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **`organizer` (Co-organisateur)** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **`member` (Équipier actif)** | ✅ | ❌ | ❌ | Propres voyages | ❌ |
| **`guest` (Invité observateur)** | ✅ (Lecture seule) | ❌ | ❌ | ❌ | ❌ |

---

## 3. Rôles sur un Voyage (`trip_participants`)

| Rôle | Lire l'itinéraire | Éditer les étapes | Ajouter dépenses | Gérer documents sensibles |
|---|---|---|---|---|
| **`owner`** | ✅ | ✅ | ✅ | ✅ |
| **`organizer`** | ✅ | ✅ | ✅ | ✅ |
| **`member`** | ✅ | ✅ | ✅ | ❌ |
| **`guest`** | ✅ | ❌ | ❌ | ❌ |

---

## 4. Isolation Horizontale & Prévention des Attaques
- **Tentatives d'accès horizontales** : Tout accès direct par ID à un voyage non public sans participation active est immédiatement rejeté en DB par RLS avec résultat vide (`[]`) ou 404.
- **Documents d'identité** : Les pièces d'identité et passeports ne sont jamais lisibles par URL directe. Seules des URLs signées HMAC d'une durée maximale de 15 minutes sont délivrées aux participants autorisés.
