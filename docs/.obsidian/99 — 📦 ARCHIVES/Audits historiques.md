---
title: Archives — Synthèse des Audits Historiques
aliases:
  - Audits historiques
tags:
  - archives
  - audits
date: 2026-08-16
---

# 📜 ARCHIVES — SYNTHÈSE DES AUDITS HISTORIQUES

### 1. Audit Live du 06/08/2026 (Sécurité & Schéma)
- Mise en évidence de 7 tables de sentiers non verrouillées par RLS.
- Détection du prix non vérifié côté serveur dans `/api/checkout`.
- Détection de l'absence de la table `kit_reports`.
- *Statut au 17/08/2026 :* 100% de ces points ont été corrigés et validés par tests.

### 2. Audit Ergonomie Mobile du 12/08/2026
- Diagnostic du déversement horizontal sur smartphone (`overflow-x`).
- Mesure de l'adoption du `MobilePageShell` (73/76 pages, ~96%).
- Décision d'éliminer la `TopBar` pour maximiser la hauteur utile d'écran.

### 3. Audit Performance du 16/08/2026
- Identification du bridage WebGL pour le composant `CountryGlobe`.
- Mesure du LCP et passage de la redirection racine en HTTP 302 serveur (3ms).
