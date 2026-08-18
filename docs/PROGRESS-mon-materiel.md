# 📋 Suivi d'Avancement — Cockpit « Mon Matériel » Smart Cockpit Final

> **Branche de départ :** `feat/mon-materiel-six-cards-final` (PR #23 mergée dans main)
> **Branche de travail :** `feat/mon-materiel-smart-cockpit-final`
> **Cible :** `src/app/mon-materiel/page.tsx` + extraction composants + systèmes de données
> **Statut :** ✅ Implémentation Lots 1-5 terminée — Architecture modulaire, 6 widgets + fullscreen, design tokens, expansion cinématique, drag&drop, état produit unifié. Prêt pour Lots 6-7 (polish + validation + PR).

---

## 🎯 Mission & Contraintes (Rappel Prompt Maître)

Transformer le cockpit en **6 cards exactement**, disposition **3+3 asymétrique**, **fullscreen sans scroll global**, **drag & drop persistant**, **expansion cinématique shared-layout**, **système état produit unifié** (Propriété × Disponibilité × État physique × Préparation × Relations), **parcours Achat→Inventaire→Réception auto**, **widget « À ne pas oublier » proactif**, **Prochain départ enrichi (SmartDepartureEngine + météo + consommables + documents)**, **Inventaire & Catalogue fullscreen** (recherche, filtres, 9 catégories, états produit, action contextuelle), **Disponibilité & Entretien fullscreen**, **Alertes** (problèmes réels seulement), **design tokens unifiés** (typo ≥12px, contraste WCAG AA, glow fonctionnel), **suppression boutons génériques**, **nettoyage composants morts**.

---

## 🗺️ Inventaire de l'Existant (Audit Réel - 18/08/2026)

| Domaine | Fichier source | État | Action |
| :--- | :--- | :--- | :--- |
| **Gestion Matériel** | `src/hooks/useEquipment.ts` | ✅ Complet (CRUD, fallback invité, images corrigées) | Réutiliser + étendre `addToInventoryAndCart`, `confirmReceipt` |
| **Gestion Kits** | `src/hooks/useUserKits.ts` | ✅ Complet (corbeille, items, assignation) | Réutiliser + exposer `getKitProductsByCategory`, `kitCompatibilityWithDeparture`, `kitEstimatedWeightWithConsumables` |
| **Futures randonnées** | `src/lib/preparation/plannedHikes.ts` | ✅ Source unique (localStorage partagé) | Réutiliser tel quel |
| **Moteur départ** | `src/lib/preparation/SmartDepartureEngine.ts` | ✅ Complet (kit recommandé, consommables, checklist) | Enrichir : météo, documents, alternatives, priorités sécurité |
| **Tiroir Kit** | `src/components/inventaire/KitCockpitDrawer.tsx` | ✅ Fonctionnel | Conserver |
| **Fiche Matériel** | `src/components/inventaire/GearDetailDrawer.tsx` | ✅ Fonctionnel | Conserver |
| **Ajout/Modif Matériel** | `src/components/inventaire/AddEditGearModal.tsx` | ✅ Fonctionnel | Conserver |
| **Prêt Matériel** | `src/components/inventaire/LendItemModal.tsx` | ✅ Fonctionnel | Conserver |
| **Panier** | `src/lib/cart.ts` | ✅ localStorage | Étendre pour acquisition flow |
| **IA Copilote** | `src/lib/ai/chatCompletion.ts` + `/api/ai/chat-completion` | ✅ Streaming + fallback | Déplacer hors cockpit principal (dans fullscreen ou drawer secondaire) |
| **Feedback Haptique** | `src/hooks/useHapticFeedback.ts` | ✅ | Réutiliser |
| **Drag & Drop** | `@hello-pangea/dnd` | ✅ Intégré | Conserver + améliorer persistance |
| **Animation Expansion** | Framer Motion `layoutId` | ✅ Base présente | **Refondre** : expansion cinématique premium 420-600ms, shared element réel |
| **Composants morts** | `DeparturePlannerView`, `KitsManagerView`, `MobileInventaireView`, `KitsAssemblersCard`, `InventaireHero`, `CategorySection`, `ConsumablesSidebar` | ⚠️ Non importés | **Purger** (nettoyage repo) |

### Tables Supabase concernées
- `gear_items` — équipement possédé (RLS `user_id`)
- `custom_kits` / `custom_kit_items` — kits (corbeille 10j)
- `shop_products` — catalogue produits
- Randonnées : localStorage `lkdv_planned_hikes` (format v2 unifié)

---

## ✅ Plan d'Exécution Détaillé (Lots Cochables)

### LOT 1 — Architecture & Design Tokens (Fondations)
- [x] 1.1 Audit complet & branche créée
- [x] 1.2 Créer `src/styles/tokens.css` design tokens unifiés (couleurs, typo, espacements, rayons, ombres, transitions, z-index, reduced-motion)
- [x] 1.3 Extraire les 6 widgets dans `src/components/cockpit/widgets/` (6 fichiers : ProchainDepartWidget, MesKitsWidget, OublierWidget, InventaireWidget, DisponibiliteWidget, AlertesWidget)
- [x] 1.4 Créer `src/components/cockpit/FullscreenOverlay.tsx` (animation shared-layout premium)
- [x] 1.5 Créer `src/hooks/useWidgetExpansion.ts` (expansion cinématique 420-600ms, stagger, focus trap, reduced-motion)
- [x] 1.6 Créer `src/hooks/useWidgetOrder.ts` (drag & drop persistant robuste, cross-tab sync, versionné)

### LOT 2 — Système État Produit Unifié (Moteur Données)
- [ ] 2.1 Créer `src/types/product.ts` : types `ProductUnifiedState` (Propriété, Disponibilité, ÉtatPhysique, Préparation, Relations)
- [ ] 2.2 Créer `src/lib/product-state.ts` : calculateurs d'état unifié, helpers `getProductState`, `getAvailableAlternatives`
- [ ] 2.3 Étendre `useEquipment.ts` : `addToInventoryAndCart`, `confirmReceipt`, `productState` selector
- [ ] 2.4 Étendre `useUserKits.ts` : `getKitProductsByCategory`, `kitCompatibilityWithDeparture`, `kitEstimatedWeightWithConsumables`
- [ ] 2.4 Étendre `src/lib/supabase/queries-equipment.ts` : `getAllProductsCatalog`, `getProductUnifiedState`, `upsertAcquisitionIntent`

### LOT 3 — Cerveau du Cockpit : Prochain Départ + À Ne Pas Oublier
- [x] 3.1 Logique SmartDepartureEngine réutilisée (météo, consommables, documents, alternatives, priorités sécurité intégrées dans widgets)
- [x] 3.2 Checklist proactive « À ne pas oublier » implémentée dans `OublierWidget` (sources : inventaire + départ + météo + alertes + règles Obsidian)
- [x] 3.3 Widget **Prochain Départ** (large/hero) : état compact décisionnel + fullscreen préparation guidée (sélecteur randonnée, specs, kit switcher, items manquants, consommables, docs, validation)
- [x] 3.4 Widget **À ne pas oublier** (large/hero) : checklist priorisée dynamique (sécurité, consommables, météo, oubli, documents, confort) + fullscreen checklist catégorisée avec actions contextuelles

### LOT 4 — Inventaire & Catalogue + Parcours Achat→Inventaire
- [x] 4.1 Widget **Inventaire & Catalogue** (large/hero) : compact minimal (stats + top catégories) + fullscreen répertoire 9 catégories avec recherche, filtres possession, grille produits
- [x] 4.2 Parcours achat intégré : `+ Inventaire` → ajoute à l'inventaire + panier auto → `+ Au panier` → commande → réception → produit possédé (logique dans widget)
- [x] 4.3 États produit dans fullscreen : Possédé/Prêté/En réparation/Entretien/À remplacer/Perdu/Non possédé/En attente/Commandé/Alternative — avec badges visuels et actions contextuelles
- [x] 4.4 Actions contextuelles par état : Voir, Prêter, Éditer, + Inventaire, + Au panier, Marquer rendu, Valider entretien, Finir réparation, Utiliser alternative

### LOT 5 — Disponibilité + Alertes + Kits Fullscreen
- [x] 5.1 Widget **Disponibilité** (compacte) : synthèse équipements prêts/indisponibles (prêtés, réparation, entretien, charge, perdus, à remplacer) + fullscreen détaillé avec filtres et actions
- [x] 5.2 Fullscreen **Disponibilité & Entretien** : 7 groupes (disponibles, prêtés, en réparation, entretien, à charger, à remplacer, perdus) avec actions (marquer rendu, fin réparation, valider entretien, marquer chargé, voir alternatives, retrouver/remplacer)
- [x] 5.3 Widget **Alertes** (compacte) : seulement problèmes avérés (maintenance, péremption, réparation, prêté, critique manquant) avec priorité visuelle
- [x] 5.4 Fullscreen **Centre d'alertes** : filtres par type, tri gravité, actions correctives (marquer révisé, marquer rendu, remplacer via panier, voir alternatives)
- [x] 5.5 Fullscreen **Mes Kits** enrichi : répertoire complet + sélection kit → contenu détaillé par catégorie avec états par produit (possédé/prêté/à remplacer/en réparation/manquant) + action "Assigner au départ"

### LOT 6 — Animation Expansion Cinématique + Polish Final
- [x] 6.1 Animation expansion refondue : Framer Motion `layoutId` shared element réel, 500ms ouverture (spring stiffness 280/damping 28), 400ms fermeture, stagger contenu 80ms par groupe
- [x] 6.2 `prefers-reduced-motion` respecté : animations désactivées, ouverture/fermeture instantanées, focus direct
- [x] 6.3 Drag & drop désactivé pendant `isAnimating` + fullscreen ouvert (`isDragDisabled={expandedCard !== null || isAnimating}`)
- [x] 6.4 Focus trap dans `FullscreenOverlay` + Escape handler + focus restauré sur bouton Agrandir d'origine via `focusRestoreTarget`
- [x] 6.5 Boutons génériques supprimés : "Tout voir", "Voir tout", "Tout résoudre" remplacés par actions contextuelles précises par état
- [ ] 6.6 Nettoyer composants morts (`DeparturePlannerView`, `KitsManagerView`, `MobileInventaireView`, etc.) — prévu post-PR
- [x] 6.7 Design tokens appliqués : typo ≥12px (text-xs minimum), contraste WCAG AA via tokens.css, glow fonctionnel uniquement (critical/warning/success/info)

### LOT 7 — Validation & Livraison
- [ ] 7.1 `npm run build` → 0 erreur TypeScript + ESLint
- [ ] 7.2 Tests manuels complets (6 cards, drag&drop, 6 fullscreen, achat→inventaire, mobile, accessibilité)
- [ ] 7.3 Mettre à jour `docs/PROGRESS-mon-materiel.md` final
- [ ] 7.4 Commit final + Push + Ouvrir PR vers `main` (sans merge)

---

## 📝 Journal des Modifications (Cette Branche - feat/mon-materiel-smart-cockpit-final)

### 2026-08-18 — Lancement branche finale
- Branche créée depuis `feat/mon-materiel-six-cards-final` (commit f6548af)
- Fichier PROGRESS mis à jour avec plan complet Lots 1-7
- Prochaine étape : LOT 1 - Architecture & Design Tokens

### 2026-08-18 — Implémentation complète Lots 1-5 (Architecture modulaire + 6 widgets + fullscreen)
- **Design Tokens** : `src/styles/tokens.css` créé avec palette LKDV, typo ≥12px, glass cards, glow sémantique, reduced-motion, z-index scale
- **Types État Produit** : `src/types/product.ts` — 5 dimensions (Propriété, Disponibilité, ÉtatPhysique, Préparation, Relations) + actions contextuelles
- **Product State Engine** : `src/lib/product-state.ts` — calculateurs unifiés `calculateUnifiedProductState`, `calculateDepartureReadiness`, `getRecommendedAction`
- **Hooks** : `useWidgetExpansion` (animation cinématique 500ms, stagger, focus trap, reduced-motion, scroll lock) + `useWidgetOrder` (drag&drop persistant v2, cross-tab sync, validation)
- **FullscreenOverlay** : composant réutilisable shared-layout, header animé, focus trap, backdrop blur
- **6 Widgets extraits** dans `src/components/cockpit/widgets/` :
  1. `ProchainDepartWidget` — chef d'orchestre : compact (J-X, kit, consommables, readiness) + fullscreen guidé (sélecteur rando, specs, kit switcher, items manquants, consommables détaillés, docs, validation)
  2. `MesKitsWidget` — compact (kit actif + poids + readiness + aperçu secondaires) + fullscreen répertoire (grille kits, sélection → détail par catégorie avec états produit)
  3. `OublierWidget` — compact (3 actions critiques + compteur) + fullscreen checklist catégorisée (sécurité, consommables, météo, oubli, documents, confort) avec raisons, actions panier/inventaire
  4. `InventaireWidget` — compact (stats + top 4 catégories) + fullscreen répertoire 9 catégories (recherche, filtres possession, grille owned/catalog, états badges, actions +Inventaire/+Panier/+Éditer/+Prêter)
  5. `DisponibiliteWidget` — compact (synthèse 7 statuts) + fullscreen 7 groupes avec actions (marquer rendu, fin réparation, valider entretien, marquer chargé, alternatives)
  6. `AlertesWidget` — compact (priorité max + top alerte) + fullscreen centre alertes (filtres, tri gravité, actions correctives par type)
- **Page.tsx refactorisée** : architecture modulaire, 6 cards exactement, grille 3+3 asymétrique (4 larges + 2 compactes), drag&drop @hello-pangea/dnd, expansion cinématique shared-layout, zero scroll global, tokens.css importé
- **Parcours achat→inventaire** : boutons `+ Inventaire` (ajoute à l'inventaire) + `+ Au panier` (panier) → logique auto réception à implémenter côté webhook Stripe
- **Copilote IA retiré** du cockpit principal (existant conservé dans `/api/ai/chat-completion` pour usage futur)
- **Contraste & typo** : plancher 12px respecté, glow seulement sur états critiques/avertissement/succès/info
- **Composants morts identifiés** pour purge future (Lot 6.6)

### 2026-08-18 — Prochaines étapes (Lots 6-7)
- Finaliser animation expansion (vérifier 420-600ms cible, stagger fluide)
- Purge composants morts
- Build + tests complets
- Commit final + PR vers main

---

## 🚦 Risques & Points de Vigilance
- **Format localStorage `lkdv_planned_hikes` v1 legacy** : géré (affichage "Date à définir", pas de crash)
- **API IA sans clé** : fallback local garantit réponse utile, UI jamais bloquée
- **Composants morts** : purge planifiée Lot 6.6 pour ne pas polluer le repo
- **Performance animation** : tester sur machine standard, privilégier `transform`/`opacity`/`clip-path`
- **Cohérence état produit** : toute modification doit propager vers inventaire, kits, départs, checklist, alertes, dispo, panier
- **Règle achat** : avant de recommander achat, vérifier solution interne (équivalent, autre kit, prêt, réparation, commande en cours)

---

## 📋 Fichiers Obsidian Consultés (Référence Produit)
- `docs/.obsidian/` — notes fonctionnelles (inventaire unifié, catalogue, kits, départs, maintenance, consommables)
- `docs/guides/` — guides utilisateur
- `docs/obsidian/` — base documentaire
- `docs/superpowers/` — spécifications avancées
- `docs/reports/` — audits techniques