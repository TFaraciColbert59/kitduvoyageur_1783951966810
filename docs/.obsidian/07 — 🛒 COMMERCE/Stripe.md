---
title: Commerce — Intégration Stripe & Tunnel de Vente
aliases:
  - Stripe
  - Passerelle de Paiement
  - Webhook Stripe
tags:
  - commerce
  - stripe
  - checkout
updated: 2026-08-17
---

# 💳 COMMERCE — INTÉGRATION STRIPE & TUNNEL DE VENTE

> [!abstract] **Paiements conformes PCI-DSS et gestion automatisée des commandes**

---

## ⚡ Événements Traités par le Webhook (`/api/stripe/webhook`)

1. **`checkout.session.completed` :** Crée l'enregistrement dans `orders`, injecte les lignes d'articles dans `order_items`, et réserve les stocks.
2. **`payment_intent.payment_failed` :** Journalise l'incident et envoie un email d'assistance à l'acheteur.
3. **`charge.refunded` :** Recrédite les stocks et ajuste les points dans le [[06 — 🔗 SYSTÈMES/Récompenses\|Reward Engine]].

---

> [!tip] **Pour continuer la lecture :**
> - Découvrir les groupes et la communauté : [[08 — 👥 COMMUNAUTÉ/Groupes\|Communauté & Groupes]]
