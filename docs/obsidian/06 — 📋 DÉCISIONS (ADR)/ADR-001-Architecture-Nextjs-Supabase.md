---
title: ADR-001 — Choix de la Stack Technique Next.js 15 & Supabase
aliases:
  - ADR-001
tags:
  - adr
  - architecture
  - stack
  - nextjs
  - supabase
date: 2026-07-10
status: Accepté
---

# ADR-001 — Choix de la Stack Technique Next.js 15 & Supabase

### Contexte
Le projet **Le Kit du Voyageur (LKDV)** nécessite une plateforme web et mobile hautement réactive, capable de gérer des données relationnelles denses (paquetages, inventaires, fiches matériel), des données géospatiales volumineuses (traces GPX, calcul d'itinérance) et du contenu communautaire en temps réel, tout en garantissant un fonctionnement fluide en conditions d'itinérance montagnarde.

### Décision
Adopter la stack technologique suivante :
- **Frontend :** Next.js 15 (App Router), React 19, TypeScript strict, Tailwind CSS (Palette v2.0).
- **Backend & Base de Données :** Supabase (PostgreSQL 15 + extension PostGIS), Row Level Security (RLS) multilocataire, Edge Functions.
- **Paiement & Abonnements :** Stripe Elements & Webhooks sécurisés par HMAC.

### Conséquences
- **Positives :**
  - Rendu hybride rapide (Server Components pour le SEO et le premier affichage, Client Components pour les gestes tactiles Apple HIG).
  - Sécurité native au niveau de la base de données via les [[05 — 🛡️ SÉCURITÉ & INVARIANTS/Politiques RLS|Politiques RLS]].
  - Traitement spatial natif des traces d'itinérance pour le [[02 — 🎒 MATÉRIEL & KITS/Sceau FieldSeal|Sceau FieldSeal]].
  - Coûts d'infrastructure minimisés et excellente scalabilité.
- **Négatives :**
  - Exigence d'une discipline de fer sur la frontière Client/Server Components et la gestion rigoureuse des sessions d'authentification.

### Liens & Références
- [[00 — 🗺️ CARTE & NAVIGATION/Index|Index Central]]
- [[04 — 🏗️ ARCHITECTURE & BACKEND/Stack & Fondations|Stack & Fondations]]
- [[04 — 🏗️ ARCHITECTURE & BACKEND/BDD & Schéma|BDD & Schéma]]