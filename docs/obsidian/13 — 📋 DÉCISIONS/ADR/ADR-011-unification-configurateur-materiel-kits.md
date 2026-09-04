---
title: ADR-011 — Unification du Configurateur dans materiel_kits et Filiation
aliases:
  - ADR-011
tags:
  - adr
  - architecture
  - database
  - configurateur
  - lignees
date: 2026-09-04
status: Accepté
---

# ADR-011 — UNIFICATION DU CONFIGURATEUR DANS MATERIEL_KITS ET FILIATION

### Contexte
Le configurateur IA (`KitConfiguratorWizard.tsx`) et le configurateur classique (`ConfiguratorWizard.tsx`) permettaient aux randonneurs de composer des kits sur mesure. Auparavant, ces modules inséraient les kits exclusivement dans la table isolée `custom_kits` ou la table catalogue `kits`.
En parallèle, l'architecture vivante du domaine matériel et des lignées repose sur la table centrale `materiel_kits` (introduite dans `20260825000000_materiel_rebuild.sql` et enrichie par `20260903010000_kit_lineage.sql`).

### Problème (Bloqueur N°1)
1. Les kits configurés n'avaient pas de place dans le graphe de filiation relationnel.
2. Le trigger automatique de généalogie (`trg_materiel_kits_lineage`) ne se déclenchait jamais pour ces compositions.
3. La clé étrangère `kit_reports.kit_id` (qui pointe vers `materiel_kits(id)`) restait systématiquement à `NULL`.
4. Les articles configurés n'étaient pas transformés en items typés avec `item_key` généré pour la matrice de conservation.

### Décisions Architecturales

1. **Alimentation Principale de `materiel_kits` :**
   - Tout kit validé dans le configurateur IA ou classique insère une ligne dans `public.materiel_kits` avec :
     - `origin = 'configurateur'`
     - `season` normalisé vers l'énumération SQL valide (`'printemps'`, `'ete'`, `'automne'`, `'hiver'`, `'toute_saison'`)
     - `total_weight_g` calculé
   - Les articles sélectionnés sont enregistrés dans `public.materiel_kit_items`.
   - La colonne calculée `item_key` s'auto-génère immédiatement, reliant le kit à la matrice de conservation.

2. **Liaison `kit_reports.kit_id` :**
   - L'enregistrement dans `kit_reports` est lié immédiatement à `newMaterielKit.id`, fermant la boucle de traçabilité entre la session d'IA et le kit persistant.

3. **Maintien du Miroir Rétrocompatible (`custom_kits` / `kits`) :**
   - Pour ne casser aucun composant tiers ou legacy, l'écriture miroir dans `custom_kits` / `kits` est maintenue en tâche synchrone.

### Conséquences
- **Positives :** Résolution définitive du Bloqueur N°1. Les kits générés par les utilisateurs peuvent désormais être forké, éprouvés sur le terrain et intégrés aux statistiques régionales.
- **Négatives :** Double écriture temporaire dans la base lors de la configuration (nécessitera une dépréciation complète de `custom_kits` à terme).
