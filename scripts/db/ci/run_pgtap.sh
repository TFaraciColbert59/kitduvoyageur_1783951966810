#!/usr/bin/env bash
# ============================================================================
# CI — exécute toutes les suites pgTAP (supabase/tests/database/*.test.sql) sur
# la base éphémère installée par install.sh. Chaque suite tourne dans sa propre
# transaction annulée (ROLLBACK) : la base reste propre entre deux suites.
#
# Runner : pg_prove (paquet apt `pgtap`, déjà là avec postgresql-17-pgtap),
# plutôt que `supabase test db` qui exige Docker.
#
# Usage : DATABASE_URL=postgresql://postgres@127.0.0.1:5432/lkdv_ci \
#           bash scripts/db/ci/run_pgtap.sh [fichier.test.sql ...]
# Sortie non nulle dès qu'une assertion échoue ou qu'un plan n'est pas tenu.
# ============================================================================
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../../.."
# shellcheck source=scripts/db/ci/lib.sh
source scripts/db/ci/lib.sh
require_local_database

if [[ $# -gt 0 ]]; then
  files=("$@")
else
  files=(supabase/tests/database/*.test.sql)
fi

step "pgTAP : ${#files[@]} suites"
pg_prove --dbname "$DATABASE_URL" "${files[@]}"
