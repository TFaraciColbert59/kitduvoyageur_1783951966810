# 📋 Suivi d'Avancement — Cockpit « Mon Équipement » Dashboard Sans Sidebar

> **Branche :** `feat/mon-materiel-cockpit-polestar` (créée depuis `feat/mon-materiel-cockpit-dashboard-final`, PR #23)
> **Cible :** `src/app/mon-materiel/page.tsx`
> **Statut :** 🚧 Lot 6 modules Polestar — refonte du cockpit en dashboard automobile à 6 widgets, drag & drop persistant, drawer « Tout voir ».

---

## 🆕 Lot « Cockpit 6 Modules — Style Polestar/Automotive » (2026-08-18)

### Direction visuelle
- **Fond papier clair aligné sur le reste du site** : suppression du fond sombre `#0B1F17` et de la photo `hero-misty.jpg` → `#F5F3EE`/`#FBFAF6` (tokens site `--lkv-paper`/`--background`) + 2 halos radiaux très subtils (forest / sable). Encre `#1C2620`, accents forest `#2D5A3D` (cohérent avec Header, boutons et cartes du site).
- **Liquid glass clair amélioré** (visionOS, style clair) : fond `rgba(255,255,255,0.55)` + `backdrop-blur(40px) saturate(1.5)`, liseré `border-white/70`, reflet supérieur blanc `rgba(255,255,255,0.6)→transparent`, **masque de bord dégradé blanc lumineux**, ombre douce encre (`0 24px 60px -24px rgba(11,31,23,.22)`) + **inner-highlight `inset 0 1px 0 rgba(255,255,255,.85)`**. Overlays (drawer, modales, toast) transposés en blanc translucide `rgba(251,250,246,.95)`.
- **Une valeur dominante par widget** (`text-4xl`/`text-5xl`, `font-mono` extrabold) : Poids du pack · Compte à rebours J-X · % matériel en bon état · nombre d'alertes · nombre de kits.
- **Plancher typographique `text-xs`** : tous les `text-[9px]`/`text-[10px]`/`text-[11px]` de la page sont supprimés (labels secondaires ≥ 12px) et les textes secondaires sont en encre `#1C2620/60–80` (contraste WCAG AA sur papier clair).
- **Glow réservé aux états actifs** : départ imminent (J≤3, badge ambre `#8C6A1A`), alertes présentes (chiffre ambre lumineux), Copilote en streaming (icône pulse).
- **Icônes fortes monochromes** (SVG inline : balance, navigation, activité, sparkle, cloche, sac à dos) — pas d'emoji dans les en-têtes.

### Layout 6 modules (grille asymétrique, 2 rangs, sans scroll de page)
- `grid-cols-4` (desktop) + `grid-flow-dense` + `auto-rows-fr` + `flex-1 min-h-0` : **Rang 1 = [Poids] [Prochain départ ×2] [État du matériel]** · **Rang 2 = [Copilote IA ×2] [Alertes] [Kits]**.
- La somme des spans = 8 unités = 2 rangs pleins : `grid-flow-dense` garantit **2 rangs exactement** quel que soit l'ordre choisi par l'utilisateur (aucun trou, aucune colonne vide).
- Mobile : `grid-cols-2`, les petits modules s'apparient (Poids+État / Alertes+Kits), les LARGE occupent toute la ligne ; le wrapper mobile scroll (comportement précédent conservé), desktop reste `overflow-hidden` (vérifié 1280→1920 px).

### Drag & drop réordonnable + persistance
- Poignée `⠿` sur chaque en-tête de module : HTML5 DnD natif (pas de dépendance), highlight du module cible (ring sage), reorder via `splice`.
- **Persistance `localStorage`** : clé `lkdv_cockpit_widget_order` (chargée après hydration pour éviter le mismatch SSR #418, écriture après chargement).
- **Accessible** : l'onglet **Réglages** du drawer liste les 6 modules avec ▲▼ (clavier/tactile) + « ↺ Réinitialiser la disposition ».

### Drawer « Tout voir » (`z-[1040]`, sous les overlays 1050/1100)
Héberge toutes les fonctionnalités reléguées, organisées en 4 onglets :
- **Inventaire** : recherche, catégories, marques, favoris, filtre état, sélection multiple/bulk, édition inline poids/qté, comparateur 2 articles, répartition par catégorie, ajout d'article, fiche → `GearDetailDrawer` (clique ligne ouvre la fiche).
- **Prêts & Alertes** : alertes opérationnelles (→ fiche), prêts avec « Rendu ✓ » réel, corbeille des kits.
- **Réglages** : objectif de poids (5–20 kg), ordre des modules (▲▼ + reset), réinitialiser filtres, Mon Profil.
- **Actions** : navigation (Explorer, Configurateur IA, Rapport Kit, Jumeau 3D) + actions rapides (ajout article, planifier sortie, nouveau kit).

### Évolutions du code
- `src/app/mon-materiel/page.tsx` : refonte complète du rendu — les 3 bandes 46/30/24 sont remplacées par la grille 6 modules ; la card « Fiche outil active » et ses `SpecTile` sont retirées (la fiche vit désormais dans `GearDetailDrawer`) ; la modale Réglages (⚙️) est remplacée par l'onglet Réglages du drawer ; toast monté à `z-[1200]` pour rester visible au-dessus du drawer.
- Suppression du warning `refreshHikes` inutilisé ; `handleToggleFavorite` enveloppé dans `useCallback` (deps du raccourci clavier stables).
- `WeightGauge` : labels internes passés en `text-xs`.

### Validation
- `tsc --noEmit` = 0 erreur · `npm run lint` = aucun warning sur `mon-materiel/page.tsx` · `npm run build` = succès (route `/mon-materiel` 39,8 kB, en baisse).
- **Playwright (15/16) :** 6 widgets visibles ✅ · aucun scroll de page 1440×900 ✅ · 6 poignées DnD ✅ · drawer « Tout voir » (4 onglets, Inventaire par défaut) ✅ · clic article → fiche ✅ · réordonnancement ▲ + persistance localStorage + restore après reload ✅ · reset disposition ✅ · **drag & drop HTML5 natif réordonne + persiste** (departure→weight) ✅ · Copilote IA fallback local (badge « Mode dégradé » + réponse) ✅ · mobile 380 px sans débordement horizontal, 6/6 widgets ✅ · aucune réponse HTTP ≥ 400 ✅.
- ⚠️ **1 erreur console attendue :** en absence de clé Gemini, la route `/api/ai/chat-completion` log `API Route Error` (404 fournisseur) puis l'UI bascule proprement en « Mode dégradé » (fallback local) — comportement existant, non bloquant.

### 2026-08-18 — Ajustement : fond papier clair (reste du site) + liquid glass clair
- **Fond clair** : racine `#0B1F17` → `#F5F3EE` (fond du site), diversion sous-jacente, halos forest/sable, encre `#1C2620`, accents `#2D5A3D`, ambre `#8C6A1A`, danger `#9B2C2C`: remplacement des 157 `text-white/*`→encre, bordures `white/x`→`[#1C2620]/x`, surfaces `white/black`→verres + teintes ink, `#A3C4A3`→`#2D5A3D`, `#E9C46A`→`#8C6A1A`, `#F4A18C`→`#C0532E`, couleurs `CONDITION_META` assombries (WCAG AA).
- **GlassCard clair amélioré** : `bg-white/55` + `blur(40px) saturate(1.5)` + liseré `white/70` + sheen supérieur + masque de bord lumineux + ombre encre douce + inner-highlight blanc.
- Overlays (drawer « Tout voir », modales, toast, sélecteurs) transposés en surfaces claires translucides ; scrims `bg-(black/70)`→`[#1C2620]/55`.
- Vérifié par Playwright : `rootBg rgb(245,243,238)`, `glass rgba(255,255,255,0.55) + blur(40px)`, encre `rgb(28,38,32)` ; suite de tests 6 modules toujours verte (15/16, seule 1 erreur console = fallback IA attendu).
- **Fond photo voilée** : ajout de `public/assets/images/urban-vintage.jpg` (≈1 Mo, source `~/Downloads/urban-vintage-78A265wPiO4-unsplash.jpg`) en arrière-plan `fixed z-0`, `object-cover` + `blur(12px) saturate(1.08) brightness(1.06)`, **voile papier clair** (dégradé `#F5F3EE/90→#FBFAF6/80→#F5F3EE/92` + halo radial blanc) pour conserver le thème clair et le contraste AA ; `GlassCard` monté à `bg-white/65` (frosting sur photo). Vérifié : image servie (200 via next/image), glass `rgba(255,255,255,0.65) + blur(40px)`, toujours sans scroll.

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
- **Topbar summary retirée** (Header de navigation global conservé) : le bandeau « Cockpit Mon Équipement » et ses boutons ont disparu pour maximiser l'espace ; les actions restent dans les cards (ajout inventaire, « + Planifier », « + Nouveau Kit »/clic kit) et l'accès ⚙️ Réglages a été déplacé dans l'en-tête de la card Télémétrie. `h1` `sr-only` ajouté (accessibilité).

## 🚦 Risques & Points de Vigilance
- **Format localStorage `lkdv_planned_hikes` :** si de vieilles sorties v1 (dateRange) existent déjà, elles s'affichent avec « Date à définir » mais ne plantent pas — la normalisation laisse le temps aux utilisateurs de les supprimer/recréer. L'écriture utilise désormais systématiquement le format v2.
- **Annulation de l'API IA :** sans clé/provider la route renvoie une erreur → fallback local garantit une réponse utile, l'UI n'est jamais bloquée.
- **Composants morts** de l'ancienne vue sidebar restent dans `src/components/inventaire/` (passage futur).

---

## 🆕 Lot « 6 widgets PC + À ne pas oublier + vues fullscreen Agrandir » (2026-08-18)

> **Contexte :** spécification complète « REFONTE PC DU COCKPIT » — 6 widgets uniquement, disposition 3+3 asymétrique, widget « À ne pas oublier » remplaçant le Copilote IA, bouton **Agrandir** par widget ouvrant une **vue fullscreen spécialisée**, drag & drop persistant. Thème conservé : **clair + photo voilée** (choix utilisateur).

### Notes .obsidian consultées (source de conception)
- `02 — 🧩 ÉCOSYSTÈME/Inventaire.md` — module unifié, 5 catégories structurantes, alertes `evaluateGearAlerts()`, entretien/prêt/péremption, fiche tiroir.
- `07 — 🛒 COMMERCE/Kits.md` — kits clé en main, poids, composition.
- Retenus : le poids par catégorie, l'état/usure/maintenance/prêt/péremption comme source des alertes, le kit ↔ randonnée.
- Écartés : « points & récompenses » (+10 XP…), « scan code-barres » (non implémentés), comptes rendus de boutiques (hors cockpit).

### Changements
- **Widgets :** `Copilote IA` → **« À ne pas oublier »** (large, rang 2) : checklist intelligente priorisée (niveaux Critique / À vérifier / Conseillé / Prêt), calculée à partir des **données réelles** (alertes maintenance/péremption/remplacement/prêt, manquants du kit assigné, météo du prochain départ) + **règles génériques explicites** (consommables, documents) **marquées comme telles** dans l'UI (« Vos données » / « Règle générique »). Coche persistée en `localStorage` (`lkdv_forget_checked`).
- **Copilote IA conservé mais relégué** (décision documentée) : déplacé dans le drawer « Tout voir » → onglet **Actions → Assistance IA** (streaming + fallback « Mode dégradé » inchangés).
- **Bouton Agrandir** sur chaque widget, **à côté du drag handle** (`aria-label` explicite) → **6 vues fullscreen** spécialisées : Analyse du poids · Préparation du départ (plannedHikes + SmartDepartureEngine + kit + manquants + consommables + checklist) · Santé de l'équipement (readiness, entretien, péremptions, prêts, usage) · Checklist intelligente (groupée par domaine, source donnée/règle, coche persistée) · Centre d'alertes (filtres par type) · Gestion des kits (ouverture, création, corbeille, assignation au départ).
- **Fullscreen technique :** `fixed inset-0 z-[5000]` **hors du stacking-context de la page** (sibling du root) pour dominer le chrome global ; **Escape** ferme, **focus** posé sur le bouton de fermeture, scroll interne seul, `prefers-reduced-motion` respecté.
- **Bug global corrigé (cause racine) :** `OfflineBanner` forçait `display:flex` en inline, invalidant son `md:hidden` → la bannière mobile « Hors ligne » recouvrait tout l'écran desktop et interceptait les clics des overlays. Correction : `className="flex md:hidden"` + suppression du `display` inline.
- `DEFAULT_WIDGET_ORDER` passe à `['weight','departure','condition','forget','alerts','kits']` — un ancien ordre localStorage contenant `copilot` est invalidé et **restauré à l'ordre par défaut** (robustesse demandée).

### Validation
- `tsc --noEmit` 0 erreur · `npm run lint` 0 warning page · `npm run build` OK (route `/mon-materiel` 47,1 kB).
- **Playwright 25/25 :** 6 widgets (Copilote IA absent) · sans scroll · 6 boutons Agrandir · les **6 fullscreen s'ouvrent/se ferment (Escape)** · focus sur « Fermer (échap) » · réordonnancement + persistance · checklist cochée persistée (`lkdv_forget_checked`) · Assistance IA dans le drawer (fallback badge+texte) · mobile 380 px sans overflow · 0 erreur console hors fallback IA attendu · 0 HTTP ≥ 400.
- ⚠️ Erreur console attendue : `/api/ai/chat-completion` log un 404 fournisseur sans clé Gemini avant de basculer en « Mode dégradé » (comportement existant).