---
title: ADR-010 — Intégrité de l'Orientation Intime et Sceau d'Empreinte de Terrain
aliases:
  - ADR-010
tags:
  - adr
  - architecture
  - database
  - security
  - identity
date: 2026-09-04
status: Accepté
---

# ADR-010 — INTÉGRITÉ DE L'ORIENTATION INTIME ET SCEAU D'EMPREINTE DE TERRAIN

### Contexte
L'application introduit la personnalisation par profil d'activité montagnarde (Orientation : *alpiniste*, *randonneur*, *bushcraft*, *minimaliste*) et la valorisation communautaire des kits éprouvés en conditions réelles (Empreinte de terrain / Sceau FieldSeal).

### Problème & Risques
1. **Risque de profilage et discrimination :** Si l'orientation d'un utilisateur est exposée publiquement ou utilisée pour altérer le graphe des kits, l'intégrité de la plateforme est compromise.
2. **Risque de falsification ou de fuite géographique :** Si le sceau d'empreinte d'un utilisateur dépendait de ses coordonnées GPS précises ou de ses parcours, la vie privée des randonneurs serait compromise (traçage de bivouacs, géolocalisation de personnes vulnérables).

### Décisions Architecturales

1. **Étanchéité Absolue de l'Orientation (`user_orientation`) :**
   - Table `public.user_orientations` régie par une politique RLS stricte `auth.uid() = user_id`.
   - Aucun composant UI public ne lit ni n'affiche `user_orientation`.
   - Le domaine `features/kits` n'a aucun accès direct ni indirect à la table `user_orientations`.
   - Verrouillé par l'invariant CI anti-dérive n°1 (`ci_invariants.mjs`).

2. **Sceau Mathématique FieldSeal Déterministe :**
   - La signature géométrique est calculée uniquement à partir du hash cryptographique du `user_id` (`hash(userId)`).
   - Aucune coordonnée GPS, aucune métadonnée d'orientation ni aucune PII n'altère la géométrie de base.
   - Les métriques de terrain publiques sont agrégées sous strict K-anonymat (centroïdes de massifs arrondis à 2 décimales, regroupements par cohortes, plancher minimum de sorties).

### Conséquences
- **Positives :** Respect intégral du RGPD et du principe de minimisation des données (Privacy by Design). Zéro risque de profilage commercial. Valorisation objective des kits basée uniquement sur l'épreuve du terrain.
- **Négatives :** Impossibilité d'afficher des classements individuels de coureurs ou de localiser un utilisateur en direct sur la carte publique.
