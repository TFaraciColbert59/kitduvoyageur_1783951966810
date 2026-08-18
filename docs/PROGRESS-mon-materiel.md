# 📋 Suivi d'Avancement — Cockpit « Mon Équipement » Dashboard Sans Sidebar

> **Branche :** `feat/mon-materiel-cockpit-dashboard-final` (créée depuis `origin/refonte-cockpit-liquid-glass-mon-materiel`)
> **Cible :** `src/app/mon-materiel/page.tsx`
> **Statut :** ✅ Terminé — page cockpit dashboard sans sidebar, cards enrichies, toutes les fonctionnalités branchées sur l'existant.

---

## 📋 Mission & Contraintes

Transformer `src/app/mon-materiel/page.tsx` en véritable cockpit dashboard **sans sidebar**, dense, lisible, sans faux boutons, sans données fictives présentées comme réelles, sans logique dupliquée. Tout ce qui est visible doit fonctionner et persister. Le travail part de la branche `refonte-cockpit-liquid-glass-mon-materiel` (PR #22) — jamais de `main`.

---

## 🗺️ Inventaire de l'Existant (Fichiers Audités & Réutilisés)

| Domaine | Fichier source | Rôle & Usage |
| :--- | :--- | :--- |
| **Gestion Matériel** | [`src/hooks/useEquipment.ts`](file:///c:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/src/hooks/useEquipment.ts) | Hook CRUD Supabase (`gear_items`) + fallback invité localStorage. Utilisé tel quel. |
| **Gestion Kits** | [`src/hooks/useUserKits.ts`](file:///c:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/src/hooks/useUserKits.ts) | Kits actifs + **corbeille (trashKits / trashCount / restoreFromTrash / permanentDelete)** — tables `custom_kits` / `custom_kit_items`. |
| **Futures randonnées (SOURCE UNIQUE)** | [`src/lib/preparation/plannedHikes.ts`](file:///c:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/src/lib/preparation/plannedHikes.ts) | Manager partagé (~/preparer-randonnee et cockpit) : `getPlannedHikes`, `savePlannedHike`, `getActivePlannedHike`. **Étendu** avec `assignedKitId`, `companions`, `updatePlannedHike`, `removePlannedHike`. |
| **Moteur départ intelligent** | [`src/lib/preparation/SmartDepartureEngine.ts`](file:///c:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/src/lib/preparation/SmartDepartureEngine.ts) | `resolveDeparturePlan` → **kit recommandé + score**, consommables (eau/repas/en-cas/gaz), checklist. Réutilisé dans la card « Prochain Départ ». |
| **Tiroir Cockpit Kit** | [`src/components/inventaire/KitCockpitDrawer.tsx`](file:///c:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/src/components/inventaire/KitCockpitDrawer.tsx) | Panneau d'édition/assemblage/checklist/assignation de kit. Conservé. |
| **Fiche Matériel** | [`src/components/inventaire/GearDetailDrawer.tsx`](file:///c:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/src/components/inventaire/GearDetailDrawer.tsx) | Fiche technique, historique, notes, prêt, boutique. Conservé. |
| **Ajout/Modif Matériel** | [`src/components/inventaire/AddEditGearModal.tsx`](file:///c:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/src/components/inventaire/AddEditGearModal.tsx) | Modale d'ajout/édition. Conservé. |
| **Prêt de Matériel** | [`src/components/inventaire/LendItemModal.tsx`](file:///c:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/src/components/inventaire/LendItemModal.tsx) | Modale d'enregistrement des prêts. Conservé. |
| **Panier** | [`src/lib/cart.ts`](file:///c:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/src/lib/cart.ts) | Ajout panier avec persistance localStorage. |
| **IA Copilote** | [`src/lib/ai/chatCompletion.ts`](file:///c:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/src/lib/ai/chatCompletion.ts) + **`POST /api/ai/chat-completion`** | Streaming Gemini + fallback local. Branché avec badge `IA en ligne` / `Mode dégradé`. |
| **Header Global** | [`src/components/Header.tsx`](file:///c:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/src/components/Header.tsx) | Navigation principale LKDV. |
| **Feedback Haptique** | [`src/hooks/useHapticFeedback.ts`](file:///c:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/src/hooks/useHapticFeedback.ts) | Retours tactiles. |
| **Config images** | [`next.config.mjs`](file:///c:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/next.config.mjs) + [`image-hosts.config.mjs`](file:///c:/Users/Tony/Downloads/LKDV/kitduvoyageur_1783951966810/image-hosts.config.mjs) | `images.unsplash.com` déjà autorisé. |

### Tables Supabase concernées (vérifiées dans les hooks)
- `gear_items` — équipement possédé (RLS par `user_id`).
- `custom_kits` / `custom_kit_items` — kits personnalisés (cycle de vie 10 j en corbeille).
- `shop_products` — catalogue source des produits proposés.
- Randonnées planifiées : **localStorage partagé `lkdv_planned_hikes`** (système unifié existant, pas de table dédiée).

### Composants morte retrouvés (hors périmètre, non importés)
`DeparturePlannerView`, `KitsManagerView`, `MobileInventaireView`, `KitsAssemblersCard`, `InventaireHero(TimeToolbar)`, `CategorySection`, `ConsumablesSidebar`, etc. — restes de l'ancienne vue sidebar, **aucun import**. À purger dans un chantier dédié (signalé, non supprimé pour ne pas étendre le périmètre).

---

## 🎯 Plan d'Exécution

- [x] **Tâche 1 :** Audit complet (code, hooks, composants, routes API, tables, assets).
- [x] **Tâche 2 :** Création de la branche `feat/mon-materiel-cockpit-dashboard-final` depuis `refonte-cockpit-liquid-glass-mon-materiel`.
- [x] **Tâche 3 :** **Unification des futures randonnées** — suppression de la logique dupliquée `DEFAULT_PLANNED_HIKES` / duplicate localStorage au profit du module partagé `plannedHikes.ts`. Les sorties créées dans `/preparer-randonnee` s'affichent désormais correctement dans le cockpit (J-X, dates, météo) et **vice-versa** : une sortie planifiée ici est visible ailleurs via la même clé + `storage` event. ⚠️ Risque géré : ancien format localStorage (shape v1) — gestion de champs optionnels et recalcul des dates.
- [x] **Tâche 4 :** **Card « Prochain Départ » branchée sur `SmartDepartureEngine`** : kit recommandé (score), consommables estimés, articles manquants du kit assigné, suppression de sortie, liens réparés (`/randonnee-active?routeId=` et `/preparer-randonnee?routeId=` si `routeId`, sinon `/explorer` — plus de rebond 302).
- [x] **Tâche 5 :** **Nouvelles cards cockpit** (tout l'essentiel visible, aucune sidebar) :
  - **État du matériel** — répartition par condition (réel, avec filtre cliquable `conditionFilter`).
  - **Matériel prêté** — liste persistante avec action **« Rendu ✓ »** réelle (`updateEquipment`).
  - **Corbeille des kits** — restauration + suppression définitive via `useUserKits`.
  - **Actions rapides** — navigation réelle (Explorer, Configurateur IA, Rapport Kit, Jumeau 3D).
- [x] **Tâche 6 :** **Copilote IA** — badge `IA en ligne` / `Mode dégradé · analyse locale` ; erreurs gérées (écran propre si clé/provider manque, jamais de UI cassée, fallback local expert).
- [x] **Tâche 7 :** **Qualité & assets** — correction de 2 images Unsplash mortes (`photo-1508873696983-2df5293cb32b` et `photo-1609592424109-dd9892f1b177`) dans `useEquipment.ts` remplacées par des URLs valides vérifiées (Garmin → boussole, Anker → charge).
- [x] **Tâche 8 :** **Fix hydration SSR** — données `plannedHikes` chargées après hydration (pattern identique aux hooks équipement/kits) pour supprimer le mismatch React #418.
- [x] **Tâche 9 :** Validation `tsc --noEmit`, ESLint, `npm run build` (succès), tests Playwright des parcours.

---

## 📝 Journal des Modifications (Cette Branche)

### 2026-08-18 — Unification, enrichissement & validation
- **`src/lib/preparation/plannedHikes.ts`** : ajout de `assignedKitId`, `companions` et des helpers `updatePlannedHike` / `removePlannedHike`.
- **`src/app/mon-materiel/page.tsx`** (refonte majeure) :
  - Suppression de l'interface/des données locales dupliquées ; source de vérité = module partagé.
  - Layout cockpit à **3 rangs de cards** — Inventaire · Fiche outil · Télémétrie + État du matériel / Prochain départ (+ smart engine) · Kits · Alertes / Copilote IA · Prêts · Actions rapides.
  - Filters : ajout de `conditionFilter` (actif affiché et réinitialisable).
  - Modale de planification : champs jours/km/D+/compagnons → shape `PlannedHike` partagée.
  - Suppression d'une sortie (confirm), sélection persistante `lkdv_active_planned_hike_id`.
  - Corbeille kits, prêts « rendu », actions rapides réelles (routes vérifiées).
  - IA : badge de mode + gestion d'erreur propre.
- **`src/hooks/useEquipment.ts`** : 2 images mortes remplacées par des images Unsplash valides (garmin, anker).
- **Bug rencontré :** Hydration mismatch React #418 (lecture `localStorage` dans le state initial). → Correction par chargement après hydration.
- **Bug rencontré :** boutons `Itinéraire` → rebond 302 vers `/explorer` (route `/preparer-randonnee` exige `routeId`). → Lien conditionnel.
- **Vérifications Playwright (localhost) :** favorite toggle ✅ · drawer fiche ✅ · planifier une sortie (persiste) ✅ · assigner un kit ✅ · IA fallback local avec badge ✅ · aucun 404 image ✅ · aucune erreur de console ❌→ resolve ✅ · overflow mobile 0px ✅ · SSR 200 ✅.
- **État final :** `tsc --noEmit` = 0 erreur, ESLint = pas de nouvelle erreur, `npm run build` = succès (route `/mon-materiel` ~40 kB).

### 2026-08-18 — Contrainte critique : cockpit FULLSCREEN sans scroll de page
- Converti en **surface de pilotage plein écran** : racine `fixed inset-0 overflow-hidden` + `html, body { overflow: hidden }` + 3 bandes proportionnelles (46/30/24) internes à `main` ; **scrol*scroll de page impossible** à toutes les tailles (vérifié 1280→1920 px : `deSH===deCH`).
- Seuls des **scrolls internes localisés** autorisés (liste inventaire `flex-1 min-h-0 overflow-y-auto`, colonnes `lg:overflow-y-auto`, lists kits/alertes/prêts).
- Densité revue : HUD compact, hero fiche `h-24/28`, paddings réduits, en-tête inventaire compacté (la liste inv. garde 85–170 px de hauteur visible).
- **Z-index des overlays relevés au-dessus du Header `z-[1000]`** : GearDetailDrawer `z-50→1050`, KitCockpitDrawer `110→1050`, LendItemModal/AddEditGearModal `200→1100`, modales cockpit `200→1100` (les clics « Fermer » n'étaient plus interceptés par le header).
- Marge basse `pb-20/pb-14` pour que le bas des cards reste cliquable au-dessus de la bannière cookies (`z-[60]`).

## 🚦 Risques & Points de Vigilance
- **Format localStorage `lkdv_planned_hikes` :** si de vieilles sorties v1 (dateRange) existent déjà, elles s'affichent avec « Date à définir » mais ne plantent pas — la normalisation laisse le temps aux utilisateurs de les supprimer/recréer. L'écriture utilise désormais systématiquement le format v2.
- **Annulation de l'API IA :** sans clé/provider la route renvoie une erreur → fallback local garantit une réponse utile, l'UI n'est jamais bloquée.
- **Composants morts** de l'ancienne vue sidebar restent dans `src/components/inventaire/` (passage futur).