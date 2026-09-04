---
title: Sceau d'Authenticité FieldSeal — LKDV
description: Spécification du label de certification des paquetages testés sur le terrain et algorithme d'attribution
tags:
  - matériel
  - fieldseal
  - certification
  - sécurité
  - réputation
aliases:
  - Sceau FieldSeal
  - Certification FieldSeal
  - FieldSeal
date: 2026-09-04
status: active
---

# 🛡️ Sceau d'Authenticité FieldSeal

Le **Sceau FieldSeal** est le standard de confiance de **Le Kit du Voyageur**. Il atteste qu'un kit ne relève pas d'une spéculation théorique d'intérieur, mais qu'il a été mis à l'épreuve avec succès dans des conditions réelles d'engagement.

> [!important] Garantie de Sécurité
> Tout kit arborant le **Sceau FieldSeal** garantit aux membres de la communauté que le triptyque de survie (abri, couchage, autonomie hydrique et calorique) a été validé sur un itinéraire réel d'au moins 48 heures.

---

## 🎖️ Niveaux de Certification FieldSeal

```
[ Niveau 1 : Bronze ] -> Trace GPX validée (> 48h) + Pesée effective
[ Niveau 2 : Argent ] -> 3 retours d'expérience indépendants positifs
[ Niveau 3 : Or ]     -> Validation par un professionnel (AMM / Guide UIAGM)
```

| Badge | Libellé | Critères Requis | Public Cible |
| :--- | :--- | :--- | :--- |
| 🥉 **Bronze** | *Testé en Itinérance* | Trace GPX de 48h minimum associée + pesée certifiée | Pratiquants réguliers |
| 🥈 **Argent** | *Recommandé Communauté* | Niveau Bronze + 3 forks indépendants ayant validé la liste | Communautés & Clubs |
| 🥇 **Or** | *Certifié Haute Montagne* | Validation par un Guide diplômé ou AMM avec rapport de sécurité | Expéditions & Pro |

---

## ⚙️ Algorithme d'Éligibilité & Attribution

Le calcul d'attribution du Sceau FieldSeal repose sur une fonction stockée PostgreSQL sécurisée :

1. **Vérification de la Trace d'Activité** :
   - Présence d'un enregistrement géospatial PostGIS correspondant aux dates de sortie déclarées.
   - Durée continue supérieure ou égale à 48 heures avec arrêt nocturne hors zone urbaine.
2. **Cohérence du Poids de Base (Base Weight)** :
   - Écart toléré de 3% maximum entre le calcul théorique de `materiel_kits` et la pesée déclarée sur balance suspendue.
3. **Absence d'Articles Manquants Critiques** :
   - Présence obligatoire des catégories : `abri`, `couchage`, `premiers_secours`, `navigation` et `filtration`.

---

## 🎨 Intégration Visuelle dans l'Application

Le badge FieldSeal est conçu selon les standards de la [[03 — 🎨 DESIGN SYSTEM & MOBILE/Tokens & Palette v2|Palette v2.0]] :
- **Fond** : Vert Forêt `#17402C` avec opacité subtile de 95%.
- **Bordure** : Teinte Pierre `#FBFAF6` avec micro-relief de 1px.
- **Typographie** : SF Pro Text, graisse medium, taille 11px majuscules espacées.
- **Micro-interaction** : Tap haptique avec affichage du volet modal d'historique de certification via `KitSheetModal` ([[03 — 🎨 DESIGN SYSTEM & MOBILE/Composants Mobiles|Composants Mobiles]]).

---

## 🔗 Voir Aussi
- [[02 — 🎒 MATÉRIEL & KITS/Épreuve du Terrain|L'Épreuve du Terrain]]
- [[02 — 🎒 MATÉRIEL & KITS/Architecture Lignées|Architecture des Lignées de Kits]]
- [[06 — 📋 DÉCISIONS (ADR)/ADR-005-Gestion-Filiation-Lignees|ADR-005 : Filiation & Généalogie]]