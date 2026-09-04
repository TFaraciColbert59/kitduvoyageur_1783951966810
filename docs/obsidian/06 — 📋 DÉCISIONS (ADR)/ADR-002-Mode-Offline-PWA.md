---
title: ADR-002 — Stratégie Offline-First PWA & IndexedDB
aliases:
  - ADR-002
tags:
  - adr
  - architecture
  - offline
  - pwa
  - indexeddb
date: 2026-07-15
status: Accepté
---

# ADR-002 — Stratégie Offline-First PWA & IndexedDB

### Contexte
La majorité des activités outdoor (GR20, massifs alpins, traversées pyrénéennes) se déroulent en zone blanche totale (0 barre de réseau mobile). Une application qui exige une connectivité internet pour consulter ou modifier son sac à dos est inutilisable et dangereuse sur le terrain.

### Décision
Concevoir l'application comme une **PWA Offline-First** :
1. Mise en cache intégrale des ressources statiques (JavaScript, styles CSS, polices SF Pro) via un **Service Worker**.
2. Stockage et mutation locale de l'ensemble des paquetages et fiches matériel dans **IndexedDB**.
3. Réconciliation automatique des données (Sync Queue) dès que la connexion internet est rétablie, avec résolution de conflit par horodatage vectoriel.

### Conséquences
- **Positives :**
  - Fonctionnement nominal même en mode avion.
  - Temps d'accès ultra-court (< 300 ms) et fluidité maximale.
  - Résilience absolue face aux coupures de réseau.
- **Négatives :**
  - Complexité accrue de la gestion des états asynchrones et de la file d'attente de synchronisation.

### Liens & Références
- [[04 — 🏗️ ARCHITECTURE & BACKEND/Mode Hors-Ligne|Mode Hors-Ligne & Architecture PWA]]
- [[03 — 🎨 DESIGN SYSTEM & MOBILE/Composants Mobiles|Composants Mobiles]]