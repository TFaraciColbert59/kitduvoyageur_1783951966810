---
title: Catalogue Exhaustif des Fonctionnalités LKDV
aliases:
  - Fonctionnalités
  - Features
  - Modules Fonctionnels
tags:
  - product
  - features
  - catalog
updated: 2026-08-17
---

# 📦 CATALOGUE DES FONCTIONNALITÉS LKDV

> [!info] **Matrice de statut des fonctionnalités réelles du projet**
> Chaque fonctionnalité est reliée à son écran, ses tables Supabase sous-jacentes et son niveau de maturité opérationnelle.

---

## 🧭 1. Navigation & Cartographie

| Fonctionnalité | Description | Écran | Tables / APIs | Statut |
| :--- | :--- | :--- | :--- | :---: |
| **Explorateur de Sentiers OSM** | Recherche, filtrage et affichage de 1 100+ routes de trek | `/explorer` | `hiking_routes`, `explore_trails` | 🟢 Fonctionnel |
| **Suivi Randonnée Active** | Écran temps réel : distance, allure, dénivelé, tracé GPS | `/randonnee-active` | `hike_sessions`, `trail_segments` | 🟢 Fonctionnel |
| **Détection Sortie Itinéraire** | Alerte par vibration si déviation > 50m de la trace | `/randonnee-active` | `/api/trails`, PostGIS `ST_DWithin` | 🟢 Fonctionnel |
| **Boussole & Azimut Digital** | Orientation plein air avec capteurs matériels | `/boussole` | API Navigateur DeviceOrientation | 🟢 Fonctionnel |
| **Globe 3D Géodonnées** | Visualisation planétaire des pays et continents | `/pays` | `geo_countries`, Three.js / WebGL | 🟢 Fonctionnel |

---

## 🎒 2. Équipement & Commerce Unifié

| Fonctionnalité | Description | Écran | Tables / APIs | Statut |
| :--- | :--- | :--- | :--- | :---: |
| **Mon Matériel (Inventaire)** | Gestion du sac perso, calcul du *Base Weight*, état d'usure | `/mon-materiel` | `gear_items`, `useEquipment` | 🟢 Fonctionnel |
| **Catalogue Boutique & Affiliation** | 80+ articles outdoor, fiches techniques, liens partenaires | `/produit/[slug]` | `shop_products`, `affiliate_offers` | 🟢 Fonctionnel |
| **Configurateur de Kits IA** | Questionnaire terrain et génération de rapports de sac | `/ai-configurator` | `kit_reports`, `/api/kit-report/generate` | 🟢 Fonctionnel |
| **Marketplace d'Occasion (C2C)** | Annonces de vente de matériel de seconde main | `/occasion` | `occasion_listings`, `gear_items` | 🟢 Fonctionnel |
| **Location & Prêts entre Membres** | Calendrier de réservation et gestion des prêts | `/location` | `gear_items` (champs loan) | 🟢 Fonctionnel |
| **Enchères Outdoor en Direct** | Système d'enchères sur matériel rare ou dédicacé | `/encheres` | `auction_listings`, `auction_bids` | 🟢 Fonctionnel |
| **Paiement Sécurisé Stripe** | Checkout validé côté serveur avec webhooks idempotents | `/checkout` | `/api/checkout`, Stripe API, `orders` | 🟢 Fonctionnel |

---

## 📸 3. Carnets de Voyage & Médias

| Fonctionnalité | Description | Écran | Tables / APIs | Statut |
| :--- | :--- | :--- | :--- | :---: |
| **Éditeur de Carnet de Terrain** | Création de récits étape par étape avec timeline | `/carnets/nouveau` | `carnets`, Supabase Storage | 🟢 Fonctionnel |
| **Moments Multimédias Géolocalisés** | Photos épinglées automatiquement sur la trace GPS | `/carnets/[id]` | `carnet_moments`, `ST_Point` | 🟢 Fonctionnel |
| **Reconnaissance IA Faune / Flore** | Identification d'espèces à partir des photos de trek | `/carnets/[id]` | `/api/carnet/identify-species` | 🟢 Fonctionnel |

---

## 👥 4. Communauté, Groupes & Clubs

| Fonctionnalité | Description | Écran | Tables / APIs | Statut |
| :--- | :--- | :--- | :--- | :---: |
| **Feed Social Mobile** | Flux de publications, likes optimistes et commentaires | `/communaute` | `posts`, `comments`, `likes` | 🟢 Fonctionnel |
| **Clubs Thématiques** | Espaces fermés/ouverts par région ou discipline | `/clubs/[id]` | `travel_groups`, `club_members` | 🟢 Fonctionnel |
| **Coordination d'Expédition** | Espace groupe privé avec membres et droits d'accès | `/groupes/[groupId]` | `travel_groups`, `group_members` | 🟢 Fonctionnel |
| **Partage de Frais (Tricount)** | Calcul d'équilibre financier entre participants | `/groupes/[groupId]` | `group_expenses` | 🟢 Fonctionnel |
| **Sondages Décisionnels** | Votes sur les choix d'itinéraire et dates | `/groupes/[groupId]` | `group_polls`, `group_poll_votes` | 🟢 Fonctionnel |
| **Modération & Signalements** | File de modération et alertes abus | `/admin` | `comment_reports` | 🟢 Fonctionnel |

---

## 💰 5. Monétisation & Notifications

| Fonctionnalité | Description | Écran | Tables / APIs | Statut |
| :--- | :--- | :--- | :--- | :---: |
| **Reward Engine (Grand Livre)** | Rémunération créateurs, ledger immuable et retraits | `/recompenses` | `reward_transactions`, `reward_accounts` | 🟢 Fonctionnel |
| **Système Multi-Canal de Notifs** | In-app, push navigateur (VAPID) et digests email Resend | `/alertes` | `notification_deliveries`, `public.notify` | 🟢 Fonctionnel |
| **Alertes SOS & Urgences** | Notification prioritaire envoyée aux contacts désignés | `/randonnee-active` | `/api/notifications/process` | 🟢 Fonctionnel |

---

> [!tip] **Pour poursuivre :**
> - Consulter le plan de déploiement futur : [[Roadmap]]
> - Explorer le schéma de données : [[Tables]]
