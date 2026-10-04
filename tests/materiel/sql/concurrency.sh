#!/usr/bin/env bash
set -euo pipefail
# Dedicated Docker PostgreSQL fixture, never production. Takes container/database.
container=${1:?container required}
database=${2:?isolated database required}
psql_cmd=(docker exec -i "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1)
"${psql_cmd[@]}" <<'SQL'
insert into auth.users values('33333333-3333-3333-3333-333333333333');
insert into product_ownership(id,user_id,name,listing_mode) values('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','33333333-3333-3333-3333-333333333333','Concurrent','vente');
SQL
log_dir=$(mktemp -d)
"${psql_cmd[@]}" > "$log_dir/first.log" 2>&1 <<'SQL' &
begin;
set role authenticated;
set request.jwt.claim.sub='33333333-3333-3333-3333-333333333333';
select transition_inventory_item('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','vendu','en_stock');
select pg_sleep(1);
commit;
SQL
first=$!
# Readiness barrier: wait for the first row lock, avoiding timing dependence.
for attempt in {1..100}; do
 locked=$("${psql_cmd[@]}" -Atc "select count(*) from pg_stat_activity where datname=current_database() and query='select pg_sleep(1);'")
 if [[ "$locked" == 1 ]]; then break; fi
done
set +e
"${psql_cmd[@]}" > "$log_dir/second.log" 2>&1 <<'SQL'
set role authenticated;
set request.jwt.claim.sub='33333333-3333-3333-3333-333333333333';
select transition_inventory_item('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','a_acheter','en_stock');
SQL
second_result=$?
set -e
wait "$first"
if [[ "$second_result" == 0 ]] || ! rg -q 'Le statut a changé' "$log_dir/second.log"; then cat "$log_dir/second.log"; exit 1; fi
"${psql_cmd[@]}" -c "delete from auth.users where id='33333333-3333-3333-3333-333333333333'"
rm -rf "$log_dir"
echo 'Concurrent transitions: one commit, one stale-state rejection.'
