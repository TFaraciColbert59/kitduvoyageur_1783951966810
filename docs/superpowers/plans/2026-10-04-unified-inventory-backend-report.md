# Unified inventory backend report

Implemented additive private inventory fields, catalog FK, owner serial uniqueness, mode/status labels and shared lifecycle helpers, strict create/patch/transition schemas, transactional RPC-backed mutations, immutable private status history, row locks plus expected-status concurrency checks, active/sold immutability, and atomic historical loan compatibility. Quantity remains lot quantity: completing sale marks the entire record sold. Physical condition remains independent.

## Contract

- `INVENTORY_STATUSES`, `INVENTORY_MODES` are French label records; `InventoryStatus`, `InventoryMode` are their keys.
- `getInventoryStatus(item)` uses `status` then legacy `is_lent`; `allowedInventoryTransitions(item)` returns status keys. Operational starts depend on mode; sold is terminal. Active records only offer return.
- `POST /api/materiel/items/[id]/transition` accepts `{status, expected_status}`. 401 unauthenticated, 400 invalid input/transition, 404 unavailable/nonowned object, 409 stale status or active-record guard. Returns `{item}`.
- Generic PATCH accepts editable fields only, explicitly rejects `status`, `is_lent`, owner/history fields, preserves absent fields and applies inside a row lock. SQL validates merged records. Generic POST never creates active/sold records.
- POST/GET return owner private fields. No public catalog/kit serializer was expanded. `gear_items` remains owner RLS through `security_invoker`, round-trips existing product/serial columns, excludes sold/wishlist records from ownership consumers, maps active rentals to unavailable loan status.
- Existing `createLoan`/`updateLoanStatus` use database synchronization rather than separate non-atomic flag writes. `return_inventory_item` lets the existing Compas return action close all active historical linked loans and return the item atomically. The transition endpoint returns linked loans atomically after checking expected status; direct table UPDATE cannot bypass active loans.

## Validation executed

- TDD domain/schema import failed before implementation; 3 behavior tests now pass.
- Route regression initially exposed Zod 4 `.partial()` resetting default fields; default-free partial schema now preserves existing values.
- DELETE regression initially returned 200 for missing/conflicted deletes; now 404/409.
- `npx vitest run tests/materiel/inventory-routes.spec.ts src/features/materiel/domain/__tests__/inventory.test.ts tests/schemas/materiel.spec.ts`: 21 tests pass (3 files).
- `npm run type-check`: passes.
- Targeted ESLint: passes after unused loan result fix.
- Migration created using `npx supabase migration new unified_inventory`. No remote migration application or production writes.
- Supabase RLS documentation read: https://supabase.com/docs/guides/database/postgres/row-level-security (owner USING/WITH CHECK, security-invoker views).
- Disposable Docker PostgreSQL 17 fixture: final migration compiles. `tests/materiel/sql/unified-inventory.sql` passes owner/nonowner RLS, immutable history, NULL/negative/mode price guards, serial quantity/uniqueness, sold guards, stale expected status, atomic loan start and borrower return, duplicate loans, catalog/serial compatibility, auth-user cascade.
- `tests/materiel/sql/return-compatibility.sql` failed for absent RPC then passed after implementation.
- `bash tests/materiel/sql/concurrency.sh inventory-validation inventory_complete`: simultaneous owner transitions serialize; exactly one commits and the other rejects stale expected status.

Reproduce with a disposable postgres:17 container; apply `tests/materiel/sql/bootstrap.sql`, the new migration, then both SQL test files and concurrency script. Fixtures are minimal historical tables, not a full repository migration replay.

## Deployment limits

Migration has not been applied to hosted Supabase. Verify the current staging schema and existing data before deployment; these fixtures do not establish a full historical migration replay. Negative legacy price rows remain untouched via a NOT VALID price constraint; new/updated rows are enforced. Existing loan flags and active linked records are backfilled; duplicate historical active loans remain preserved and are returned together by the compatibility RPC. Serial uniqueness is scoped to owner and is not GTIN/GS1 verification. Sale/rental transitions are manual tracking, with no marketplace escrow, insurance, KYC or new Stripe integration.
