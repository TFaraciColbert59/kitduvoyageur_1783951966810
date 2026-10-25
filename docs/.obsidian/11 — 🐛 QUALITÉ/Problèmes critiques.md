---
title: Problèmes Critiques & Bloquants LKDV
aliases:
  - Problèmes critiques
  - Bloquants
  - P0
tags:
  - qa
  - critical
  - p0
updated: 2026-08-17
---

# 🔴 PROBLÈMES CRITIQUES & BLOQUANTS LKDV

> [!abstract] **Le registre des urgences absolues (P0 / P1)**
> Tout élément listé dans ce document doit être traité avant tout nouveau développement de fonctionnalité.

---

## 🚦 État des Lieux des Bloquants

### 1. 🟢 Sécurité & Checkout (Anciennement P0 — Résolu)
- **Anomalie :** Vulnérabilité de falsification de prix au checkout et écritures non autorisées sur les tables PostGIS.
- **Résolution :** Validations serveur strictes et RLS appliqués sur les 86 migrations Supabase.

### 2. 🟠 Optimisation LCP Mobile (Actuel P1 — En cours)
- **Anomalie :** Le temps de chargement du plus grand élément visible (LCP) dépasse 2.5 secondes sur réseau mobile 4G bridé.
- **Impact :** Risque de dégradation du taux de conversion et du score SEO Google PageSpeed.
- **Plan de résolution :** Préchargement des polices Inter/Söhne, conversion WebP systématique, et attribut `priority` sur les balises `<Image />` du dessus de la ligne de flottaison.

---

> [!tip] **Pour continuer la lecture :**
> - Découvrir le backlog de refactoring : [[Dette technique]]
> - Explorer les audits de sécurité : [[Sécurité]]
