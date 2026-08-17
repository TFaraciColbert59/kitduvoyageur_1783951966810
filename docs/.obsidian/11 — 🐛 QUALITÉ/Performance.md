---
title: Métriques Qualité & Benchmarks de Performance
aliases:
  - Performance Qualité
  - Benchmarks
  - Lighthouse
tags:
  - qa
  - performance
  - benchmarks
updated: 2026-08-17
---

# ⚡ MÉTRIQUES QUALITÉ & BENCHMARKS DE PERFORMANCE

> [!abstract] **Résultats d'audits Lighthouse et temps de réponse des APIs**

---

## 📊 Tableau des Temps de Réponse Mesurés

| Route / API | Type | Temps de Réponse Moyen | Stratégie de Cache |
| :--- | :---: | :---: | :--- |
| **`/` (Redirection accueil)** | HTTP 302 | **3 ms** | Redirection serveur instantanée |
| **`/explorer`** | SSR (RSC) | **45 ms** | Rendu serveur optimisé |
| **`/api/hikes`** | API JSON | **18 ms** | Cache ISR (60 secondes) |
| **`/mon-materiel`** | Client | **35 ms** | Hydratation rapide + Cache local |
| **`/api/kit-report/generate`** | IA / Calcul | **850 ms** | Inférence optimisée |

---

> [!tip] **Pour continuer la lecture :**
> - Découvrir le plan de tests : [[Tests]]
> - Explorer le contexte IA : [[12 — 🤖 IA/Contexte IA\|Contexte IA]]
