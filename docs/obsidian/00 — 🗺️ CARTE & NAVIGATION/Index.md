---
title: Index Central — Le Kit du Voyageur
description: Cartographie générale et hub de navigation du coffre Obsidian LKDV
tags:
  - index
  - navigation
  - architecture
  - vue-d-ensemble
aliases:
  - Accueil
  - Map of Content
  - MOC
date: 2026-09-04
status: active
---

# 🗺️ Le Kit du Voyageur — Coffre Central de Connaissance

Bienvenue dans la base de connaissance vivante de **Le Kit du Voyageur (LKDV)**. Ce coffre regroupe l'exhaustivité de la documentation technique, produit, ergonomique et architecturale du projet.

> [!abstract] Mission de LKDV
> Permettre aux randonneurs, bikepackers et aventuriers en autonomie de composer, tester et optimiser leurs paquetages ultra-légers avec une précision chirurgicale, tant en ligne qu'au cœur des zones blanches les plus isolées.

---

## 🧭 Navigation par Domaines

```
docs/obsidian/
├── 00 — 🗺️ CARTE & NAVIGATION/      <- Vous êtes ici
├── 01 — 🎯 PRODUIT & VISION/          <- Raison d'être, cibles et roadmap
├── 02 — 🎒 MATÉRIEL & KITS/           <- Lignées, FieldSeal, configurateur unifié
├── 03 — 🎨 DESIGN SYSTEM & MOBILE/    <- Palette v2.0, gestes Apple HIG, tokens
├── 04 — 🏗️ ARCHITECTURE & BACKEND/   <- Next.js 15, Supabase, PWA offline, Stripe
├── 05 — 🛡️ SÉCURITÉ & INVARIANTS/     <- RLS, CI anti-dérive, RGPD
└── 06 — 📋 DÉCISIONS (ADR)/           <- Registre officiel des décisions d'architecture
```

### [[00 — 🗺️ CARTE & NAVIGATION/Dashboard|📊 00 — Tableau de Bord & Indicateurs]]
Vue d'ensemble de la santé du projet, des tests automatisés, des invariants CI et du statut de production.
- Visualiser le graphe visuel : [[00 — 🗺️ CARTE & NAVIGATION/Architecture.canvas|Architecture Interactive]]
- Consulter la base de données de notes : [[00 — 🗺️ CARTE & NAVIGATION/Base-De-Connaissance.base|Base de Connaissance Global]]

