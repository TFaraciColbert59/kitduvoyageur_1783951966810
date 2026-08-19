# PR — Mon Matériel v3 : nettoyage, fiabilisation & enrichissement

> Depuis `feat/mon-materiel-clean-rebuild-v3` → `main` — proposée par HERMES (2026-08-19)

## Résumé

Refonte complète de l'expérience **« Mon Matériel »** (route `/mon-materiel`) : 6 cartes en **grille 3×2 hétérogène** (desktop, rangée prioritaire plus haute) / 1 colonne (mobile), réordonnancement **drag & drop animé** (framer-motion `layout`, retour élastique), six **vues plein écran** denses, **logique métier centralisée** dans `src/features/mon-materiel/domain` (fonctions pures), flux universel **« Ajouter à l'équipement »** (Cas A/B/C) avec **commande → réception → inventaire → kit**, **fond vidéo animé** (video `object-cover autoplay muted loop playsInline` + fallback image + overlay forest-soft 30%), **radio-boutons personnalisés** (cercle animé + point central), **stock `{available}/{required}` dans les checklists** avec relance pré-filtrée, design **liquid glass clair**, **zéro emoji, zéro orange `#E4501C`**, **suppression définitive de la page `jumeau-3d`**, et suppression des anciennes interfaces (verify : jamais réaffichées après reload).

Aucune suppression destructive : données utilisateur, tables Supabase et RLS intactes ; les hooks/modales/drawers existants (`useEquipment`, `useUserKits`, `AddEditGearModal`, `GearDetailDrawer`, `KitCockpitDrawer`, `LendItemModal`, `SmartDepartureEngine`, `plannedHikes`) sont réutilisés. La boutique, le panier (`kdv_cart`) et les commandes restent compatibles.

## Composants : conservés / remplacés / dépréciés

| Type | Composant |
| :--- | :--- |
| Conservés (réutilisés tels quels) | `useEquipment`, `useUserKits`, `plannedHikes`, `SmartDepartureEngine`, `AddEditGearModal`, `GearDetailDrawer`, `KitCockpitDrawer`, `LendItemModal`, `Header`, `MobileNavWrapper` |
| Créés | `src/features/mon-materiel/{domain,services,hooks,test}`, 6 `fullscreen/*`, `components/{GlassCard (v2),GearCard,MonMaterielGrid,AddToEquipmentButton,FullscreenShell,AnimatedBackground,icons,SectionCard}`, `src/lib/storage/{storageVersion (v3),equipmentDestinations,MigrationEffect}`, `src/hooks/useMonMaterielMigration`, migration Supabase `20260820120000` |
| Dépréciés / supprimés (code mort prouvé) | **page `jumeau-3d` (supprimée définitivement + références robots.ts/cgu/drawer/docs)**, `src/components/cockpit/` (stubs `alert()` + données fictives), `src/hooks/useAlertsReliability.ts`, `src/lib/equipmentStatus.ts`, `src/lib/equipmentUtils.ts` (vide), `src/app/mon-materiel/page.tsx.bak`, ébauches de migration `20260819125556`/`25615` |
| Créés (deltas v3) | `RadioButton.tsx` (radio custom cercle animé), `public/assets/videos/mm-ambient.mp4` (boucle ambient 162 Ko, fallback poster), fonctions `countKitItemStock` + champs `availableQty/requiredQty/searchQuery` des checklists, états loading/erreur/vide avec CTA |
| Réparés | `src/app/layout.tsx` (était minifié/commenté), `src/components/mobile-nav/BottomTabBar.tsx` (parsing cassé) |

## Stockage / cache / PWA

- **Versionnement** : `MON_MATERIEL_STORAGE_VERSION = "v3"` ; migration **exécutée une seule fois au montage** (`MigrationEffect` client dans le RootLayout — un hook `useEffect` est interdit dans un Server Component, décision documentée).
- Migrations réelles : normalisation équipement invité v1/v2, validation/réinitialisation de l'ordre des widgets (anciens ids `copilot/weight/condition` → 6 cartes v3), normalisation `lkdv_forget_checked`, nettoyage clés obsolètes (`lkdv_mon_materiel_layout_v1/v2`, `lkdv_inventory_filters_v1/v2`, `lkdv_cockpit_widget_order_v1/v2`, `lkdv_mon_materiel_equipment_v1/v2`).
- **Service Worker** : inchangé, stratégie **network-first** sur les navigations → aucun bundle stale ; la nouvelle interface ne peut pas être écrasée par du cache usé (vérifié par hard reload + ancienne clé localStorage).
- `page.tsx.bak` supprimé.

## Supabase

- **Tables lues** : `gear_items`, `gear_images`, `loans`, `gear_history`, `custom_kits`, `custom_kit_items`, `kits`, `orders`, `order_items`, `shop_products`.
- **Tables modifiées** : `gear_items` (colonnes manquantes ajoutées, CHECK `source` étendu à `'catalogue'`), `order_items` (`received_at`), `gear_history` (policy INSERT `auth_insert_own_gear_history`).
- **Migration** : `supabase/migrations/20260820120000_mon_materiel_gear_items_consolidated.sql` (idempotente, à appliquer via `supabase db push`). Les ébauches 20260819125556/25615 (jamais mergées) sont remplacées.
- RLS conservées : toutes les mutations passent par `gear_items` (isentrées `user_id = auth.uid()` FOR ALL) ; `loans`/`gear_history` restent en lecture, les écritures lecture-demandée en best-effort.

