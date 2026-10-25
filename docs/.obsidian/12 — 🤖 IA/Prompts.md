---
title: Bibliothèque de Prompts Certifiés LKDV
aliases:
  - Prompts
  - Prompt Templates
  - Instructions Types
tags:
  - ai
  - prompts
  - templates
updated: 2026-08-17
---

# 📝 BIBLIOTHÈQUE DE PROMPTS CERTIFIÉS LKDV

> [!abstract] **Modèles d'instructions pré-calibrés pour le développement, le refactoring et l'audit**

---

### Prompt Type 1 : Refactoring de Composant Mobile
```text
Refactorise le composant [NomComposant] dans LKDV :
1. Assure-toi qu'il utilise les tokens Forest (#17402C), Sage (#A3C4A3) et Stone (#FBFAF6).
2. Ajoute un retour haptique au clic via `useHapticFeedback()`.
3. Élimine tout saut d'affichage (CLS) en utilisant des dimensions explicites ou des Skeletons.
4. Valide que le code compile sans aucune erreur TypeScript (`npm run build`).
```

---

### Prompt Type 2 : Ajout d'une Migration Supabase Sécurisée
```text
Crée une migration SQL pour la table [nom_table] :
1. Active impérativement `ENABLE ROW LEVEL SECURITY`.
2. Définis les politiques SELECT, INSERT, UPDATE, DELETE selon la matrice RBAC LKDV.
3. Si la table contient des colonnes géographiques, utilise le SRID 4326 et crée un index GIST.
4. Fixe `SET search_path = public, pg_temp;` sur toutes les fonctions créées.
```

---

> [!tip] **Pour continuer la lecture :**
> - Découvrir les règles permanentes : [[Règles Antigravity]]
> - Explorer les automatisations CI/CD : [[Automatisations]]
