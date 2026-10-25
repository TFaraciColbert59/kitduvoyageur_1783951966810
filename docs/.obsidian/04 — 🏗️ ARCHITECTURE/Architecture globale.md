---
title: Architecture Globale du Système LKDV
aliases:
  - Architecture globale
  - Architecture Technique
  - Stack Technique
tags:
  - architecture
  - stack
  - tech
updated: 2026-08-17
---

# 🏗️ ARCHITECTURE GLOBALE DU SYSTÈME LKDV

> [!abstract] **Stack Moderne, Modulaire, Performante et Éco-conçue**
> L'architecture de LKDV repose sur le triptyque Next.js 15 (App Router) / React 19, Supabase (PostgreSQL + PostGIS) et Stripe pour les transactions, garantissant une montée en charge fluide et un coût d'infrastructure minimal.

---

## 🗺️ Diagramme d'Architecture

```mermaid
graph TD
    subgraph CLIENT ["1. CLIENTS (Web, PWA, Mobile)"]
        WEB["Navigateur Desktop & Mobile"]
        PWA["PWA Installable + Service Worker (sw.js)"]
    end

    subgraph NEXTJS ["2. SERVEUR NEXT.JS 15 (Node.js / Edge)"]
        RSC["React Server Components (SSR / ISR)"]
        CLIENT_COMP["React Client Components (Hydratation)"]
        API_ROUTES["Route Handlers (/api/*)"]
        MID["Middleware (Auth & Role Protection)"]
    end

    subgraph SUPABASE ["3. CLOUD SUPABASE (icxyvwzfjbflcbqukpfz)"]
        POSTGRES["PostgreSQL 15 (Tables & Relations)"]
        POSTGIS["Extension PostGIS (Géométrie & Traces)"]
        RLS_ENGINE["Row-Level Security Engine (Isolement)"]
        PLPGSQL["Fonctions Stockées & Triggers"]
        STORAGE["Storage Buckets (Photos & Avatars)"]
        AUTH_SERVICE["GoTrue Auth Service (JWT)"]
    end

    subgraph TIERS ["4. SERVICES TIERS"]
        STRIPE["Stripe API & Webhooks"]
        RESEND["Resend SMTP (Digests & Transactionnel)"]
        AI_LLM["Modèles IA (Vision & Chat)"]
    end

    %% Flux de données
    WEB --> MID
    PWA --> MID
    MID --> RSC
    MID --> CLIENT_COMP
    RSC --> POSTGRES
    CLIENT_COMP <--> API_ROUTES
    CLIENT_COMP <--> AUTH_SERVICE
    API_ROUTES <--> POSTGRES
    API_ROUTES <--> STRIPE
    API_ROUTES <--> RESEND
    API_ROUTES <--> AI_LLM
    POSTGRES --- POSTGIS
    POSTGRES --- RLS_ENGINE
    POSTGRES --- PLPGSQL
```

---

## 🛠️ Composants Clés de la Stack

| Brique | Technologie | Version | Rôle Principal |
| :--- | :--- | :---: | :--- |
| **Framework Web** | Next.js (App Router) | 15.x | Rendu hybride SSR/ISR, routing fichier, API route handlers |
| **Bibliothèque UI** | React | 19.x | Composants réactifs, Hooks, Suspense, Concurrent Mode |
| **Langage** | TypeScript | 5.x | Typage strict à 100%, zéro `any` toléré en production |
| **Styles** | TailwindCSS | 3.4 | Utilitaires CSS atomiques, thémage sur-mesure |
| **Animations** | Framer Motion | 11.x | Micro-interactions et transitions de route à 60fps |
| **Base de Données** | PostgreSQL + PostGIS | 15.x | Données relationnelles, calculs géospatiaux et grand livre |
| **Authentification** | Supabase Auth (GoTrue) | — | JWT, Sessions sécurisées, Magic Links, OAuth |
| **Paiements** | Stripe Elements & Webhook | — | Checkout e-commerce et gestion des abonnements |
| **Cartographie** | Leaflet / Mapbox GL | — | Rendu cartographique vectoriel et raster |
| **3D & Globe** | Three.js / WebGL | — | Rendu planétaire optimisé basse consommation |

---

> [!tip] **Pour continuer la lecture :**
> - Découvrir l'organisation du Frontend : [[Frontend]]
> - Découvrir l'organisation du Backend : [[Backend]]
> - Consulter l'inventaire des routes API : [[API]]
