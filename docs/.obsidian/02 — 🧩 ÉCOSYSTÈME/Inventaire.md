---
title: Fiche Module — Mon Matériel (Inventaire Unifié)
aliases:
  - Inventaire
  - Mon Matériel
  - Gestion Équipement
tags:
  - module
  - gear
  - inventory
updated: 2026-08-17
status: 🟢 Fonctionnel (Unifié)
---

# 🎒 FICHE MODULE — MON MATÉRIEL (INVENTAIRE UNIFIÉ)

---

### 1. Objectif
Fournir au voyageur un espace unique, épuré et ultra-complet pour gérer tout son équipement outdoor personnel, calculer au gramme près le poids de base de son sac, suivre l'état d'usure, programmer les entretiens (ex : imperméabilisation tente, affûtage crampons), gérer les prêts entre amis et combler ses manques via la boutique unifiée.

---

### 2. UX & Ergonomie
- **Design Minimaliste (Style Apple / AllTrails) :** Grille responsive aérée, typographie soignée, badges discrets.
- **Possession comme état visuel :** Les articles possédés sont mis en valeur avec un badge vert et leur poids réel ; les articles suggérés apparaissent avec option d'ajout rapide.
- **5 Catégories Structurantes :** Abri & Couchage, Cuisine & Eau, Vêtements & Portage, Hygiène & Santé, Orientation & Sécurité.
- **Fiche Tiroir (Drawer) :** Clic sur un article ouvre un volet latéral complet (`ItemHero`, spécifications techniques, calendrier d'entretien, historique des prêts, notes personnelles).

---

### 3. Pages & Routes
- `/mon-materiel` : Vue principale de l'inventaire personnel unifié.
- `/boutique` : Alias SEO et redirection permanente vers `/mon-materiel`.

---

### 4. Composants
- `src/features/gear/components/EquipmentUnifiedView.tsx` : Vue principale consolidée.
- `src/components/gear/BaseWeightMeter.tsx` : Jauge de poids de base avec décomposition par catégorie.
- `src/components/gear/ItemHeroModal.tsx` : Tiroir de détails techniques et actions.
- `src/components/gear/LendItemModal.tsx` : Modal d'enregistrement d'un prêt de matériel à un tiers.
- `src/hooks/useEquipment.ts` : Hook unique de gestion d'état et persistance Supabase / localStorage.

---

### 5. Données & Schéma
- Unités de poids normalisées en grammes (`weight_g`).
- États d'usure supportés : `neuf`, `tres_bon_etat`, `bon_etat`, `satisfaisant`, `a_reparer`.
- Calcul automatique des alertes via la fonction utilitaire `evaluateGearAlerts()`.

---

### 6. Tables Supabase
- `gear_items` : Table de l'inventaire individuel (titre, marque, poids, catégorie, compartiment, état d'usure, date de prochain entretien, statut de prêt, photos).
- `shop_products` : Catalogue de référence permettant l'auto-complétion des fiches techniques.

---

### 7. RLS & Sécurité
- RLS strict : Chaque utilisateur ne peut voir, modifier ou supprimer que ses propres équipements (`user_id = auth.uid()`).
- Mode invité supporté avec synchronisation automatique lors de l'inscription/connexion.

---

### 8. API Routes
- `POST /api/kit-report/convert-inventory` : Insertion en masse d'items depuis un rapport de kit.
- Requêtes directes Supabase JS Client sécurisées par RLS via `useEquipment.ts`.

---

### 9. Dépendances & Interactions
- **[[Boutique]] :** Permet d'acheter en 1 clic les articles manquants ou de revendre un équipement possédé sur la marketplace d'occasion.
- **[[Configurateur]] :** Sert de base de référence pour calculer ce qu'il reste à emporter pour une expédition donnée.
- **[[Groupes]] :** Permet d'indiquer aux coéquipiers qui apporte quel matériel lourd pour éviter les doublons.

---

### 10. Notifications Associées
- Rappel de maintenance avant la saison d'été (ex: réactiver le traitement déperlant DWR).
- Relance automatique pour les articles prêtés dont la date de retour est dépassée.

---

### 11. Points & Récompenses
- +10 XP par tranche de 5 articles renseignés avec poids exact.
- Badge « Maître de l'Ultraléger » si le Base Weight passe sous les 4.5 kg pour un trek 3 saisons.

---

### 12. Problèmes Connus
- Aucun bug actif. La fusion architecturale du 17 août a supprimé `useOwnedEquipment.ts` et la table morte `products`.

---

### 13. État
🟢 **Fonctionnel, Unifié & Déployé**.

---

### 14. Roadmap
- [ ] Export vers fichier CSV / format compatible LighterPack.
- [ ] Scan de code-barres / étiquette produit pour ajout instantané.