### [[01 — 🎯 PRODUIT & VISION/Vision & Proposition|🎯 01 — Produit & Vision]]
- [[01 — 🎯 PRODUIT & VISION/Vision & Proposition|Vision & Proposition de Valeur]] : Pourquoi LKDV redéfinit la préparation outdoor.
- [[01 — 🎯 PRODUIT & VISION/Roadmap 2026-2027|Feuille de Route & Jalons]] : Stratégie de déploiement des lots 1 à 6.
- [[01 — 🎯 PRODUIT & VISION/Personas & Usages|Personas & Cas d'Usage]] : Randonneur alpin, voyageur bikepacking, minimaliste ultra-léger.

### [[02 — 🎒 MATÉRIEL & KITS/Architecture Lignées|🎒 02 — Matériel & Kits]]
- [[02 — 🎒 MATÉRIEL & KITS/Architecture Lignées|Architecture des Lignées de Kits]] : Arbre généalogique des paquetages, filiation `forked_from`, trigger d'intégrité.
- [[02 — 🎒 MATÉRIEL & KITS/Épreuve du Terrain|L'Épreuve du Terrain]] : Protocoles de validation empirique en conditions hostiles.
- [[02 — 🎒 MATÉRIEL & KITS/Sceau FieldSeal|Sceau d'Authenticité FieldSeal]] : Algorithme de vérification terrain et certification communautaire.
- [[02 — 🎒 MATÉRIEL & KITS/Configurateur IA|Configurateur IA & Recommandation]] : Moteur unifié sur `materiel_kits` ([[06 — 📋 DÉCISIONS (ADR)/ADR-011-Migration-Configurateur-Materiel-Kits|ADR-011]]).
- [[02 — 🎒 MATÉRIEL & KITS/Base-Kits.base|Tableau Dynamique des Kits]] : Base de données des configurations types.

### [[03 — 🎨 DESIGN SYSTEM & MOBILE/Tokens & Palette v2|🎨 03 — Design System & Mobile]]
- [[03 — 🎨 DESIGN SYSTEM & MOBILE/Tokens & Palette v2|Tokens & Palette v2.0]] : Harmonie Vert Forêt (`#17402C`), Fond Pierre (`#FBFAF6`) et Sauge (`#EDF3ED`).
- [[03 — 🎨 DESIGN SYSTEM & MOBILE/Gestes Apple HIG|Gestes Apple HIG & Friction]] : Swipe-to-dismiss, feedback inertiel et safe-areas iOS.
- [[03 — 🎨 DESIGN SYSTEM & MOBILE/Composants Mobiles|Composants d'Itinérance]] : `KitSheetModal`, `WeightGauge`, navigation tactile.

### [[04 — 🏗️ ARCHITECTURE & BACKEND/Stack & Fondations|🏗️ 04 — Architecture & Backend]]
- [[04 — 🏗️ ARCHITECTURE & BACKEND/Stack & Fondations|Stack Technique & Fondations]] : Next.js 15, React 19, TypeScript strict.
- [[04 — 🏗️ ARCHITECTURE & BACKEND/BDD & Schéma|Base de Données Supabase]] : Schéma PostgreSQL, PostGIS, projet réel `icxyvwzfjbflcbqukpfz`.
- [[04 — 🏗️ ARCHITECTURE & BACKEND/Mode Hors-Ligne|Architecture Hors-Ligne & PWA]] : Cache Service Worker, IndexedDB et résilience en zone blanche.
- [[04 — 🏗️ ARCHITECTURE & BACKEND/Intégration Stripe|Flux de Paiement Stripe]] : Gestion des abonnements Pro et webhooks idempotents.

### [[05 — 🛡️ SÉCURITÉ & INVARIANTS/Politiques RLS|🛡️ 05 — Sécurité & Invariants]]
- [[05 — 🛡️ SÉCURITÉ & INVARIANTS/Politiques RLS|Politiques RLS (Row Level Security)]] : Isolation stricte multilocataire par utilisateur.
- [[05 — 🛡️ SÉCURITÉ & INVARIANTS/Invariants CI Anti-Dérive|Invariants CI & Garde-Fous]] : Script `ci_invariants.mjs` et détection des tokens interdits.
- [[05 — 🛡️ SÉCURITÉ & INVARIANTS/Données Privées & RGPD|Données Personnelles & RGPD]] : Chiffrement, consentement et export des données.

### [[06 — 📋 DÉCISIONS (ADR)/ADR-001-Architecture-Nextjs-Supabase|📋 06 — Architecture Decision Records (ADR)]]
Registre officiel et immuable des choix technologiques :
- [[06 — 📋 DÉCISIONS (ADR)/ADR-001-Architecture-Nextjs-Supabase|ADR-001 : Choix de la Stack Next.js & Supabase]]
- [[06 — 📋 DÉCISIONS (ADR)/ADR-002-Mode-Offline-PWA|ADR-002 : Stratégie Offline-First PWA]]
- [[06 — 📋 DÉCISIONS (ADR)/ADR-003-Design-System-Palette-v2|ADR-003 : Normalisation Palette v2.0]]
- [[06 — 📋 DÉCISIONS (ADR)/ADR-005-Gestion-Filiation-Lignees|ADR-005 : Filiation & Généalogie des Kits]]
- [[06 — 📋 DÉCISIONS (ADR)/ADR-006-Separation-Migrations-Gelees|ADR-006 : Isolation Physique du Lot 6]]
- [[06 — 📋 DÉCISIONS (ADR)/ADR-007-Unification-Table-Materiel-Kits|ADR-007 : Table Unique Vivante `materiel_kits`]]
- [[06 — 📋 DÉCISIONS (ADR)/ADR-010-Securisation-Triggers-Lignees|ADR-010 : Sécurisation Triggers Lignées]]
- [[06 — 📋 DÉCISIONS (ADR)/ADR-011-Migration-Configurateur-Materiel-Kits|ADR-011 : Migration Configurateur vers `materiel_kits`]]
- [[06 — 📋 DÉCISIONS (ADR)/Base-ADR.base|Vue Base de Données des ADRs]]

---

> [!tip] Règle de Contribution
> Toute modification substantielle du comportement, des interfaces ou du schéma de données doit faire l'objet d'un nouvel ADR dans `docs/obsidian/06 — 📋 DÉCISIONS (ADR)/` et d'une validation par la suite de tests automatisés (`npm test`).
