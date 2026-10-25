---
title: Fiche Module — Boutique & Commerce Unifié
aliases:
  - Boutique
  - E-commerce
  - Marketplace
  - Produits
tags:
  - module
  - shop
  - ecommerce
  - stripe
updated: 2026-08-17
status: 🟢 Fonctionnel (Unifié)
---

# 🛒 FICHE MODULE — BOUTIQUE & COMMERCE UNIFIÉ

---

### 1. Objectif
Proposer un catalogue outdoor éthique et rigoureusement sélectionné de 80+ équipements neufs, d'annonces de seconde main certifiées (occasion) et de kits modulaires, directement connecté à l'inventaire personnel et sécurisé par paiement Stripe.

---

### 2. UX & Ergonomie
- **Boutique Intégrée à l'Inventaire :** `/boutique` redirige vers `/mon-materiel`, où les fiches produits s'intègrent comme des solutions pour combler le sac à dos.
- **Ajout au Panier / Achat Direct :** Processus de commande fluide en 2 étapes, sans création obligatoire de compte préalable (mode invité converti au checkout).
- **Fiches Produits Riches :** Spécifications au gramme près, volume en litres, matériaux (Cordura, Dyneema, Duvet 800 cuin), avis vérifiés et alternatives d'occasion disponibles.

---

### 3. Pages & Routes
- `/mon-materiel` (avec filtre boutique actif) : Découverte du catalogue et des offres.
- `/boutique` : Redirection permanente 308 vers `/mon-materiel` avec maintien des métadonnées SEO.
- `/produit/[slug]` : Fiche détaillée d'un article spécifique.
- `/kits` & `/kits/[slug]` : Ensembles complets thématiques (Kit Bivouac Léger, Kit Rando Alpine).
- `/occasion` : Marketplace C2C de seconde main.
- `/panier` & `/checkout` : Tunnel d'achat et paiement sécurisé.

---

### 4. Composants
- `src/components/shop/ProductDetailView.tsx` : Vue fiche article détaillée.
- `src/components/shop/CartDrawer.tsx` : Tiroir de panier dynamique accessible depuis le menu.
- `src/components/shop/CheckoutForm.tsx` : Formulaire de paiement connecté à Stripe Elements.
- `src/components/shop/AffiliateButton.tsx` : Bouton d'achat partenaire avec redirection trackée.

---

### 5. Données & Schéma
- Prix stockés en centimes d'euros (`price_cents`) pour une précision monétaire sans faille.
- Gestion des types de transaction : `neuf`, `occasion`, `location`, `enchere`, `affiliation`.

---

### 6. Tables Supabase
- `shop_products` : Catalogue principal des articles (titre, slug, marque, catégorie, poids, prix, stock, photos, tags).
- `kits` & `kit_items` : Packs de produits pré-assemblés avec réduction groupée.
- `occasion_listings` : Annonces de seconde main déposées par les utilisateurs.
- `orders` & `order_items` : Commandes validées et lignes d'articles associées.
- `affiliate_partners` & `affiliate_offers` : Partenariats marques outdoor et liens de redirection.

---

### 7. RLS & Sécurité
- **Vérification Serveur Impérative :** Le prix final des articles est obligatoirement recalculé depuis la base `shop_products` côté serveur dans `/api/checkout` (aucune confiance accordée au prix envoyé par le client).
- **Protection des Commandes :** Un utilisateur ne peut consulter que ses propres commandes (`user_id = auth.uid()`).

---

### 8. API Routes
- `POST /api/checkout` : Création de la session de paiement Stripe avec vérification des stocks et des prix.
- `POST /api/stripe/webhook` : Traitement idempotent des événements de paiement confirmé pour générer la commande.
- `GET /api/produit/neuf-check` & `occasion-check` : Vérification rapide de la disponibilité en stock.

---

### 9. Dépendances & Interactions
- **[[Inventaire]] :** Tout article acheté ou marqué comme possédé est automatiquement injecté dans `gear_items`.
- **[[Récompenses]] :** Les ventes générées par les liens de créateurs déclenchent des commissions automatiques dans le grand livre `reward_transactions`.
- **[[Notifications]] :** Envoi d'un email de confirmation de commande et d'une alerte d'expédition avec numéro de suivi.

---

### 10. Notifications Associées
- Email de reçu de commande avec facture PDF téléchargeable.
- Alerte de baisse de prix sur les articles placés en liste d'envies.

---

### 11. Points & Récompenses
- 1 € dépensé = 1 point LKDV cumulé sur le compte fidélité.

---

### 12. Problèmes Connus
- Aucun bug actif. La table historique `products` a été purgée au profit strict de `shop_products`.

---

### 13. État
🟢 **Fonctionnel, Unifié & Déployé**.

---

### 14. Roadmap
- [ ] Système de consigne et reprise d'ancien matériel contre des bons d'achat LKDV.
- [ ] Paiement en 3x ou 4x sans frais via Alma / Klarna sur les gros équipements (tentes 4 saisons).
