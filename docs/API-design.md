# API — Mon Matériel (services Supabase & domaine)

> Spécifications des services de l'expérience « Mon Matériel ».
> Toutes les tables sont protégées par RLS par `user_id = auth.uid()` (sauf lectures publiques
> `shop_products`). Les mutations passent systématiquement par les services — jamais de `supabase.from`
> côte à côte dans les composants.

## Tables concernées

| Table | Usage | RLS |
|---|---|---|
| `gear_items` | Inventaire possédé | users_manage_own_gear (FOR ALL, `user_id = auth.uid()`) |
| `custom_kits` / `custom_kit_items` | Kits personnalisés + corbeille 10 j | Users manage own custom_kits / custom_kit_items |
| `loans` | Prêts (lecture) | SELECT authenticated |
| `gear_history` | Historique (lecture + INSERT best-effort) | SELECT + `auth_insert_own_gear_history` |
| `orders` / `order_items` | Commandes + réception (`received_at`) | users_manage_own_orders |
| `shop_products` | Catalogue boutique (lecture publique) | SELECT anon/authenticated |
| `travel_groups` / `group_members` / `group_kit_items` | Engagements de groupe | groups_public_read + membres |
| `gear_alert_history` (M4) | Historique d'alertes résolues | users_manage_own_gear_alert_history |
| `inventory_exports` (M8) | Trace des exports inventaire | INSERT/SELECT auth.uid() |
| `kit_export_logs` (M9) | Trace des exports kits | users_manage_own_kit_export_logs |

## Services (`src/features/mon-materiel/services/`)

### GearService
- `listActiveLoans(userId)` → `loans` (status active, returned_at null)
- `listHistory(gearId)` → `gear_history`
- `insertGear(gear)` → insert `gear_items` (source CHECK 'achat','kit','manuel','occasion','catalogue')
- `writeHistory(event)` → best-effort `gear_history`
- `markReviewed(gearId, patch)` → `gear_items` last/next maintenance
- `fetchByIds(ids)` → `gear_items IN (...)` (RLS)
- Projetions pures : `filterByCondition`, `averageWear`, `topWear`, `missingInfo`,
  `findDuplicates(threshold)`, `idleSince(months)`, `freeGearWithin(days)`,
  `availabilityRatio`, `checkConflicts(context)`
- `listAlertHistory(userId)` / `resolveAlert({userId, gearId, alertType})` (M4)

### OrderService
- `listOrders(userId)` → `orders`
- `listOrderItems(userId, destinations)` → lignes non reçues enrichies de la destination
- `confirmReception({userId, ordered, product, equipment, destination, onAttachToKit})`
  → insert inventaire + `received_at` + rattachement kit + historique. Validation **Zod** pré-insert.

### LoanService
- `listLoansForGear(gearId)` · `markReturned(gearId)` (→ `gear_items` disponible) · `nudge(gearId, borrower)` (best-effort `gear_history`)

### CatalogService
- `fetchProducts(limit)` / `search(query, limit)` → `shop_products` (is_active) → `UnifiedProduct`
  (`toUnifiedProduct(row)`)

### GroupService
- `fetchGroups(userId)` → `travel_groups` (owner ou membre actif)
- `groupKitAssignments(groupId)` / `userGroupAssignments(userId)` → `group_kit_items`

### AlertService (projections pures)
- `globalScore(alerts, total)` · `filter(alerts, onglet)` · `dueIn(alerts, days)` ·
  `byCategory(alerts)` · `topWear(equipment, n)` · `seasonalTip(equipment, now)` ·
  `history(userId)` ; export `alertTypeOf(kind)`

### ExportService
- `exportChecklistCsv(checklist, checkedIds, hikeName)` / `exportInventoryCsv(equipment)` (blob CSV)
- `logInventoryExport(userId, type)` (M8) · `logKitExport(userId, kitId, format)` (M9)

## Fonctions pures du domaine (`src/features/mon-materiel/domain/`)

| Fonction | Fichier | Entrée → Sortie |
|---|---|---|
| `getGearStatus` | gear-status.ts | gear+ctx → statut cumulatif (badges, engagement, alerte) |
| `evaluateGearAlerts` / `prioritizeAlerts` | gear-alerts.ts | gear+ctx → alertes triées |
| `computeGearAvailability` / `buildAvailabilitySlots` | gear-availability.ts | gear+ctx → dispo + timeline |
| `evaluateKitCompleteness` / `countKitItemStock` | gear-completeness.ts | kit+equipment → complétude |
| `evaluateDepartureReadiness` / `buildDepartureChecklist` / `buildDepartureSnapshot` | departure-readiness.ts | départ → statut + checklist + snapshot |
| `buildReceptionGear` / `hasDuplicate` | order-reception.ts | commande → fiche inventaire |
| `inventoryValueStats` | inventory-stats.ts | equipment → statistiques |
| `aggregateKitProgress` / `weightByCategory` / `kitUsageScore` / `missingKitItems` | kit-aggregation.ts | kits → progression |
| `gearDestinationSchema` / `orderedProductItemSchema` / `newHikeFormSchema` (Zod) | validation.ts | guards de saisie |

## Hooks (`src/features/mon-materiel/hooks/`)

Tous retournent `{ data, isLoading, error }` :
`useGearStatus`, `useGearAlerts`, `useGearAvailability`, `useDepartureReadiness`,
`useKitProgress`, `useInventoryStats`, `useAvailabilityTimeline(gearIds, equipment, ctx, days)`.

## Migrations associées

`20260820120000_mon_materiel_gear_items_consolidated.sql` (colonnes + CHECK catalogue + received_at)
· `20260821000000_intelligent_kits_and_departure_system.sql` (kits + updated_at/last_used_at)
· M1 `loan_due_date` · M3/M6/M7/M10 indexes+`last_used_at` · M4 `gear_alert_history` ·
M5 `group_kit_items.start/end_date` · M8 `inventory_exports` · M9 `kit_export_logs`.

> Application : `npx supabase db push` (mot de passe DB requis — dispo dans l'environnement de l'équipe).