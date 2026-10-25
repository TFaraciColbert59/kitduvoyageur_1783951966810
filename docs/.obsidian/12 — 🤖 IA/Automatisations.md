---
title: Automatisations, CI/CD & Déploiements LKDV
aliases:
  - Automatisations
  - CI-CD
  - GitHub Actions
tags:
  - ai
  - automation
  - cicd
  - github-actions
updated: 2026-08-17
---

# ⚙️ AUTOMATISATIONS, CI/CD & DÉPLOIEMENTS LKDV

> [!abstract] **Le pipeline d'intégration continue et de livraison continue**

---

## ⚡ Les 3 Workflows Automatisés

1. **Vérification de Build (GitHub Actions) :**
   - Déclenché à chaque `push` ou `pull_request` sur la branche `main`.
   - Exécute `npm run lint` et `npm run build` pour stopper toute régression TypeScript.
2. **Audit SEO & Performance Automatisé :**
   - Surveillance de la dérive des balises SEO (titres, meta descriptions, canonicals) via le skill `seo-drift`.
3. **Synchronisation des Schémas Supabase :**
   - Déploiement des fichiers `.sql` de `supabase/migrations/` via `npx supabase db push`.

---

> [!tip] **Pour continuer l'exploration :**
> - Découvrir le registre des décisions techniques : [[13 — 📋 DÉCISIONS/Décisions techniques\|Décisions & ADRs]]
