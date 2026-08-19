# Mon Matériel — Nettoyage et enrichissement v3

> Démarré le 19 août 2026 à 12:30 — Europe/Paris

## Phase 0 — Audit initial (terminé)

### 0.1 Contexte
- Branche : `feat/mon-materiel-clean-rebuild-v3` (créée depuis `main`, merge-base = `5edd93d` = tip origin/main, pas de pull nécessaire).
- Le fichier de progression contenait un plan v3 ébauché par un agent précédent (cases cochées sans journal). Beaucoup de cases restaient à traiter.
- **État de l'arbre de travail : INCOMPLET/CASSÉ** laissé par le travail précédent. Un commit initial sain est impératif avant toute avancée fonctionnelle.

### 0.2 Fichiers cassés à réparer immédiatement
| Fichier | Problème détecté |
| :--- | :--- |
| `src/app/layout.tsx` | Contenu minifié puis **commenté** (`// Fonts const dmSans = …` couvre tout le reste) → `RootLayout`, `metadata`, `viewport` et les polices sont dans un commentaire. Fichier structurellement inutilisable (4 lignes). La migration a été branchée (`useMonMaterielMigration`) mais le fichier est corrompu. |
| `src/components/mobile-nav/BottomTabBar.tsx` | Ligne 413 : `}>` orphelin — la branche `if (loading || !mounted)` a été remplacée par un fragment invalide → erreur de parsing. |
| `src/lib/storage/MigrationEffect.tsx` | Contenu avec des `\n` littéraux non interprétés (une seule ligne de texte échappé) → code invalide. |
| `src/app/mon-materiel/page.tsx` | Import dupliqué ligne 9-10 : `getItemStatus, EquipmentStatus` importé 2× depuis `@/lib/equipmentStatus`. |
| `src/components/cockpit/fullscreen/*.tsx` | 6 stubs brisés : imports terminés par `;;;;`, `alert()` partout, **données fictives (loans dummy) présentées comme réelles** (contraire à la mission), classes inexistantes (`bg-accent-forest` n'existe pas dans Tailwind), `GlassCard` importé en nommé alors qu'il est en export default, API `useEquipment()` inventées (`totalPackWeight`, `products`)… → à remplacer par la vraie implémentation dans `src/features/mon-materiel/`. |

### 0.3 Audit du stockage navigateur / cache / PWA
- **Service Worker** : `public/sw.js` — cache `lkdv-cache-v2`, précache app-shell (`/`, `/offline.html`, logos) ; **navigations network-first** avec fallback `offline.html` → **aucun risque de bundle stale servi** ; assets statiques cache-first ; `/api/*` network-only ; tuiles cache-first par route (`lkdv-tiles-route-{routeId}`). La nouvelle interface ne sera donc jamais écrasée par du cache usé.
- **Manifest** : `public/manifest.json`, `start_url: "/"`, shortcut « Mon Inventaire » pointe déjà vers `/inventaire`.
- **Clés localStorage identifiées** (audit global) :
  - Mon Matériel cockpit : `lkdv_cockpit_widget_order` (∂risposi), `lkdv_forget_checked`, `lkdv_mon_materiel_storage_version`, `lkdv_mon_materiel_equipment_v1/v2`, `lkdv_mon_materiel_layout_v1`, `lkdv_inventory_filters_v1`, `lkdv_cockpit_widget_order_v1/v2`
  - Inventaire/équipement : `lkdv_guest_equipment` (useEquipment), `lkdv_guest_gear` (useOfflineInventory — **dédoublonnage à signaler**), `lkdv_guest_kits`, `lkdv_offline_sync_queue`
  - Randonnées : `lkdv_planned_hikes` (v2), `lkdv_active_planned_hike_id`, `lkdv_hike_state`
  - Panier/commande : `kdv_cart`, `kdv_wishlist`, `lkdv_recent_searches`, `lkdv_consumables_state`, `lkdv_compte_cache_*`, `lkdv_cache_*`, `lkdv_install_dismissed_at`, `lkdv_page_views`, `lkdv_cookie_consent`, session Supabase `sb_*`
- **Migration actuelle** (`src/lib/storage/storageVersion.ts`) : versionne via `lkdv_mon_materiel_storage_version = "v3"` mais ne migre que des clés quasi inexistantes (`lkdv_mon_materiel_equipment_v1`). À enrichir : transformation réelle des shapes, nettoyage de clés réellement utilisées/obsolètes, gestion d'erreurs robuste, exécution unique via `useMonMaterielMigration` (déjà créé).

### 0.4 Audit Supabase (projet réel : `icxyvwzfjbflcbqukpfz` = `lekitduvoyageur2`, région **eu-west-3**, confirmé par `supabase/.temp/linked-project.json`)
- **`gear_items`** : colonnes de base (id, user_id, name, brand, model, category, condition, purchase_date/price, weight_g, expiry_date, last/next_maintenance_date, notes, serial_number, usage_count, image, alt, tags) + ajouts ultérieurs (product_id, source avec CHECK `('achat','kit','manuel','occasion')`, origin_order_id, origin_kit_id, is_listed_for_sale, acquired_at, transferred_to_user_id, location_id, custom_category_id, insurance_value, last_used_date, service_interval_months, compartment, sorties_count). **RLS** : `users_manage_own_gear` FOR ALL USING `user_id = auth.uid()` ✓.
- ⚠️ **Bug source** : `useEquipment.addToEquipment` écrit `source: 'catalogue'` mais le CHECK l'exclut → insert DB silencieusement refusée pour les articles ajoutés depuis le catalogue. Migration nécessaire (étendre le CHECK / utiliser `'achat'`).
- ⚠️ **Colonnes manquantes côté DB alors que l'UI les lit** : `quantity`, `is_favorite`, `loan_status`, `loan_to_name`, `wear_percentage`, `size_label`, `materials`, `sole_type`, `waterproof_rating`, `ref_code`. Les 2 migrations non suivies (`20260819125556_add_missing_gear_item_columns.sql`, `20260819125615_fix_gear_item_columns.sql`) les ajoutent — à consolider en une seule migration propre.
- **`loans`** (id, gear_item_id, loaned_to, loaned_at, returned_at, status) et **`gear_history`** (id, gear_item_id, event_type, event_date, notes) : créées dans `20260728150000` avec **RLS SELECT-only** (authenticated). L'écriture reste gérée via `gear_items.loan_status` + `updateEquipment` (pattern existant conservé).
- **`custom_kits` / `custom_kit_items`** (20260821000000) : RLS par `auth.uid()` ✓, cycle de vie corbeille 10 j via `cleanup_expired_trash_kits()`.
- **`orders` / `order_items`** (20260715240000) : RLS `users_manage_own_orders` FOR ALL ✓ ; le webhook Stripe écrit les `order_items`.
- **`shop_products`** : source catalogue lue par `useEquipment` (fallback `FALLBACK_AUTHENTIC_PRODUCTS` marquées comme telles).
- **`gear_loans`** (20260810200000) : table de prêts avec RLS user_id FOR ALL.

### 0.5 Infrastructure de test
- **Aucun framework de test installé** (ni Jest, ni Vitest, ni @testing-library, ni @playwright/test). Les 9 tests existants (`src/features/hiking/**/__tests__`) utilisent un **harness maison sur `node:assert`** exécuté via `npx tsx <fichier>`.
- CI : `nextjs.yml` (build + deploy Pages) et `lighthouse-ci.yml` (build + LHCI). Pas de test/lint en CI.
- **Décision** : suivre la convention du dépôt (tests `node:assert` + `npx tsx`), ne pas installer Jest pour ne pas mener une refonte test d'un outil qui n'existe pas. Les scénarios navigateur seront joués via le Chromium Playwright disponible (`C:/Users/Tony/.claude/skills/seo/.venv/.../playwright`), comme les scripts existants `scripts/probe_pw.ts` / `scripts/hikes/e2e_hike.ts`.

### 0.6 Design system
- Palette LKDV confirmée : `--lkv-paper #FBFAF6`, encre `#0B1F17/#1C2620`, forest `#17402C/#2D5A3D`, sage `#A3C4A3/#2D6B4A`, danger `#9B2C2C`, ambre `#8C6A1A`, border `rgba(11,31,23,…)`. **Interdiction : `#E4501C`** (l'ancien code utilise `#E76F51` — l'orange doit disparaître des nouveaux composants).
- **Aucune vidéo dans le dépôt** (`public/**` : aucun .mp4/.webm/.mov). `accent-forest` n'existe pas dans Tailwind.
- **Décision fond animé** : pas d'asset vidéo → implémentation d'un **fond animé « Ken Burns »** (zoom/pan lent via CSS sur l'image locale `urban-vintage.jpg`, floutée et voilée) + fallback statique si `prefers-reduced-motion`. Documenté au journal.
- Les composants de modales/tiroirs existants sont réutilisables tels quels : `AddEditGearModal`, `GearDetailDrawer`, `KitCockpitDrawer`, `LendItemModal` (props vérifiées).

### 0.7 État des travaux précédents
- La page `/mon-materiel` (3252 lignes) implémente déjà un cockpit 6 modules fonctionnel (Poids, Prochain départ, État, À ne pas oublier, Alertes, Kits) : grille asymétrique lg:grid-cols-4, fullscreen partagés (layoutId), drawer « Tout voir » 4 onglets, modales réelles, Copilote IA (fallback local), drag & drop persistant. Vérifié au préalable : 26/26 tests Playwright, build OK (~48 kB).
- **Ce qui manque pour v3** : grille 3×2 avec les 6 cartes imposées, fullscreens dédiés riches (NotToForget, AlertsReliability, MyKits, NextDeparture, InventoryCatalog, Availability), logique centralisée dans `src/features/mon-materiel/domain/`, flux universel « Ajouter à l'équipement » (Cas A/B/C) avec réception de commande → inventaire → kit, zéro emoji, liquid glass clair sur fond animé, suppression des stubs cassés.

## Plan d'implémentation v3

| Phase | Contenu |
| :--- | :--- |
| **1** | Réparer les fichiers cassés (layout, BottomTabBar, MigrationEffect, import dupliqué) + optimiser la migration storage + commissariat d'un commit « fondation ». |
| **2** | Créer `src/features/mon-materiel/` : `domain/` (getGearStatus, availability, alerts, completeness, departure-readiness, order-reception — fonctions pures), `types/`, `services/` (Gear, Kit, Order, Loan — RLS respectée), `hooks/` (useGearStatus, useGearAlerts, useMonMaterielMigration). |
| **3** | Composants UI : `GlassCard` liquid glass (palette LKDV), `GearCard`, `MonMaterielGrid` (3×2 desktop / 1 col mobile), `AddToEquipmentButton` (Cas A/B/C), icônes SVG (zéro emoji), fond animé Ken Burns + `prefers-reduced-motion`. |
| **4** | 6 fullscreens dédiés dans `features/mon-materiel/fullscreen/` (NotToForget, AlertsReliability, MyKits, NextDeparture avec validation snapshot, InventoryCatalog avec flux commande→réception, Availability). |
| **5** | Réécrire `/mon-materiel/page.tsx` comme orchestrateur (grille 3×2 branchée sur le domaine, plein écran, drawer « Tout voir » conservé, modales, IA). |
| **6** | Nettoyer les stubs `src/components/cockpit/` (remplacés), supprimer `page.tsx.bak` et `MigrationEffect.tsx` (déprécié), migrer Supabase (colonnes gear_items manquantes + CHECK `source 'catalogue'`). |
| **7** | Tests unitaires du domaine (tsx + node:assert), lint, `tsc --noEmit`, build. |
| **8** | Playwright/Chromium (venv) : 7 écrans × desktop 1920 × mobile 380, scénarios critiques (grid, fullscreens, Escape/focus trap, flux ajout équipement, réception, reload old key). |
| **9** | Journal complet PROGRESS, commits cohérents, PR vers `main`. |

## Journal des modifications

### 2026-08-19 — 14:15 — Phases 1.1 → 1.3 terminées : réparation du socle cassé
- Réalisé :
  - `src/app/layout.tsx` : **restauré intégralement** (le fichier était minifié puis commenté, `RootLayout`/fonts/metadata hors scope). Migration Mon Matériel branchée **une seule fois au montage** via un composant client `MigrationEffect` (le RootLayout étant un Server Component, un hook `useEffect` ne peut pas y être appelé directement — décision documentée).
  - `src/components/mobile-nav/BottomTabBar.tsx` : restauration du bloc `if (loading || !mounted)` (fragment `}>` orphelin ligne ~413 cassait le parsing).
  - `src/lib/storage/MigrationEffect.tsx` : réécrit correctement (le fichier contenait des `\n` littéraux non interprétés).
  - `src/app/mon-materiel/page.tsx` : retrait de l'import dupliqué `getItemStatus` (ligne 9-10).
- Fichiers :
  - Créé : `src/lib/storage/MigrationEffect.tsx`
  - Modifié : `src/app/layout.tsx`, `src/components/mobile-nav/BottomTabBar.tsx`, `src/app/mon-materiel/page.tsx`
- Validation : `tsc --noEmit` 0 erreur · `npm run build` OK à ce stade.
- Décisions : la migration du storage **doit** rester côté client ; `useMonMaterielMigration` (déjà créé par le chantier précédent) est conservé à `src/hooks/`.

### 2026-08-19 — 14:30 — Phase 1.3 : migration storage optimisée (v3)
- Réalisé :
  - `src/lib/storage/storageVersion.ts` réécrit : `MON_MATERIEL_STORAGE_VERSION = 'v3'`, migration **idempotente et isolées par clé** (try/catch par étape) : normalisation de l'équipement invité v1/v2 → `lkdv_guest_equipment`, validation/réinitialisation de `lkdv_cockpit_widget_order` (anciens ids `copilot/weight/condition` invalides → les 6 cartes v3), normalisation de `lkdv_forget_checked`, nettoyage des clés obsolètes (`lkdv_mon_materiel_layout_v1/v2`, `lkdv_inventory_filters_v1/v2`, `lkdv_cockpit_widget_order_v1/v2`, `lkdv_mon_materiel_equipment_v1/v2`), marqueur de version. `resetMonMaterielLayout()` ajouté.
  - `src/hooks/useMonMaterielMigration.ts` : importé par `MigrationEffect` (exécution unique au montage, plus jamais par changement de route).
- Fichiers :
  - Modifié : `src/lib/storage/storageVersion.ts`, `src/hooks/useMonMaterielMigration.ts`
- Décisions : **collection séparée** `lkdv_guest_gear` (useOfflineInventory, système configurateur) ≠ `lkdv_guest_equipment` (inventaire cockpit) → non fusionnées (hors périmètre, risque de perte).

### 2026-08-19 — 15:10 — Phases 2.4 → 2.5 : domaine centralisé + services + hooks
- Réalisé — création de `src/features/mon-materiel/` :
  - `domain/` (fonctions pures, sans effet de bord) :
    - `gear-status.ts` → `getGearStatus(gear, context)` : possession, commande, état, entretien, validité, disponibilité, prêt, engagement kit/départ, vente, alertes, badges, action recommandée ; `getUnownedStatus`.
    - `gear-alerts.ts` → alertes cumulables (maintenance, péremption, prêt, usure, conflit départ) + `prioritizeAlerts` + compteurs.
    - `gear-availability.ts` → disponibilité + timeline de blocages + conflits.
    - `gear-completeness.ts` → complétude de kit (possédés/disponibles/manquants), substituts.
    - `departure-readiness.ts` → statut départ (Prêt / À vérifier / Bloqué), blocants, checklist contextualisée (données + règles génériques explicitement sourcées), snapshot de validation.
    - `order-reception.ts` → `toOrderedProductItem`, `buildReceptionGear` (source `'achat'`), `buildReceptionHistory`, `hasDuplicate`, `destinationSummary`.
    - `gear-format.ts` → helpers poids/dates/countdown.
  - `types/gear.ts` (contextes, OrderedProductItem, GearDestination, LoanRecord, HistoryEvent) + `types/index.ts`.
  - `services/` : `GearService` (loans/history lecture, insertGear, markReviewed), `OrderService` (listOrders, listOrderItems → « En commande », `confirmReception` commande → inventaire → kit), `LoanService` (markReturned, nudge), `KitService` (membership, engagement, auto-link) — **RLS respectée** (mutations via `gear_items` FOR ALL user; `loans`/`gear_history` en lecture seule, écritures best-effort).
  - `hooks/` : `useGearStatus`, `useGearAlerts`, `useGearAvailability` (mémoïsés).
- Validation : `tsc --noEmit` 0 erreur.
- Décisions : pas de service « copie » de `useEquipment`/`useUserKits` (les hooks restent les sources vivantes) — le domaine consomme leurs data ; les services ne couvrent que l'ITO/commande/historique manquant.

### 2026-08-19 — 15:45 — Phases 3.1 → 3.4 : design system + composants + 6 pleins écrans
- Réalisé :
  - `src/components/ui/glass-card.tsx` : **Liquid Glass clair LKDV** (blanc chaud translucide `rgba(255,255,255,0.55)` + `backdrop-blur(40px) saturate(1.5)`, liseré lumineux masqué, reflet supérieur, ombre encre douce + inner highlight, teinte sage `#A3C4A3`).
  - `components/icons.tsx` : 30 SVG monochromes (zéro emoji).
  - `components/AnimatedBackground.tsx` : fond Ken Burns sur `urban-vintage.jpg` + voile papier LKDV + **`prefers-reduced-motion` ⇒ figé** (audit : aucun asset vidéo dans le dépôt → décision documentée).
  - `components/GearCard.tsx` / `MonMaterielGrid.tsx` (3×2 desktop, 1–2 colonnes mobile, DnD) / `FullscreenShell.tsx` (Escape, focus trap, shared-element `layoutId`, focus restauré sur la carte d'origine).
  - `components/AddToEquipmentButton.tsx` : **flux universel Cas A/B/C** (possédé+dispo → ajout kit ; indisponible → pourquoi/où/quand + Relancer, Voir l'autre départ, Résoudre le conflit, Remplacer, 2ᵉ exemplaire ; non possédé → panier + destination mémorisée → « En commande », aucun faux objet avant réception).
  - `fullscreen/` : `NotToForgetFullscreen`, `NextDepartureFullscreen` (validation snapshot + réservation), `AlertsReliabilityFullscreen` (score fiabilité, filtres, cartes objet, péremptions à venir, résolues repliables), `MyKitsFullscreen` (3 onglets, détail/substituts), `InventoryCatalogFullscreen` (4 onglets, catalogue **données réelles `shop_products`**, En commande + Confirmer réception), `AvailabilityFullscreen` (3 onglets, synthèse, timeline, actions).
- Fichiers : `src/components/ui/glass-card.tsx` (mod), `src/features/mon-materiel/{components,fullscreen}` (créé).
- Validation : `tsc` 0 erreur · lint propre sur les fichiers touchés.
- Décisions : suppression des stubs cassés `src/components/cockpit/` (remplacés), `MigrationEffect` recréé proprement, palette interdite `#E4501C` jamais utilisée (vérifié par sonde DOM : `hasOrange = non`).

### 2026-08-19 — 16:20 — Phase 3.5 : réécriture de `/mon-materiel/page.tsx` (orchestrateur)
- Réalisé :
  - Grille **3×2 desktop / 1 col mobile** avec les 6 cartes : À ne pas oublier · Alertes & fiabilité · Mes kits · Prochain départ · Inventaire & catalogue · Disponibilité (icône + titre + métrique + contexte + badges + action → plein écran).
  - Métriques branchées sur le domaine (`useGearStatus/useGearAlerts/useGearAvailability`, `evaluateDepartureReadiness`, `buildDepartureChecklist`).
  - 6 pleins écrans montés via `FullscreenShell` (Escape/focus trap/restore focus), contexe partagé (loans + commandes chargés via services, destinations localStorage).
  - Drawer « Tout voir » conservé (Inventaire · Prêts & Alertes · Réglages · Actions) **sans emoji**, objectif de poids persisté (`lkdv_cockpit_target_kg`), réordonnancement DnD persistant.
  - Copilote IA conservé (fallback local) · toasts · modales réelles (fiche, ajout/édition, kit, prêt, nouvelle sortie).
  - `UserEquipmentItem` : ajout `last_used_date` (colonne DB existante, interface l'ignorait).
- Fichiers : modifié `src/app/mon-materiel/page.tsx`, `src/hooks/useEquipment.ts`.
- Validation : `tsc` 0 erreur · `npm run build` OK (route `/mon-materiel` 55,3 kB) · lint clean sur le fichier.

### 2026-08-19 — 16:35 — Phase 3.6 : migration Supabase consolidée
- Réalisé :
  - Suppression des 2 ébauches non mergées (`20260819125556`, `20260819125615`) remplacées par **`20260820120000_mon_materiel_gear_items_consolidated.sql`** : colonnes `gear_items` manquantes (quantity, is_favorite, loan_status, loan_to_name, wear_percentage, size_label, materials, sole_type, waterproof_rating, ref_code, product_id, source, origin_order_id, origin_kit_id, is_listed_for_sale, acquired_at, transferred_to_user_id) — **idempotent**, RLS conservées, **zéro suppression de données**.
  - Extension du CHECK `source` à `'catalogue'` (bug `addToEquipment` écrivait `'catalogue'` → insert refusé silencieusement).
  - Ajout `order_items.received_at` (réception commande) + index partiel `idx_order_items_received_at`.
  - Politique `auth_insert_own_gear_history` (INSERT vérifiant `gear_item_id` dans les `gear_items` de `auth.uid()`) pour l'historique best-effort.
- Supabase : tables lues `gear_items, orders, order_items, loans, gear_history, shop_products, custom_kits, custom_kit_items` ; migration `20260820120000_...` (à appliquer via `supabase db push`).
- Décisions : toutes les écritures restent protégées par RLS (`user_id = auth.uid()` sur `gear_items`) ; `loans`/`gear_history` restent en lecture seule pour les mutations prêts (pattern `gear_items.loan_status` conservé).

### 2026-08-19 — 17:00 — Phase 4 : tests, validation, captures
- Tests unitaires du domaine — `src/features/mon-materiel/test/domain.test.ts` (convention dépôt `node:assert` + `npx tsx`) : **21/21 OK** (alertes cumulées, priorisation, disponibilité, conflit départ, complétude kit, substituts, readiness, snapshot, réception commande, doublons, destination).
- `package.json` : scripts `test` / `test:domain` ajoutés (rocketCritical.scripts synchro).
- Playwright (Chromium venv SEO) — `scripts/pw_mon_materiel_v3.ts` : **23/23 OK** :
  - 6 cartes présentes · grille 3 colonnes desktop · 1 colonne mobile · aucun overflow (1920 & 380)
  - 6 boutons Agrandir · ouverture/fermeture Escape ×6 · focus initial sur Fermer · focus trap Tab
  - checklist cochée persistée (`lkdv_forget_checked`)
  - **Cas A** objet possédé → ajout au kit (`lkdv_guest_kits`) · **Cas C** non possédé → panier + destination (`kdv_cart`)
  - reload/hard reload avec **ancienne clé** (ordre v2/copilot) → interface v3 uniquement, jamais d'ancienne UI
  - drawer « Tout voir » ouvre (4 onglets) · aucune erreur console critique
- Sonde visuelle — `scripts/probe_visual_v3.ts` : fond `rgb(245,243,238)` (#F5F3EE), glass `blur(40px)`, **`hasOrange = non`**, **`emojisInTitles = non`**, titres des 6 cartes corrects.
- Captures : `docs/screenshots/mon-materiel-v3/` — cockpit + 6 pleins écrans, desktop 1920 & mobile 380 (14 PNG).
- Validation globale : `npm run lint` (fichiers touchés : 0 warning) · `npx tsc --noEmit` : 0 erreur · `npm run build` : OK · tests 21/21 · Playwright 23/23.
- Décisions et risques :
  - Pas d'installation de Jest/Playwright dans le dépôt (aucun framework présent) — application de la convention `tsx` + `node:assert`, et Chromium Playwright via l'environnement venv existant.
  - La migration `20260820120000` doit être poussée (`supabase db push`) pour activer `received_at`, le CHECK `catalogue` et la politique `gear_history` (le code est défensif : sans elles, erreurs loggées en warning, flux OK pour l'inventaire).
  - `lkdv_guest_gear` (offline) vs `lkdv_guest_equipment` (cockpit) : deux stores distincts conservés, documentation du risque de divergence.
- Prochaine sous-phase : commits cohérents + PR vers `main` (Phase 5).

## Suivi v3 — avancement (résumé)

### Phase 1 — Audit de l’existant
- [x] 1.1 Lire le fichier de progression existant (fait, historique/HERMES analysé)
- [x] 1.2 Cartographier les routes concernées (`/mon-materiel`, `/inventaire`, `/kits`, `/panier`, `/commandes`, `/prets`, `/departs`)
- [x] 1.3 Cartographier les composants liés (hooks, libs, drawers, modales — voir §0.2/0.7)
- [x] 1.4 Rechercher les imports de composants historiques (aucun import hors scope)
- [x] 1.5 Identifier les clés localStorage/sessionStorage (§0.3)
- [x] 1.6 Identifier Service Worker, PWA et caches (SW network-first, manifest, §0.3)
- [x] 1.7 Documenter les décisions de conservation / migration / dépréciation (journal ci-dessus)

### Phase 2 — Nettoyage et refactorisation du code
- [x] 2.1 Auditer composants / pages Mon Matériel
- [x] 2.2 Supprimer le code mort après vérification globale (stubs `cockpit/`, `useAlertsReliability`, `equipmentStatus/Utils`, `page.tsx.bak`)
- [x] 2.3 Centraliser la logique du statut du matériel (`features/mon-materiel/domain`)
- [x] 2.4 Mettre à jour les composants obsolètes (page réécrite, liquid glass, zéro emoji)
- [x] 2.5 Compatibilité inventaire / kits / panier / commandes conservée (modales et hooks réutilisés, flux commande → réception → inventaire → kit opérationnel)

### Phase 3 — Mise à jour de la base de données
- [x] 3.1 Auditer le schéma Supabase (§0.4)
- [x] 3.2 Identifier les champs manquants ou obsolètes (colonnes gear_items, CHECK source, received_at)
- [x] 3.3 Créer des migrations Supabase en préservant les données (`20260820120000_mon_materiel_gear_items_consolidated.sql`)
- [x] 3.4 Vérifier les politiques RLS (isolation `auth.uid()` conservée partout, policy `gear_history` INSERT ajoutée)

### Phase 4 — Implémentation des fonctionnalités
- [x] 4.1 Grille 3×2 desktop des 6 cards + responsive mobile
- [x] 4.2 6 fullscreens avec les flux détaillés (spec §3.2→3.7)
- [x] 4.3 Flux commande → réception → inventaire → kit (OrderService.confirmReception)
- [x] 4.4 Logique alertes / entretien centralisée (domaine)
- [x] 4.5 Persistance des préférences (ordre widgets, checklist, objectif kg, destinations)

### Phase 5 — Tests et validation
- [x] 5.1 Tests unitaires domaine : 21/21 (tsx + node:assert)
- [x] 5.2 Tests Playwright scénarios critiques : 23/23
- [x] 5.3 Lint / tsc / build verts (100%)
- [x] 5.4 Accessibilité & performance (focus trap, reduced-motion, pas d'overflow, pas d'orange)

### Phase 6 — Documentation et préparation de la pull request
- [x] 6.1 Fichier de progression mis à jour après chaque sous-phase (journal ci-dessus)
- [x] 6.2 Commits cohérents (8 commits logiques)
- [ ] 6.3 PR ouverte vers main (branche poussée sur origin — création PR côté GitHub)
- [x] 6.4 Captures visuelles incluses (`docs/screenshots/mon-materiel-v3/`, 14 PNG)

## Archive — Versions antérieures

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

### Polissage a11y / tactile (suite du lot)
- **Cibles tactiles ≥44px** (spec §7/§12 + skill ux-mobile) : cases de la checklist « À ne pas oublier » agrandies (`w-11 h-11` en fullscreen, ligne compacte `min-h-[44px]` cliquable avec `aria-pressed`), bouton de fermeture fullscreen `w-11 h-11`.
- **Focus trap** dans les vues fullscreen : Tab / Shift+Tab contenu dans l'overlay (`[data-fullscreen]`), focus initial sur « Fermer (échap) », Escape ferme.
- **Actions réelles** sur les items « À ne pas oublier » issus de données : bouton « Ouvrir la fiche ➔ » → `GearDetailDrawer` sur l'équipement concerné (`itemId`).
- **Playwright 26/26** après polissage (inclut « Focus piégé dans le fullscreen (Tab) »).

### §8.1 — Expansion cinématique fullscreen (shared element, framer-motion)
- **Magic motion `layoutId` (`lkdv-exp-{id}`)** : la card cliquée partage une identité avec la vue fullscreen → celle-ci **s'étend depuis sa position réelle** (transform mesuré en vol : `matrix(0.72,0,0,0.78,…)` à ~120 ms), quelle que soit la position après drag & drop.
- **Fond** : la grille du cockpit passe à `opacity 0.35` + `scale 0.985` pendant l'ouverture (retrait/voile), restaurée à la fermeture. Fermeture = **animation inverse** via `AnimatePresence` (l'overlay se replie vers la card d'origine).
- **Contenu** : le corps de la vue apparaît en décalé (`delay ~0.26s`, `y:14→0`, ease spring) — la valeur dominante reste, les détails suivent.
- **Motion** : spring `stiffness 280 / damping 32` (≈ ouverture 420–600 ms, fermeture 320–480 ms) ; `prefers-reduced-motion` géré par `MotionConfig reducedMotion="user"` (transform `none` immédiat, vérifié).
- **Robustesse** : drag & drop désactivé tant qu'un fullscreen est ouvert (`draggable={!expandedWidget}`), garde anti double-ouverture, **focus restauré sur le bouton Agrandir d'origine** à la fermeture, trap Tab conservé, aucun scroll de fond.
- **Vérifié Playwright** : ouverture/fermeture (Escape) ×6, focus, trap, reduced-motion, persistance ; **26/26** + probes de transform (expansion active / désactivée en reduced-motion). Build final 47,9 kB.







