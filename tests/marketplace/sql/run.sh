#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."
container="${1:-marketplace-test-pg}"
database="marketplace_verify_$(date +%s)"
docker exec "$container" createdb -U postgres "$database"
trap 'docker exec "$container" dropdb -U postgres "$database"' EXIT
cat tests/materiel/sql/bootstrap.sql tests/marketplace/sql/bootstrap.sql supabase/migrations/20261004105314_unified_inventory.sql supabase/migrations/20261004124950_inventory_conflict_http409.sql supabase/migrations/20261004141725_durable_support_tickets.sql supabase/migrations/20261004151939_inventory_marketplace_manual.sql tests/marketplace/sql/lifecycle.sql tests/support/sql-contract.sql | docker exec -i "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1
bash tests/marketplace/sql/concurrency.sh "$container" "$database"
