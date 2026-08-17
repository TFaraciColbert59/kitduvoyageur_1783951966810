---
title: Commerce — Gestion des Stocks & Logistique
aliases:
  - Inventaire Commerce
  - Stocks
  - Logistique
tags:
  - commerce
  - inventory
  - stock
updated: 2026-08-17
---

# 📦 COMMERCE — GESTION DES STOCKS & LOGISTIQUE

> [!abstract] **Suivi en temps réel des disponibilités et réapprovisionnements**

---

## ⚡ Gestion dans l'Espace Admin (`/admin/produits`)

- **Colonnes de Stock :** `stock_quantity` (unités disponibles en entrepôt), `low_stock_threshold` (seuil d'alerte à 3 unités).
- **Décrémentation Automatique :** Lors de la confirmation du webhook Stripe, les stocks sont automatiquement mis à jour via une transaction atomique PostgreSQL.
- **Statut Épuisé :** Dès que `stock_quantity = 0`, le bouton d'achat bascule automatiquement sur « Rupture de stock » ou redirige vers les alternatives d'occasion disponibles.

---

> [!tip] **Pour continuer la lecture :**
> - Découvrir le marché de seconde main : [[Marketplace]]
> - Explorer les partenaires marques : [[Fournisseurs]]
