# Documentation Maître — Le Kit du Voyageur (LKDV)

Bienvenue dans la documentation officielle et exhaustive de **Le Kit du Voyageur (LKDV)**. Elle couvre l'architecture technique, la base de données, les APIs, Explorer v2 (GIS 3D & télémétrie), tous les modules produit, le design system, l'onboarding/déploiement et les décisions d'architecture.

---

## Table des matières

| # | Dossier / Document | Contenu principal | Public |
| :---: | :--- | :--- | :--- |
| **01** | [Architecture Globale](01-architecture/ARCHITECTURE.md) | Stack Next.js 15 / React 19, diagrammes Mermaid, App Router, Middleware, Cloudflare Workers (`vinext`), Capacitor iOS/Android, Rust/WASM | Tech & Archi |
| **02** | [Base de Données Supabase](02-database-supabase/DATABASE.md) | PostgreSQL 17 + PostGIS, ERD Mermaid par domaine, Politiques RLS, Storage (8 buckets), Edge Functions, Migrations | Backend & Data |
| **03** | [Routes App & API REST](03-api-routes/API_AND_ROUTES.md) | Inventaire des 46 pages App Router, redirections (`routeRegistry.json`), 80+ namespaces `/api/*`, Auth & Cron | Fullstack |
| **04** | [Explorer v2 & GIS 3D](04-explorer-gis/EXPLORER_V2.md) | MapLibre GL + Three.js r186, HUD 6 onglets, Waymarked Trails, Route Planner, Tracker GPS, Studio Analyse Avancée (6 volets / 20+ moteurs) | GIS & Perf |
| **05** | [Modules Produit](05-modules-produit/MODULES.md) | Communauté V2 & Handoff universel, Carnets `[id]`, Clubs & Sorties, Messagerie, Boutique & Kit Studio, Profil / Sac / Progression XP | Produit & Dev |
| **06** | [Design System (Bible 4 volets)](06-design-system/DESIGN_SYSTEM.md) | Vérité unique `Carnets`/`Clubs`/`Communauté` : [Fondations](06-design-system/DESIGN_SYSTEM.md) · [Pilier Drawers](06-design-system/DRAWERS_AND_NAVIGATION.md) · [7 Blocs Canoniques](06-design-system/CANONICAL_BLOCKS.md) · [Gestes, Motion & Icônes](06-design-system/GESTURES_MOTION_ICONS.md) | UI / Frontend |
| **07** | [Opérations, Déploiement & Onboarding](07-operations-deploy/OPERATIONS.md) | Onboarding dev, variables d'environnement, builds 8 Go RAM, Cloudflare Workers, iOS/Android, GitHub Actions, Tests | DevOps & QA |
| **08** | [Décisions (ADR) & Glossaire](08-decisions-glossary/ADR_AND_GLOSSARY.md) | Architecture Decision Records (ADRs) et glossaire métier/technique complet | Tous |

---

## Fichiers de contexte IA (Racine)
- **[README.md](../README.md)** — Présentation globale et quickstart.
- **[CLAUDE.md](../CLAUDE.md)** — Règles strictes, invariants et pièges connus pour Claude Code / agents IA.
- **[AGENTS.md](../AGENTS.md)** — Protocole d'exécution multi-agents.
