#!/usr/bin/env bash
# ============================================================================
# CI — installation certifiée sur une base ÉPHÉMÈRE (jamais la production).
#
# Reproduit la stratégie officielle d'`install-from-baseline.ps1` (Étape 0 du
# chantier A10) sans Docker ni Supabase CLI :
#   base vide -> extensions -> doublure Supabase (rôles, auth) -> baseline de
#   production (schéma seul, 11 sept.) -> intégration auth -> privilèges ->
#   ledger des 143 migrations déjà intégrées -> migrations post-baseline,
#   strictes (ON_ERROR_STOP), chacune inscrite au ledger après succès.
#
# Pourquoi pas `supabase start` : rejouer les 300+ migrations sur une base vide
# échoue (objets de production absents du dépôt) ; la baseline est la voie
# officielle (voir supabase/replay/ et supabase/baseline/).
#
# Usage : DATABASE_URL=postgresql://postgres@127.0.0.1:5432/lkdv_ci \
#           bash scripts/db/ci/install.sh
#
# Prérequis serveur (apt) : PostgreSQL 17 (la baseline est un dump 17 : droit
# MAINTAIN), postgis, pgtap, pg_cron (shared_preload_libraries = 'pg_cron' et
# cron.database_name = la base visée).
#
# Garde-fous : base locale uniquement (lib.sh) ; schéma public vide exigé ;
# arrêt à la première migration en échec (son nom est affiché).
# ============================================================================
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../../.."
# shellcheck source=scripts/db/ci/lib.sh
source scripts/db/ci/lib.sh
require_local_database

# Messages NOTICE/WARNING (ex. wal_level) sans intérêt ici : seules les erreurs comptent.
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=error"

sql() { psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

existing="$(sql -At -c "select count(*) from information_schema.tables where table_schema = 'public'")"
if [[ "$existing" != "0" ]]; then
  echo "REFUS : le schéma public n'est pas vide (${existing} tables). Utiliser une base neuve." >&2
  exit 2
fi

step "Extensions (comme Supabase : pgcrypto et uuid-ossp dans « extensions »)"
sql -c "create schema if not exists extensions;
        create extension if not exists pgcrypto with schema extensions;
        create extension if not exists \"uuid-ossp\" with schema extensions;
        create extension if not exists postgis;
        create extension if not exists pg_trgm;
        create extension if not exists unaccent;
        create extension if not exists pgtap;"
# Chemin de recherche des rôles de l'API Supabase (api.extra_search_path).
sql -c "do \$\$ begin
          execute format('alter database %I set search_path to \"\$user\", public, extensions', current_database());
        end \$\$;"

step "Doublure Supabase (rôles, schéma auth, storage)"
sql -f scripts/db/ci/supabase_shim.sql

step "Baseline de production (schéma seul, 11 sept. 2026)"
sql -f supabase/baseline/prod_schema_20260911.sql >/dev/null
sql -f supabase/baseline/auth_integration.sql
sql -f supabase/baseline/grants.sql
sql -f scripts/db/ci/storage_prerequisites.sql

step "Ledger : $(grep -c . supabase/baseline/applied_migrations.txt) versions de production déjà intégrées"
sql -c "create schema if not exists supabase_migrations;
        create table if not exists supabase_migrations.schema_migrations (
          version text primary key, name text, statements text[]);"
while read -r version; do
  [[ -z "$version" ]] && continue
  [[ "$version" =~ ^[0-9]+$ ]] || { echo "Version de ledger inattendue : $version" >&2; exit 1; }
  printf "insert into supabase_migrations.schema_migrations(version) values ('%s') on conflict do nothing;\n" "$version"
done < supabase/baseline/applied_migrations.txt | sql

step "Migrations post-baseline (strictes)"
errfile="$(mktemp)"
applied=0
for file in supabase/migrations/*.sql; do
  name="$(basename "$file")"
  version="${name%%_*}"
  if grep -qx "$version" supabase/baseline/applied_migrations.txt; then continue; fi
  # `*_hotfix.sql` : copies, reconstruites le 13 oct., de correctifs passés en direct
  # sur la production. Plusieurs refont un objet que la migration nommée voisine crée
  # déjà : chacune passe en une transaction, et si son effet est déjà là elle est
  # annulée entière, dite, puis inscrite au ledger (comme en production). Les tests
  # pgTAP vérifient ensuite le schéma obtenu.
  if [[ "$name" == *_hotfix.sql ]]; then
    if ! sql --single-transaction -f "$file" >/dev/null 2>"$errfile"; then
      # Seul « existe déjà » est toléré ; toute autre erreur arrête l'installation.
      if ! grep -q 'ERROR: .* already exists' "$errfile"; then
        echo "ECHEC migration ${name}" >&2
        cat "$errfile" >&2
        exit 1
      fi
      echo "[ci-db] ${name} : déjà en place, annulé ($(grep -m1 -o 'ERROR: .*' "$errfile"))"
    fi
    sql -c "insert into supabase_migrations.schema_migrations(version, name) values ('${version}', '${name//\'/\'\'}') on conflict do nothing;"
    continue
  fi
  if ! sql -f "$file" >/dev/null 2>"$errfile"; then
    echo "ECHEC migration ${name}" >&2
    cat "$errfile" >&2
    exit 1
  fi
  sql -c "insert into supabase_migrations.schema_migrations(version, name) values ('${version}', '${name//\'/\'\'}') on conflict do nothing;"
  applied=$((applied + 1))
done
rm -f "$errfile"
echo "[ci-db] ${applied} migrations post-baseline appliquées sans erreur."

# Zéro migration en attente : chaque fichier du dépôt est au ledger.
files="$(mktemp)"; ledger="$(mktemp)"
for f in supabase/migrations/*.sql; do b="$(basename "$f")"; echo "${b%%_*}"; done | sort > "$files"
sql -At -c "select version from supabase_migrations.schema_migrations" | sort > "$ledger"
pending="$(comm -23 "$files" "$ledger" | tr '\n' ' ')"
rm -f "$files" "$ledger"
if [[ -n "${pending// /}" ]]; then
  echo "ECHEC : migrations non inscrites au ledger : ${pending}" >&2
  exit 1
fi
echo "[ci-db] Ledger complet, 0 migration en attente."
