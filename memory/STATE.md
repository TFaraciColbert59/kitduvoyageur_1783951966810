# STATE.md — État Vivant & Pile de Pivots LKDV
<!-- Budget max : 80 lignes | Mis à jour automatiquement en fin de tâche ou lors d'un pivot -->
_Dernière mise à jour : 2026-11-28_

## Focus Actuel
- **Hub 2100 (`/hub`)** refondu, modularisé et validé en live (`390×844` + `1440×900`, 0 erreur, 81/81 tests Hub PASS) : Command Bar Liquid Glass + Readiness Ring SVG (`cockpitReadiness.ts`), Bento Spatial, Drawer unifié Bible Design (Capsule 8 volets haut + sous-volets icônes bas-droite + zéro `×`), bridge social in-place lazy (`HubSocialBridge`), fallback météo MET Norway, et dock desktop Liquid Glass centré.
- **Environnement `~/LKDV/`** + **BillyBoy** + **Wiki IA** + **Bible Design 5 volets** + **README Investisseur** synchronisés sur `origin/main`.
- **Prochaine étape prévue** : Construction de la bibliothèque de skills & patterns dans `~/LKDV/library/` ou prochain pivot produit.

## Tâches en Pause (Reprise Rapide après Pivot)
- **Explorer v2** (en pause volontaire) : 6 onglets + Studio Analyse Avancée 6 volets + Handoff universel livrés & vérifiés. Améliorations naturelles futures : ouvrir `*FormV2` / `PostSharePanel` **en drawer sur place** depuis `ExplorerSummarySheet`, et mapper `'rando'` sans `variantId` dans `resolveActivityProfile`.
- **Supabase revue ultérieure** : 5 tables sans appelant `src/` contenant des données (`activity_catalog_metrics`, `user_documents`, `user_addresses`, `segment_condition_buckets`, `club_reports`) + optimisation Draco/WebP des 6 GLB lourds dans `bag-models` (208 Mo).

## Slots Multi-Agents Actifs (`~/LKDV/worktrees/`)
- _(Aucun slot parallèle ouvert — utiliser `~/LKDV/scripts/spawn-agent-slot.sh <nom>` pour en créer un.)_
