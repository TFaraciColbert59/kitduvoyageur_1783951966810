---
title: Architecture Frontend & Organisation React
aliases:
  - Frontend
  - Architecture Frontend
  - Structure Client
tags:
  - architecture
  - frontend
  - react
  - nextjs
updated: 2026-08-17
---

# 💻 ARCHITECTURE FRONTEND & ORGANISATION REACT

> [!abstract] **Structure modulaire dans `src/` basée sur les fonctionnalités métiers**

---

## 📁 Arborescence du Code Source

```text
src/
├── app/                  # Routes Next.js 15 App Router (page.tsx, layout.tsx, route.ts)
├── components/           # Composants partagés (layout, mobile-nav, ui, explore, shop)
├── constants/            # Constantes typées (catégories matériel, routes, clés)
├── contexts/             # Contextes React globaux (AuthContext, CartContext)
├── features/             # Modules métier encapsulés (gear, hikes, social)
├── hooks/                # Hooks personnalisés (useEquipment, useGeolocation, useHaptic)
├── lib/                  # Utilitaires & clients tiers (supabaseClient, stripe, utils)
├── styles/               # Styles CSS globaux et configurations Tailwind
└── types/                # Déclarations TypeScript partagées et types Supabase
```

---

## ⚡ Principes de Rendu

1. **RSC First (React Server Components) :** Les pages de contenu statique et d'exploration (`/explorer`, `/guides/[slug]`, `/pays/[code]`) sont générées côté serveur pour un SEO parfait et un temps de premier octet (TTFB) ultra-court.
2. **Client Components Délimités :** La directive `'use client'` est réservée aux feuilles de l'arbre de composants nécessitant de l'interactivité (formulaires, boutons avec retour tactile, gestion de session).
3. **Gestion d'État Hybride :**
   - État serveur : Requêtes Supabase directes avec cache ISR Next.js.
   - État local / offline : Custom Hooks avec persistance `localStorage` transparente.

---

> [!tip] **Pour continuer la lecture :**
> - Découvrir le côté serveur : [[Backend]]
> - Explorer les hooks et composants : [[Composants]]
