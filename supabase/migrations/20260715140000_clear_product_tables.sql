-- Migration: Vider toutes les tables produits
-- Tables: products, occasion_items, auction_items, kits, kit_items, listings, rental_items, auction_bids, auction_auto_bids

-- 1. Supprimer d'abord les tables enfants (dépendances FK)
DELETE FROM public.auction_bids;
DELETE FROM public.auction_auto_bids;
DELETE FROM public.kit_items;
DELETE FROM public.product_reviews;

-- 2. Supprimer les tables produits principales
DELETE FROM public.listings;
DELETE FROM public.occasion_items;
DELETE FROM public.auction_items;
DELETE FROM public.rental_items;
DELETE FROM public.kits;
DELETE FROM public.products;