## Les 6 cartes (3×2) et leurs pleins écrans

1. **À ne pas oublier** — checklist contextualisée (kit assigné + alertes + règles génériques explicitement sourcées), filtres Bloquants/À vérifier/Conseillé/Prêt, **stock `{available}/{required}`** par objet, **relance « Aucun article en stock — ajouter »** pré-filtrant l'inventaire, coche persistée, validation de préparation.
2. **Alertes & fiabilité** — score de fiabilité, filtres par type, cartes objet détaillées (photo, dates entretien/achat/usage, péremptions à venir), alertes résolues repliables, « Marquer révisé ».
3. **Mes kits** — onglets Mes kits / Kit du prochain départ / Corbeille, recherche & tri, détail (catégories, disponibles/prêtés/périmés/manquants, substituts), duplication/création/assignation/restauration.
4. **Prochain départ** — compte à rebours, statut de préparation, « Ce qui bloque » avec solutions, checklist condensée, participants, **validation = snapshot** (date, kit, contenu, poids, checklist, statut, météo) + réservation du matériel.
5. **Inventaire & catalogue** — 4 onglets (Mon inventaire / Catalogue **données réelles `shop_products`** / En commande / Corbeille) ; recherche/filtres ; flux « Ajouter à l'équipement » intégré ; **Confirmer réception** → création d'inventaire + rattachement kit + historique.
6. **Disponibilité** — Prêté par moi / Emprunté par moi / Engagé dans un départ ; synthèse (indisponibles, valeur hors domicile, conflits) ; timeline par objet ; actions rendu/relance/fiche.

## Flux commande → réception → inventaire → kit

`OrderService.confirmReception` : (1) `buildReceptionGear` (source `'achat'`) inséré dans `gear_items`, (2) marquage `received_at`, (3) rattachement à la destination mémorisée (kit/checklist/départ) via `addGearToKit`, (4) écriture `gear_history` (best-effort, policy INSERT), (5) détection de doublon bloquante. Aucun objet possédé fictif : avant réception, l'objet n'apparaît que dans **En commande**.

## Validations exécutées

- `npm run lint` (`next lint`) : fichiers touchés **0 warning**
- `npx tsc --noEmit` : **0 erreur**
- `npm run build` : **OK** (route `/mon-materiel` 57 kB)
- Tests unitaires domaine (`npx tsx src/features/mon-materiel/test/domain.test.ts`) : **23/23** (dont stock `{available}/{required}`)
- Playwright Chromium (`npx tsx scripts/pw_mon_materiel_v3.ts`) : **31/31** (grille 3×2 hétérogène/1-col, overflow 0, **jumeau-3d → 404 + zéro référence**, **fond vidéo autoplay/muted/loop/playsInline + overlay forest**, 6 fullscreens Escape/focus trap, checklist persistée + **badge stock 0/1 + relance pré-filtrée**, **radio-personnalisé destination (4 options + sélection)**, Cas A ajout kit, Cas C panier+destination, reload + hard reload **ancienne clé** → jamais d'ancienne UI, drawer, aucune erreur console)
- Sonde visuelle (`scripts/probe_visual_v3.ts`) : fond `#F5F3EE`, **vidéo `object-cover` + `videoPoster`**, **overlay `rgba(45,107,74,.3)`**, **`hasOrange = non`**, **`emojisInTitles = non`**

## Captures visuelles

`docs/screenshots/mon-materiel-v3/` — cockpit + 6 pleins écrans × desktop 1920 × mobile 380 (14 PNG) :
`01-cockpit-{desktop-1920,mobile-380}.png`, `02-{not-to-forget,alerts-reliability,my-kits,next-departure,inventory-catalog,availability}-{desktop-1920,mobile-380}.png`

## Risques / limites restantes

- La **migration Supabase** `20260820120000` doit être poussée avant que `received_at`, le CHECK `'catalogue'` et la policy `gear_history` soient actives (le code est défensif : erreurs en warning, flux inventaire fonctionnel sans elle).
- Deux stores invités coexistent : `lkdv_guest_gear` (offline/configurateur) et `lkdv_guest_equipment` (cockpit) — non fusionnés volontairement (pas de perte de données), doc au journal.
- Les données de la base réelle restent la source de vérité (aucun mock affiché comme réel ; le catalogue utilise `shop_products`, fallback `FALLBACK_AUTHENTIC_PRODUCTS` déjà marqué).

## Commits (9+)

`fix` stockage/layout → `refactor` domaine → `feat` design system → `feat` fullscreens → `feat` cockpit 3×2 → `feat` migration Supabase → `test` 21/21 + Playwright 23/23 + captures → `docs` journal → `feat/refactor` deltas v3 (jumeau-3d supprimé, fond vidéo + radio custom + stock checklists + états vides/erreur/loading + tests 23/23 + Playwright 31/31).