---
title: Système — Paiements Sécurisés & Stripe
aliases:
  - Paiements
  - Stripe Integration
  - Checkout
tags:
  - system
  - stripe
  - checkout
  - payments
updated: 2026-08-17
---

# 💳 SYSTÈME — PAIEMENTS SÉCURISÉS & STRIPE

> [!abstract] **Le tunnel d'achat certifié et sécurisé côté serveur**

---

## ⚡ Flux de Checkout Sécurisé

```mermaid
sequenceDiagram
    actor Client as Acheteur
    participant API as /api/checkout (Next.js)
    participant DB as PostgreSQL (shop_products)
    participant Stripe as Stripe API
    participant Hook as /api/stripe/webhook

    Client->>API: Envoie panier [{slug: "tente-1p", qty: 1}]
    Note over API,DB: Rejet formel du prix client !
    API->>DB: Récupère price_cents officiel en base
    DB-->>API: Prix unitaire : 24900 centimes
    API->>Stripe: Crée PaymentIntent avec montant certifié
    Stripe-->>Client: Affiche Stripe Elements
    Client->>Stripe: Confirme le paiement (Carte / Apple Pay)
    Stripe->>Hook: Événement `payment_intent.succeeded`
    Hook->>DB: Écrit la commande dans `orders` et décrémente le stock
```

---

> [!tip] **Pour continuer la lecture :**
> - Découvrir les permissions système : [[Permissions]]
> - Explorer la gestion des produits : [[07 — 🛒 COMMERCE/Produits\|Produits]]
