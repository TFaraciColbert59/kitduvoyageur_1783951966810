# PHASE 5 — Plan de rollback

**Date :** 2026-09-12
**Branche :** `feat/phase5-kit-complet` (base `59e30946`)
**Principe :** revert applicatif simple ; migration **additive** laissable (colonnes sans effet si plus alimentées) ; aucun objet destructif.

## 1. Application

- `git revert 5bf5b02` (implémentation) puis revert du commit docs si nécessaire : la chaîne Phase 3 revient exactement à l'état `59e30946` (kit créé depuis la couche kit, poids `null`, sans ownership/raison).
- Aucune donnée migrée : les kits/voyages déjà créés restent des objets normaux. Les colonnes ajoutées restent présentes mais ignorées par l'ancien code (aucun `NOT NULL` nouveau sur des colonnes lues ailleurs).
- Aucune bascule de feature flag nécessaire : tout est appliqué au fil de la création de voyage.

## 2. BDD (additive, laissable)

Colonnes ajoutées (aucune suppression de donnée, aucun changement de type) :

```text
trip_items         : ownership (DEFAULT 'personal'), owner_id, condition, reason
materiel_kit_items : ownership, owner_id, condition, reason, priority (DEFAULT 'recommended'), is_vital (DEFAULT false)
```

- Les politiques RLS n'ont **pas** été modifiées : aucun risque d'ouverture/fermeture.
- Désactivation d'urgence sans rollback SQL : ne pas alimenter les colonnes (l'ancien code les ignore). Sinon, `DROP COLUMN IF EXISTS` est possible mais **non recommandé** (perte des métadonnées déjà saisies par les utilisateurs).
- Ré-application : `npx supabase migration up --local` est idempotent (`{"applied":[]}` au rejeu).

## 3. UI / Storage

- Revert de `TripKitView.tsx` : les chips/badges/modale disparaissent, le sac reste lisible (les champs BDD inutilisés ne cassent rien).
- Revert de `MediaUpload.tsx` + `mediaUploadPath.ts` : retour à l'ancien comportement (URL publique sur bucket privé = **bug connu** ; ne pas reverter sans raison, ou retirer le composant du flux).

## 4. Snapshots visuels

Si le rollback change le rendu du hub, régénérer les baselines Linux via le workflow
`visual-regression.yml` (`workflow_dispatch` + `update_snapshots=true`) sur la branche concernée.
Baselines probablement impactées par cette phase (avant rollback) : `y-long-group-kit-{desktop-chrome,ipad-portrait,iphone-14-pro}-{linux,win32}.png` (6 fichiers).

## 5. Production

Migrations **non poussées** en distant à ce stade (Phase 1 non provisionnée). Rollback trivial : ne pas déployer. Si la migration était appliquée en préproduction puis rollback applicatif : conserver les colonnes (inertes) et ne pas toucher aux données utilisateurs.
