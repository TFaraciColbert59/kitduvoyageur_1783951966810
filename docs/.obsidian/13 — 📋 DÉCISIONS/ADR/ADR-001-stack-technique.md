---
title: ADR-001 — Choix de la Stack Technique Next.js 15 & Supabase
aliases:
  - ADR-001
tags:
  - adr
  - architecture
  - stack
date: 2026-07-10
status: Accepté
---

# ADR-001 — CHOIX DE LA STACK TECHNIQUE NEXT.JS 15 & SUPABASE

### Contexte
Le projet LKDV nécessite une plateforme web/mobile ultra-rapide, capable de gérer des données relationnelles complexes (matériel, commandes), des données géospatiales lourdes (traces GPS) et du contenu communautaire en temps réel.

### Décision
Adopter la stack :
- **Frontend :** Next.js 15 (App Router), React 19, TypeScript, TailwindCSS, Framer Motion.
- **Backend & Données :** Supabase (PostgreSQL 15 + PostGIS), Row Level Security, Edge Functions.
- **Paiement :** Stripe Elements & Webhooks.

### Conséquences
- **Positives :** Rendu serveur SSR immédiat, sécurité native par RLS, requêtes spatiales instantanées, coût d'hébergement très bas.
- **Négatives :** Nécessite une discipline stricte sur la séparation Client/Server Components et la gestion des politiques RLS.
