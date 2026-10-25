# Independent unified inventory backend review

Reviewed the immutable backend patch against `docs/superpowers/specs/2026-10-04-unified-inventory-design.md`, its implementation report, historical schema and compatibility migrations, and integration consumers. No implementation files were edited; concurrent UI work was excluded.

## Follow-up status: all three findings resolved

Independently re-reviewed the root reviewer's fixes. Catalog unlinking is exempted only when the old catalog row no longer exists; borrower nulling is exempted only when the old auth row no longer exists. These checks execute in the security-definer guards, so RLS invisibility cannot falsely qualify a live reference for the exemption. Generic client unlinking and participant changes remain rejected. Compas loaders now supply the lifecycle status, autofill excludes sold/wishlist/active rental records, and the readiness model overrides stale owned and packed flags for unavailable linked inventory.

Re-ran `tests/materiel/sql/foreign-key-deletion.sql` successfully on isolated PostgreSQL 17 (`inventory-root-validation`, `inventory_final`), including its authenticated client rejection assertions and borrower deletion with a populated JWT. Independently exercised catalog deletion for both `en_location` and `en_pret`, plus borrower deletion after a returned loan, in another rolled-back transaction: all passed. Re-ran Compas autofill, Compas model and inventory domain suites: 3 files and 32 tests passed. No remaining actionable defect found in these fixes. Original findings below are retained as review history.

## Findings

### [P1] Preserve borrower account deletion through the loan foreign key

Location: `supabase/migrations/20261004105314_unified_inventory.sql:94` (`inventory_loan_guard`).

The new immutable-participant check rejects every change to `borrower_id`, including the existing `materiel_loans.borrower_id REFERENCES auth.users ON DELETE SET NULL` action. Deleting any account referenced as a borrower now fails, even after its loans are returned, because PostgreSQL runs the guard for that FK-driven update. The SQL test deletes only the lender and therefore misses this regression.

Confirmed in a disposable PostgreSQL 17 database using the committed fixture and proposed migration: create a lender, a borrower, an inventory item and a linked active loan, then `DELETE FROM auth.users WHERE id = <borrower>`. PostgreSQL rejects it with `Participants et objet immuables`, context `UPDATE ONLY public.materiel_loans SET borrower_id = NULL WHERE ...`. The transaction rolls back.

Allow the FK's nulling of a borrower whose auth row has disappeared while continuing to reject ordinary client participant changes. Cover deletion of borrowers with both active and returned loans. Ensure the subsequent authorization check does not reject the legitimate FK action when the deleting user's JWT remains populated.

### [P1] Apply inventory availability to Compas direct table consumers

Locations: `supabase/migrations/20261004105314_unified_inventory.sql:52` (legacy flag synchronization), integration callers `src/features/compas/server/getCompasData.ts:239` and `src/features/compas/server/autofillActions.ts:336`.

The new lifecycle sets `is_lent` true only for `en_pret`; sold, purchase-wishlist and actively rented records keep it false. Both Compas loaders still read `product_ownership` directly without status filtering and serialize only `is_lent`. `sourceGear` at `src/features/compas/engine/autofill.ts:224` therefore selects matching sold, `a_acheter`, or `en_location` gear as available owned inventory, at zero cost. `compasModel.ts:412-420` similarly marks a linked item as owned and available whenever its inventory record exists and `isLent` is false. The filtered `gear_items` view does not protect these consumers.

Update direct ownership consumers to use the lifecycle: exclude sold and wishlist items, represent active rentals as unavailable, and preserve the intended return action semantics for loans versus rentals. Add integration coverage for a sold tent, purchase-wishlist tent and actively rented tent so automatic trip completion cannot count them as available gear.

### [P2] Permit catalog FK nulling for active and sold inventory

Location: `supabase/migrations/20261004105314_unified_inventory.sql:39-41` (`inventory_guard`).

`product_id` is introduced with `REFERENCES shop_products(id) ON DELETE SET NULL`, but the active/sold immutable-record guard includes `product_id`. Once any linked inventory record is sold, on loan or rented, deleting its catalog product fails because the automatic FK update is rejected. A sold inventory entry is terminal, so the catalog row cannot be removed through the promised unlink behavior.

Confirmed in isolated PostgreSQL 17: create a catalog product and linked sale-mode item, transition it to `vendu`, then delete the product. PostgreSQL raises `Objet engagé ou vendu: modification interdite`, with FK context `UPDATE ONLY public.product_ownership SET product_id = NULL WHERE ...`.

Permit the FK-driven clearing of a now-absent catalog reference without opening generic editing of active/sold records. Test catalog removal for sold and both active statuses.

## Verification

- Disposable local `postgres:17` container, no hosted Supabase or production writes.
- Applied `tests/materiel/sql/bootstrap.sql` and the proposed migration successfully.
- `tests/materiel/sql/unified-inventory.sql` and `tests/materiel/sql/return-compatibility.sql` passed.
- `npx vitest run tests/materiel/inventory-routes.spec.ts src/features/materiel/domain/__tests__/inventory.test.ts tests/schemas/materiel.spec.ts`: 3 files, 21 tests passed.
- Compared existing `gear_items` column types and ordering with migration `20260917020000_compatibility_adapters.sql`: replacing `serial_number` and `product_id` retains text and uuid types respectively; no incompatible view-column change found.
- Inspected trigger execution permissions, owner RLS, status-history privileges, row-locking RPCs, server schemas and error mapping. No additional validated privacy or authorization defect found in this patch.
- This was not a full historical migration replay. Existing concurrency test result from the implementation report was inspected; the root reviewer independently ran replay and concurrency checks.

The passing SQL suite does not exercise either foreign-key nulling path above or Compas ownership integrations.
