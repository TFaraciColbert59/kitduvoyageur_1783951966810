---
title: Registre des Décisions Techniques LKDV
aliases:
  - Décisions techniques
  - Choix Techniques
tags:
  - decisions
  - technical
  - architecture
updated: 2026-08-17
---

# ⚙️ REGISTRE DES DÉCISIONS TECHNIQUES LKDV

> [!abstract] **Les choix d'architecture logicielle et leurs rationales**

---

## 🛠️ Choix Fondateurs

1. **Next.js 15 App Router avec React 19 :**
   - *Choix :* Architecture full Server Components par défaut, avec des Client Components isolés pour l'interactivité.
   - *Rationale :* Temps de premier chargement divisé par 3 sur mobile et élimination de la surcharge JS inutile.
2. **Supabase PostgreSQL 15 + PostGIS au lieu d'une BDD NoSQL :**
   - *Choix :* Moteur relationnel strict avec PostGIS pour les 115 000+ segments de sentiers.
   - *Rationale :* Requêtes de proximité spatiale (`ST_DWithin`) ultra-rapides (< 5ms) et sécurité unifiée via RLS.
3. **Calcul de Prix Strict Côté Serveur (Checkout) :**
   - *Choix :* Interdiction absolue de faire confiance aux prix envoyés dans le corps des requêtes POST.
   - *Rationale :* Prévention des attaques d'altération de prix et conformité financière totale.

---

> [!tip] **Pour continuer la lecture :**
> - Découvrir les décisions UX : [[Décisions UX]]
> - Explorer la liste des ADRs : [[ADR/ADR-001-stack-technique\|ADR-001]]
