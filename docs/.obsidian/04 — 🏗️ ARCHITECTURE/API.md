---
title: Inventaire Exhaustif des Routes API LKDV
aliases:
  - API
  - Route Handlers
  - Endpoints
tags:
  - architecture
  - api
  - endpoints
updated: 2026-08-17
---

# 🌐 INVENTAIRE EXHAUSTIF DES ROUTES API LKDV

> [!abstract] **Les 25 Route Handlers du projet Next.js 15 (`src/app/api/`)**

---

## 📋 Tableau des Endpoints API

| Méthode | Route URL | Rôle & Traitement | Auth Requise | Tables / Services Liés |
| :---: | :--- | :--- | :---: | :--- |
| **POST** | `/api/checkout` | Création de session Stripe avec recalcul strict des prix côté serveur | Optionnel | `shop_products`, Stripe API |
| **POST** | `/api/stripe/webhook` | Réception sécurisée des événements de paiement Stripe | Secret Webhook | `orders`, `order_items` |
| **POST** | `/api/kit-report/generate` | Moteur d'inférence pour la génération de sac à dos personnalisé | Public | `kit_reports`, Modèle IA |
| **POST** | `/api/kit-report/save` | Sauvegarde persistante du rapport de kit | Requis | `kit_reports` |
| **POST** | `/api/kit-report/convert-inventory` | Injection des items d'un kit dans l'inventaire possédé | Requis | `gear_items` |
| **GET** | `/api/hikes` | Liste paginée des sentiers de randonnée avec filtres géographiques (ISR 60s) | Public | `hiking_routes`, `explore_trails` |
| **GET** | `/api/trails` | Récupération des segments de sentiers en format GeoJSON | Public | `trail_segments`, PostGIS |
| **POST** | `/api/hike-sessions` | Initialisation d'une session de randonnée active | Requis | `hike_sessions` |
| **PUT** | `/api/hike-sessions/[id]` | Enregistrement de la trace GPS finale et clôture | Requis | `hike_sessions` |
| **POST** | `/api/hike-sessions/[id]/narrative` | Génération IA du récit de randonnée à partir de la trace | Requis | Modèle LLM |
| **GET** | `/api/carnets/[id]` | Récupération des données d'un carnet et des moments multimédias | Public / Privé | `carnets`, `carnet_moments` |
| **POST** | `/api/carnet/identify-species` | Vision par ordinateur pour l'identification de faune / flore | Requis | Modèle Vision IA |
| **POST** | `/api/notifications/subscribe` | Enregistrement d'une souscription WebPush VAPID | Requis | `push_subscriptions` |
| **POST** | `/api/notifications/process` | Traitement de la file d'attente d'envoi de notifications | Service Role | `notification_deliveries`, Resend |
| **GET** | `/api/notifications/digest` | Déclencheur du digest email périodique | Cron Secret | Resend API, `user_preferences` |
| **GET** | `/api/notifications/vapid` | Récupération de la clé publique VAPID pour le navigateur | Public | Configuration VAPID |
| **POST** | `/api/rewards/claim` | Réclamation d'une récompense ou commission affiliée | Requis | `reward_transactions` |
| **POST** | `/api/rewards/withdraw` | Demande de retrait bancaire des gains cumulés | Requis (KYC) | `reward_withdrawals` |
| **GET** | `/api/admin/rewards` | Simulation financière et audit du grand livre pour l'admin | **Admin** | `reward_accounts` |
| **GET** | `/api/pays/[code]` | Données administratives et sentiers d'un pays | Public | `geo_countries`, Cache |
| **GET** | `/api/produit/neuf-check` | Vérification de stock neuf en temps réel | Public | `shop_products` |
| **GET** | `/api/produit/occasion-check` | Vérification de la disponibilité d'une annonce occasion | Public | `occasion_listings` |
| **GET** | `/api/produit/trust-score-check` | Calcul du score de confiance d'un vendeur | Public | `user_profiles`, `reviews` |
| **POST** | `/api/ai/chat-completion` | Assistant conversationnel de voyage outdoor | Requis | Modèle Chat IA |
| **POST** | `/api/trip-assistant` | Planificateur d'itinéraire assisté par IA | Requis | `hiking_routes`, IA |

---

> [!tip] **Pour continuer :**
> - Découvrir le moteur de base de données : [[Architecture BDD]]
> - Explorer la sécurité de l'authentification : [[Authentification]]
