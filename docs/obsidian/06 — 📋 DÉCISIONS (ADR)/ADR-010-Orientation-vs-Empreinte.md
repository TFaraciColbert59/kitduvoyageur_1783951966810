---
title: ADR-010 — Orientation (Privée) vs Empreinte (Publique Dérivée)
aliases:
  - ADR-010
tags:
  - adr
  - produit
  - orientation
  - empreinte
  - vie-privee
date: 2026-09-04
status: Accepté
---

# ADR-010 — Orientation (Privée) vs Empreinte (Publique Dérivée)

### Contexte
La proposition initiale suggérait de demander aux utilisateurs de choisir un rôle (voyageur / explorateur / traqueur) avec une couleur attitrée dès l'inscription.
Cette approche a été rejetée pour trois raisons :
1. **Contrainte de Palette v2.0** : La palette LKDV n'autorise qu'une seule couleur d'accent (`sage`). Multiplier les couleurs par rôle violerait la règle d'or du design system.
2. **Doctrine du Terrain** : LKDV classe des paquetages et des contraintes d'itinérance, jamais des personnes. Rien ne s'affiche sans preuve terrain réelle.
3. **Friction à l'Inscription** : Exiger une auto-déclaration identitaire avant même la première utilisation du configurateur détruit le taux de conversion.

### Décision
Séparer strictement deux concepts orthogonaux :
1. **ORIENTATION (Privée, facultative, paramètre du configurateur)** :
   - Table `user_orientation` protégée par RLS stricte (`user_id = auth.uid()`, aucune politique publique).
   - Quatre questions factuelles (terrain, autonomie, priorité, expérience) servant uniquement à pré-calibrer le [[02 — 🎒 MATÉRIEL & KITS/Configurateur IA|Configurateur IA]].
2. **EMPREINTE (Publique, 100% dérivée de la preuve terrain)** :
   - Vue matérialisée calculée à partir des sorties effectives `hike_sessions` (kilométrage, dénivelé D+, altitude max, massifs arpentés).
   - Seuil de confiance : en dessous de 3 sorties réelles, aucune empreinte n'est affichée (label neutre "Lignée jeune").

### Conséquences
- **Positives :**
  - Respect scrupuleux de la Palette v2.0 et des normes RGPD.
  - Authenticité absolue de la communauté (l'autorité se prouve par les crampons et le sac, pas par une case cochée).
- **Négatives :**
  - Nécessite d'attendre des sorties effectives pour voir émerger l'empreinte publique d'un aventurier.

### Liens & Références
- [[01 — 🎯 PRODUIT & VISION/Personas & Usages|Personas & Usages]]
- [[02 — 🎒 MATÉRIEL & KITS/Épreuve du Terrain|L'Épreuve du Terrain]]
- [[05 — 🛡️ SÉCURITÉ & INVARIANTS/Données Privées & RGPD|Données Privées & RGPD]]